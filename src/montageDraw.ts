import { EditStyle, FILTERS, FilterKind, Layer, Phrase, Shot, Timeline, TRANSITION_TIME } from './montage'
import { Rect } from './templates'

type El = HTMLVideoElement | HTMLImageElement
type Box = { x: number; y: number; w: number; h: number }

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3)
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
const easeBack = (p: number) => {
  const c = 1.7
  return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2)
}

export const FONTS = {
  pop: '"Anton", "Arial Black", Impact, sans-serif',
  serif: '"Playfair Display", Georgia, serif',
  script: '"Great Vibes", "Brush Script MT", cursive',
  bold: '"Anton", "Arial Black", Impact, sans-serif',
}

export function frameRect(style: EditStyle, W: number, H: number): Box {
  if (style.frame === 'card') {
    const w = W * 0.92
    const h = Math.min(w * 0.75, H * 0.6)
    return { x: (W - w) / 2, y: (H - h) / 2, w, h }
  }
  return { x: 0, y: 0, w: W, h: H }
}

export class MontagePainter {
  constructor(
    private ctx: CanvasRenderingContext2D,
    private getEl: (id: string) => El | null,
  ) {}

  draw(t: number, W: number, H: number, tl: Timeline, style: EditStyle, filter: FilterKind) {
    const ctx = this.ctx
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, W, H)
    const F = frameRect(style, W, H)
    const i = findShot(tl.shots, t)
    const shot = tl.shots[i]
    const prev = tl.shots[i - 1]
    const td = TRANSITION_TIME[shot.transition]
    const p = prev && td > 0 ? clamp((t - shot.start) / td) : 1
    const phraseIdx = findPhrase(tl.phrases, t)

    ctx.save()
    if (style.frame === 'card') {
      ctx.beginPath()
      ctx.roundRect(F.x, F.y, F.w, F.h, F.w * 0.045)
      ctx.clip()
    } else {
      ctx.beginPath()
      ctx.rect(F.x, F.y, F.w, F.h)
      ctx.clip()
    }
    ctx.filter = FILTERS[filter]

    const zoomFor = (s: Shot) => {
      if (tl.voiceId && s.layers[0]?.clipId === tl.voiceId) {
        // jump-cut punch-in on the talking clip, alternating per phrase
        return style.punch && phraseIdx >= 0 && phraseIdx % 2 === 1 ? 1.18 : 1
      }
      const age = clamp((t - s.start) / Math.max(0.3, s.end - s.start))
      return style.punch ? 1 + 0.06 * age : 1 + 0.02 * age
    }
    const drawS = (s: Shot, extraScale = 1, dx = 0, dy = 0) => this.drawShot(s, F, t, zoomFor(s) * extraScale, dx, dy)

    if (p >= 1 || !prev) drawS(shot)
    else {
      switch (shot.transition) {
        case 'fade':
          drawS(prev)
          ctx.globalAlpha = easeInOut(p)
          drawS(shot)
          ctx.globalAlpha = 1
          break
        case 'slide': {
          const e = easeInOut(p)
          drawS(prev, 1, -e * F.w)
          drawS(shot, 1, (1 - e) * F.w)
          break
        }
        case 'slices': {
          drawS(prev)
          const n = 5
          for (let k = 0; k < n; k++) {
            const pk = clamp((p - k * 0.08) / 0.68)
            if (pk <= 0) continue
            ctx.save()
            ctx.beginPath()
            ctx.rect(F.x + (k * F.w) / n, F.y, F.w / n + 1, F.h)
            ctx.clip()
            drawS(shot, 1, 0, (1 - easeOut(pk)) * F.h * (k % 2 ? -1 : 1))
            ctx.restore()
          }
          break
        }
        case 'diagonal': {
          drawS(prev)
          const d = easeInOut(p) * (F.w + F.h) * 1.05
          ctx.save()
          ctx.beginPath()
          ctx.moveTo(F.x, F.y)
          ctx.lineTo(F.x + d, F.y)
          ctx.lineTo(F.x + d - F.h, F.y + F.h)
          ctx.lineTo(F.x, F.y + F.h)
          ctx.closePath()
          ctx.clip()
          drawS(shot)
          ctx.restore()
          break
        }
        case 'zoom':
          drawS(shot, 1 + 0.4 * (1 - easeOut(p)))
          break
        default:
          drawS(shot)
      }
    }
    ctx.filter = 'none'
    // white flash on top of the frame
    if (prev && shot.transition === 'flash' && p < 1) {
      ctx.fillStyle = `rgba(255,255,255,${Math.pow(1 - p, 1.6)})`
      ctx.fillRect(F.x, F.y, F.w, F.h)
    }
    if (prev && shot.transition === 'zoom' && p < 1) {
      ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - p)})`
      ctx.fillRect(F.x, F.y, F.w, F.h)
    }
    ctx.restore()

    if (style.frame === 'letterbox') {
      ctx.fillStyle = '#000'
      const bar = H * 0.1
      ctx.fillRect(0, 0, W, bar)
      ctx.fillRect(0, H - bar, W, bar)
    }

    if (phraseIdx >= 0) {
      const ph = tl.phrases[phraseIdx]
      if (style.text === 'pop') this.drawPop(ph, t, F, style)
      else if (style.text === 'kinetic') this.drawKinetic(ph, t, F, style)
    }
  }

  private drawShot(s: Shot, F: Box, t: number, scale: number, dx: number, dy: number) {
    const [main, ...boxes] = s.layers
    if (main) this.drawLayer(main, F, scale, dx, dy)
    for (const b of boxes) {
      if (!b.box) continue
      const age = t - s.start
      const p = clamp(age / 0.35)
      const r = toBox(b.box, F)
      const sc = easeBack(p)
      if (sc <= 0.01) continue
      const cx = r.x + r.w / 2
      const cy = r.y + r.h / 2
      const w = r.w * sc
      const h = r.h * sc
      const box = { x: cx - w / 2 + dx, y: cy - h / 2 + dy, w, h }
      this.ctx.save()
      this.ctx.shadowColor = 'rgba(0,0,0,0.5)'
      this.ctx.shadowBlur = F.w * 0.02
      this.ctx.fillStyle = '#fff'
      this.ctx.fillRect(box.x, box.y, box.w, box.h)
      this.ctx.restore()
      if (age > 0.12) this.drawLayer(b, box, 1, 0, 0)
    }
  }

  private drawLayer(l: Layer, R: Box, scale: number, dx: number, dy: number) {
    const el = this.getEl(l.clipId)
    if (!el) return
    const sw = el instanceof HTMLVideoElement ? el.videoWidth : el.naturalWidth
    const sh = el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight
    if (!sw || !sh) return
    const ctx = this.ctx
    const s = Math.max(R.w / sw, R.h / sh) * scale
    const w = sw * s
    const h = sh * s
    ctx.save()
    ctx.beginPath()
    ctx.rect(R.x, R.y, R.w, R.h)
    ctx.clip()
    ctx.drawImage(el, R.x + (R.w - w) / 2 + dx, R.y + (R.h - h) / 2 + dy, w, h)
    ctx.restore()
  }

  /** One big word at a time, popping in. */
  private drawPop(ph: Phrase, t: number, F: Box, style: EditStyle) {
    const ctx = this.ctx
    const word = ph.words[0].text.toUpperCase()
    const age = t - ph.start
    const pop = age < 0.12 ? 1.3 - 0.3 * (age / 0.12) : 1
    let size = Math.min(F.w, F.h) * 0.16
    ctx.font = `${size}px ${FONTS.pop}`
    const max = F.w * 0.86
    const mw = ctx.measureText(word).width
    if (mw > max) size *= max / mw
    ctx.save()
    ctx.translate(F.x + F.w / 2, F.y + F.h * 0.52)
    ctx.scale(pop, pop)
    ctx.font = `${size}px ${FONTS.pop}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = size * 0.15
    ctx.shadowOffsetY = size * 0.05
    ctx.lineWidth = size * 0.08
    ctx.strokeStyle = 'rgba(0,0,0,0.85)'
    ctx.strokeText(word, 0, 0)
    ctx.shadowColor = 'transparent'
    ctx.fillStyle = style.textColor
    ctx.fillText(word, 0, 0)
    ctx.restore()
  }

  /** A phrase that builds word by word in mixed fonts: one tall hero word, small serif/script around it. */
  private drawKinetic(ph: Phrase, t: number, F: Box, style: EditStyle) {
    const ctx = this.ctx
    const words = ph.words
    let hero = 0
    words.forEach((w, i) => {
      if (w.text.replace(/\W/g, '').length > words[hero].text.replace(/\W/g, '').length) hero = i
    })
    const base = Math.min(F.w, F.h) * 0.085
    type Item = { text: string; font: string; size: number; sx: number; w: number; t: number; hero: boolean }
    const items: Item[] = words.map((w, i) => {
      const isHero = i === hero && words.length > 1
      const kind = isHero ? 'hero' : i % 3 === 1 ? 'script' : i % 3 === 2 ? 'bold' : 'serif'
      let text = w.text
      let font: string
      let size = base
      let sx = 1
      if (kind === 'hero') {
        text = text.toUpperCase()
        font = `700 ${base * 3.2}px ${FONTS.serif}`
        size = base * 3.2
        sx = 0.55 // tall, condensed look
      } else if (kind === 'script') {
        font = `${base * 1.5}px ${FONTS.script}`
        size = base * 1.5
      } else if (kind === 'bold') {
        text = text.toUpperCase()
        font = `${base * 0.95}px ${FONTS.bold}`
        size = base * 0.95
      } else {
        text = text.toUpperCase()
        font = `400 ${base}px ${FONTS.serif}`
      }
      ctx.font = font
      return { text, font, size, sx, w: ctx.measureText(text).width * sx, t: w.t, hero: isHero }
    })
    // single word phrase: make it the hero
    if (words.length === 1) {
      const it = items[0]
      it.text = words[0].text.toUpperCase()
      it.size = base * 2.6
      it.font = `700 ${it.size}px ${FONTS.serif}`
      it.sx = 0.6
      ctx.font = it.font
      it.w = ctx.measureText(it.text).width * it.sx
      it.hero = true
    }
    // shrink everything if the hero is too wide
    const maxW = F.w * 0.88
    const widest = Math.max(...items.map((i) => i.w))
    const fit = widest > maxW ? maxW / widest : 1
    // lines: small words before hero on one line, hero alone, small words after on one line
    const hi = items.findIndex((i) => i.hero)
    const groups: Item[][] = hi >= 0 ? [items.slice(0, hi), [items[hi]], items.slice(hi + 1)] : [items]
    const lines = groups.filter((g) => g.length)
    const gap = base * 0.3 * fit
    const lineH = (l: Item[]) => Math.max(...l.map((i) => i.size)) * (l[0].hero ? 0.82 : 1.05) * fit
    const totalH = lines.reduce((a, l) => a + lineH(l), 0)
    let y = F.y + F.h / 2 - totalH / 2
    ctx.save()
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.fillStyle = style.textColor
    for (const l of lines) {
      const lh = lineH(l)
      const lw = l.reduce((a, i) => a + i.w * fit, 0) + gap * (l.length - 1)
      let x = F.x + F.w / 2 - lw / 2
      for (const it of l) {
        const age = t - it.t
        if (age >= 0) {
          const a = clamp(age / 0.18)
          ctx.save()
          ctx.globalAlpha = a
          ctx.translate(x, y + lh / 2 + (1 - easeOut(a)) * base * 0.4)
          ctx.scale(it.sx * fit, fit)
          ctx.font = it.font
          ctx.shadowColor = 'rgba(255,255,255,0.55)'
          ctx.shadowBlur = it.size * 0.12
          ctx.fillText(it.text, 0, 0)
          ctx.restore()
        }
        x += it.w * fit + gap
      }
      y += lh
    }
    ctx.restore()
  }

  drawEndCard(t: number, start: number, handle: string, W: number, H: number) {
    const ctx = this.ctx
    const a = clamp((t - start) / 0.4)
    ctx.fillStyle = `rgba(20,20,24,${0.82 * a})`
    ctx.fillRect(0, 0, W, H)
    const cx = W / 2
    const cy = H / 2
    const r = Math.min(W, H) * 0.075 * easeBack(clamp((t - start) / 0.5))
    if (r > 1) {
      const hue = ((t - start) * 120) % 360
      const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
      g.addColorStop(0, `hsl(${hue},90%,60%)`)
      g.addColorStop(1, `hsl(${(hue + 80) % 360},90%,55%)`)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(cx, cy - r * 0.6, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.moveTo(cx - r * 0.3, cy - r * 1.05)
      ctx.lineTo(cx + r * 0.45, cy - r * 0.6)
      ctx.lineTo(cx - r * 0.3, cy - r * 0.15)
      ctx.closePath()
      ctx.fill()
    }
    const ta = clamp((t - start - 0.25) / 0.3)
    ctx.globalAlpha = ta
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const size = Math.min(W, H) * 0.05
    ctx.font = `${size}px ${FONTS.pop}`
    const h = handle.trim()
    ctx.fillText((h.startsWith('@') ? h : '@' + h).toUpperCase(), cx, cy + Math.min(W, H) * 0.09)
    ctx.font = `${size * 0.6}px ${FONTS.pop}`
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.fillText('FOLLOW FOR MORE', cx, cy + Math.min(W, H) * 0.15)
    ctx.globalAlpha = 1
  }
}

function toBox(r: Rect, F: Box): Box {
  return { x: F.x + r.x * F.w, y: F.y + r.y * F.h, w: r.w * F.w, h: r.h * F.h }
}

export function findShot(shots: Shot[], t: number) {
  let lo = 0
  let hi = shots.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (shots[mid].start <= t) lo = mid
    else hi = mid - 1
  }
  return lo
}

function findPhrase(ph: Phrase[], t: number) {
  for (let i = ph.length - 1; i >= 0; i--) if (ph[i].start <= t) return t < ph[i].end ? i : -1
  return -1
}
