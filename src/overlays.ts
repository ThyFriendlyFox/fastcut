// Motion graphics layered on top of any video. Drawn on the canvas, so they end up in the export.
import { FONTS } from './montageDraw'
import { Xform, applyXform } from './elements'

export type OverlayKind = 'title' | 'lower' | 'sticker' | 'sparkles' | 'emoji' | 'countdown' | 'glitch' | 'confetti' | 'circle' | 'progress'

export type Overlay = {
  id: string
  kind: OverlayKind
  text: string
  start: number
  duration: number
  color: string
  xform?: Xform
}

export type Preset = { kind: OverlayKind; name: string; text: string; duration: number; color: string; hasText: boolean; full?: boolean }

export const PRESETS: Preset[] = [
  { kind: 'title', name: 'Big Title', text: 'Summer 2026', duration: 3, color: '#ff3d6e', hasText: true },
  { kind: 'lower', name: 'Name Tag', text: 'Your Name', duration: 3.5, color: '#4361ee', hasText: true },
  { kind: 'sticker', name: 'Follow Sticker', text: 'Follow @you', duration: 3, color: '#ff3d6e', hasText: true },
  { kind: 'glitch', name: 'Glitch Text', text: 'NO WAY', duration: 2, color: '#ffffff', hasText: true },
  { kind: 'countdown', name: '3-2-1', text: '', duration: 3, color: '#ffd23f', hasText: false },
  { kind: 'sparkles', name: 'Sparkles', text: '', duration: 1.6, color: '#ffd23f', hasText: false },
  { kind: 'confetti', name: 'Confetti', text: '', duration: 2.5, color: '#ff3d6e', hasText: false },
  { kind: 'emoji', name: 'Emoji Rain', text: '🔥', duration: 3, color: '#ffffff', hasText: true },
  { kind: 'circle', name: 'Circle It', text: '', duration: 2, color: '#ff3d6e', hasText: false },
  { kind: 'progress', name: 'Progress Bar', text: '', duration: 10, color: '#3ddc97', hasText: false, full: true },
]

export const OVERLAY_COLORS = ['#ff3d6e', '#ffd23f', '#3ddc97', '#4361ee', '#9b5de5', '#ffffff']

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3)
const easeIn = (p: number) => p * p * p
const backOut = (p: number) => {
  const c = 1.7
  return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2)
}
const springy = (t: number) => (t <= 0 ? 0 : 1 - Math.exp(-6 * t) * Math.cos(14 * t))
const rnd = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}
const hashId = (id: string) => [...id].reduce((a, c) => a + c.charCodeAt(0), 0)

/** Graphics that fill the whole frame cannot be moved. */
export const MOVABLE: Record<OverlayKind, boolean> = {
  title: true,
  lower: true,
  sticker: true,
  glitch: true,
  countdown: true,
  sparkles: true,
  circle: true,
  confetti: false,
  emoji: false,
  progress: false,
}

/** The graphic's box in pixels at its default spot, before the user's move/resize. */
export function overlayBase(ctx: CanvasRenderingContext2D, W: number, H: number, o: Overlay) {
  const S = Math.min(W, H)
  const measure = (font: string, text: string) => {
    ctx.save()
    ctx.font = font
    const w = ctx.measureText(text).width
    ctx.restore()
    return w
  }
  switch (o.kind) {
    case 'title': {
      let size = S * 0.13
      let w = measure(`${size}px ${FONTS.pop}`, (o.text || ' ').toUpperCase())
      if (w > W * 0.9) {
        size *= (W * 0.9) / w
        w = W * 0.9
      }
      return { cx: W / 2, cy: H / 2 + size * 0.1, w: w + size * 0.3, h: size * 1.75 }
    }
    case 'lower': {
      const size = S * 0.055
      const w = measure(`${size}px ${FONTS.pop}`, o.text.toUpperCase()) + size * 1.4
      return { cx: W * 0.05 + w / 2, cy: H * 0.78 + size * 0.2, w, h: size * 2.1 }
    }
    case 'sticker': {
      const size = S * 0.05
      const w = measure(`${size}px ${FONTS.pop}`, o.text.toUpperCase()) + size * 3
      return { cx: W / 2, cy: H * 0.72, w: w * 1.05, h: size * 2.3 }
    }
    case 'glitch': {
      const size = S * 0.16
      return { cx: W / 2, cy: H / 2, w: measure(`${size}px ${FONTS.pop}`, o.text.toUpperCase()) + size * 0.3, h: size * 1.2 }
    }
    case 'countdown':
      return { cx: W / 2, cy: H / 2, w: S * 0.48, h: S * 0.48 }
    case 'sparkles':
      return { cx: W / 2, cy: H / 2, w: S, h: S }
    case 'circle':
      return { cx: W / 2, cy: H / 2, w: S * 0.62, h: S * 0.46 }
    default:
      return null
  }
}

export function drawOverlay(ctx: CanvasRenderingContext2D, W: number, H: number, o: Overlay, t: number) {
  const lt = t - o.start
  if (lt < 0 || lt > o.duration) return
  const S = Math.min(W, H)
  const outP = clamp((lt - (o.duration - 0.3)) / 0.3) // 0..1 during the last 0.3s
  const seed = hashId(o.id)
  const base = o.xform && MOVABLE[o.kind] ? overlayBase(ctx, W, H, o) : null
  ctx.save()
  if (base) applyXform(ctx, W, H, base.cx, base.cy, o.xform)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  switch (o.kind) {
    case 'title': {
      const words = (o.text || ' ').toUpperCase().split(/\s+/)
      let size = S * 0.13
      ctx.font = `${size}px ${FONTS.pop}`
      const gap = size * 0.25
      let widths = words.map((w) => ctx.measureText(w).width)
      let total = widths.reduce((a, b) => a + b, 0) + gap * (words.length - 1)
      if (total > W * 0.9) {
        size *= (W * 0.9) / total
        ctx.font = `${size}px ${FONTS.pop}`
        widths = words.map((w) => ctx.measureText(w).width)
        total = widths.reduce((a, b) => a + b, 0) + gap * (words.length - 1)
      }
      const cy = H / 2 - easeIn(outP) * size * 0.6
      ctx.globalAlpha = 1 - outP
      // mask so words rise from behind a line
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, cy - size * 0.75, W, size * 1.4)
      ctx.clip()
      let x = W / 2 - total / 2
      words.forEach((w, i) => {
        const p = clamp((lt - i * 0.09) / 0.45)
        ctx.textAlign = 'left'
        ctx.fillStyle = '#fff'
        ctx.shadowColor = 'rgba(0,0,0,.45)'
        ctx.shadowBlur = size * 0.15
        ctx.fillText(w, x, cy + (1 - backOut(p)) * size * 1.2)
        x += widths[i] + gap
      })
      ctx.restore()
      const bp = easeOut(clamp((lt - 0.25) / 0.5))
      ctx.fillStyle = o.color
      ctx.fillRect(W / 2 - (total / 2) * bp, cy + size * 0.68, total * bp, size * 0.1)
      break
    }
    case 'lower': {
      const inP = easeOut(clamp(lt / 0.45))
      const slide = (1 - inP) * -W * 0.6 + easeIn(outP) * -W * 0.6
      const size = S * 0.055
      ctx.font = `${size}px ${FONTS.pop}`
      const tw = ctx.measureText(o.text.toUpperCase()).width
      const x = W * 0.05 + slide
      const y = H * 0.78
      ctx.fillStyle = o.color
      ctx.fillRect(x, y - size * 0.8, tw + size * 1.4, size * 1.6)
      ctx.fillStyle = '#fff'
      ctx.fillRect(x, y + size * 0.95, (tw + size * 1.4) * 0.45 * easeOut(clamp((lt - 0.2) / 0.4)), size * 0.18)
      ctx.textAlign = 'left'
      ctx.fillText(o.text.toUpperCase(), x + size * 0.7, y + size * 0.05)
      break
    }
    case 'sticker': {
      const sc = springy(lt * 1.2) * (1 - easeIn(outP))
      if (sc <= 0.01) break
      const size = S * 0.05
      ctx.font = `${size}px ${FONTS.pop}`
      const tw = ctx.measureText(o.text.toUpperCase()).width
      const w = tw + size * 3
      const h = size * 2
      ctx.translate(W / 2, H * 0.72)
      ctx.rotate(Math.sin(lt * 6) * 0.05)
      ctx.scale(sc, sc)
      ctx.shadowColor = 'rgba(0,0,0,.35)'
      ctx.shadowBlur = size * 0.6
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.roundRect(-w / 2, -h / 2, w, h, h / 2)
      ctx.fill()
      ctx.shadowColor = 'transparent'
      ctx.fillStyle = o.color
      ctx.beginPath()
      ctx.arc(-w / 2 + h / 2, 0, h * 0.36, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.fillRect(-w / 2 + h / 2 - h * 0.18, -h * 0.04, h * 0.36, h * 0.08)
      ctx.fillRect(-w / 2 + h / 2 - h * 0.04, -h * 0.18, h * 0.08, h * 0.36)
      ctx.fillStyle = '#111'
      ctx.fillText(o.text.toUpperCase(), h * 0.45, size * 0.05)
      break
    }
    case 'glitch': {
      const size = S * 0.16
      ctx.font = `${size}px ${FONTS.pop}`
      const txt = o.text.toUpperCase()
      const frame = Math.floor(lt * 18)
      const j = (k: number) => (rnd(seed + frame * 7 + k) - 0.5) * size * 0.12
      const on = lt < 0.4 || rnd(seed + frame) > 0.75 ? 1 : 0.25
      ctx.globalAlpha = 1 - outP
      ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = 'rgba(255,0,80,0.9)'
      ctx.fillText(txt, W / 2 + j(1) * on - size * 0.03, H / 2 + j(2) * on)
      ctx.fillStyle = 'rgba(0,220,255,0.9)'
      ctx.fillText(txt, W / 2 + j(3) * on + size * 0.03, H / 2 + j(4) * on)
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = o.color
      ctx.fillText(txt, W / 2, H / 2)
      // a couple of tear lines
      for (let k = 0; k < 3; k++) {
        if (rnd(seed + frame * 3 + k) > 0.5 * on) continue
        const y = H / 2 + (rnd(seed + frame + k * 11) - 0.5) * size
        const sh = size * 0.08
        ctx.drawImage(ctx.canvas, 0, y, W, sh, j(k + 9) * 3, y, W, sh)
      }
      break
    }
    case 'countdown': {
      const n = Math.max(1, Math.ceil(o.duration - lt))
      const f = lt % 1
      const size = S * 0.3
      const sc = 1.6 - 0.6 * easeOut(clamp(f / 0.3))
      ctx.globalAlpha = 1 - easeIn(clamp((f - 0.75) / 0.25))
      ctx.strokeStyle = o.color
      ctx.lineWidth = S * 0.015
      ctx.beginPath()
      ctx.arc(W / 2, H / 2, size * 0.75, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f)
      ctx.stroke()
      ctx.translate(W / 2, H / 2)
      ctx.scale(sc, sc)
      ctx.font = `${size}px ${FONTS.pop}`
      ctx.fillStyle = '#fff'
      ctx.shadowColor = 'rgba(0,0,0,.5)'
      ctx.shadowBlur = size * 0.1
      ctx.fillText(String(n), 0, size * 0.05)
      break
    }
    case 'sparkles': {
      for (let i = 0; i < 26; i++) {
        const a = rnd(seed + i) * Math.PI * 2
        const d = (0.12 + rnd(seed + i + 50) * 0.35) * S
        const delay = rnd(seed + i + 90) * 0.4
        const p = clamp((lt - delay) / 0.9)
        if (p <= 0 || p >= 1) continue
        const r = S * (0.012 + rnd(seed + i + 7) * 0.02) * Math.sin(p * Math.PI)
        const x = W / 2 + Math.cos(a) * d * easeOut(p)
        const y = H / 2 + Math.sin(a) * d * easeOut(p)
        star(ctx, x, y, r, i % 3 === 0 ? '#fff' : o.color, lt * 2 + i)
      }
      break
    }
    case 'confetti': {
      const colors = [o.color, '#ffd23f', '#3ddc97', '#4361ee', '#9b5de5', '#fff']
      for (let i = 0; i < 90; i++) {
        const vx = (rnd(seed + i) - 0.5) * W * 0.9
        const vy = -(0.7 + rnd(seed + i + 1) * 0.6) * H * 1.3
        const g = H * 1.6
        const tt = lt
        const x = W / 2 + vx * tt * (1 - tt * 0.15)
        const y = H * 1.02 + vy * tt + 0.5 * g * tt * tt
        if (y > H * 1.1 && tt > 0.5) continue
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(tt * (4 + rnd(seed + i + 2) * 8))
        ctx.scale(1, Math.cos(tt * (6 + (i % 5))))
        ctx.globalAlpha = 1 - outP
        ctx.fillStyle = colors[i % colors.length]
        ctx.fillRect(-S * 0.008, -S * 0.004, S * 0.016, S * 0.008)
        ctx.restore()
      }
      break
    }
    case 'emoji': {
      const size = S * 0.08
      ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
      for (let i = 0; i < 28; i++) {
        const x = rnd(seed + i) * W
        const speed = (0.35 + rnd(seed + i + 3) * 0.5) * H
        const y = -size + (lt - rnd(seed + i + 6) * 1.2) * speed
        if (y < -size || y > H + size) continue
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(Math.sin(lt * 3 + i) * 0.4)
        ctx.globalAlpha = 1 - outP
        ctx.fillText(o.text || '🔥', 0, 0)
        ctx.restore()
      }
      break
    }
    case 'circle': {
      const p = easeOut(clamp(lt / 0.6))
      const rx = S * 0.28
      const ry = S * 0.2
      ctx.globalAlpha = 1 - outP
      ctx.strokeStyle = o.color
      ctx.lineWidth = S * 0.014
      ctx.lineCap = 'round'
      ctx.beginPath()
      const end = p * Math.PI * 2.15
      for (let a = 0; a <= end; a += 0.05) {
        const wob = 1 + 0.04 * Math.sin(a * 3 + seed)
        const x = W / 2 + Math.cos(a - 2) * rx * wob
        const y = H / 2 + Math.sin(a - 2) * ry * wob
        a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
      break
    }
    case 'progress': {
      const h = Math.max(4, S * 0.012)
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.fillRect(0, 0, W, h)
      ctx.fillStyle = o.color
      ctx.fillRect(0, 0, W * clamp(lt / o.duration), h)
      break
    }
  }
  ctx.restore()
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, rot: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot * 0.3)
  ctx.fillStyle = color
  ctx.shadowColor = color
  ctx.shadowBlur = r * 2
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 ? r * 0.3 : r
    const a = (i * Math.PI) / 4
    i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(rr, 0)
  }
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}
