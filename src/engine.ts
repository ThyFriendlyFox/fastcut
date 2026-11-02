import { ASPECT_SIZE, Aspect, Rect, Template } from './templates'
import { EditStyle, FilterKind, Timeline } from './montage'
import { MontagePainter } from './montageDraw'
import { Overlay, drawOverlay } from './overlays'

export type Montage = { timeline: Timeline; style: EditStyle; filter: FilterKind; handle: string }

export type Clip = {
  id: string
  name: string
  kind: 'video' | 'image' | 'audio'
  url: string
  el: HTMLVideoElement | HTMLImageElement
  duration: number // seconds; images = 0
}

export type Fit = 'cover' | 'contain'

export type Slot = {
  clipId: string | null
  fit: Fit
  muted: boolean
  offset: number // start the clip this many seconds in
}

export type CaptionStyle = 'classic' | 'meme' | 'box'
export type CaptionPos = 'top' | 'middle' | 'bottom'

export type Project = {
  mode: 'layout' | 'montage'
  overlays: Overlay[]
  montage: Montage | null
  template: Template
  slots: Slot[]
  background: string
  radius: number // 0..1, fraction of max rounding
  caption: { text: string; style: CaptionStyle; pos: CaptionPos }
  musicId: string | null
  musicVolume: number
  loopShort: boolean
  imageSeconds: number
}

export function emptySlot(): Slot {
  return { clipId: null, fit: 'cover', muted: true, offset: 0 }
}

/**
 * Owns the canvas, the shared clock, audio routing and export.
 * React hands it the latest project via setProject; it never re-renders React per frame.
 */
export class Engine {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  clips = new Map<string, Clip>()
  music: { clip: Clip; el: HTMLAudioElement } | null = null
  project!: Project

  playing = false
  t = 0
  private startPerf = 0
  private raf = 0
  private audio: AudioContext | null = null
  private master: GainNode | null = null
  private streamDest: MediaStreamAudioDestinationNode | null = null
  private gains = new Map<HTMLMediaElement, GainNode>()
  private onEnd: (() => void) | null = null
  onTick: ((t: number, total: number, playing: boolean) => void) | null = null

  private painter: MontagePainter

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.painter = new MontagePainter(this.ctx, (id) => (this.clips.get(id)?.el as HTMLVideoElement | HTMLImageElement) ?? null)
    const loop = () => {
      this.tick()
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    this.pause()
  }

  aspect(p = this.project): Aspect {
    return p.mode === 'montage' && p.montage ? p.montage.style.aspect : p.template.aspect
  }

  get montage() {
    return this.project.mode === 'montage' ? this.project.montage : null
  }

  setProject(p: Project) {
    const prevAspect = this.project ? this.aspect() : null
    this.project = p
    if (prevAspect !== this.aspect(p)) {
      const s = ASPECT_SIZE[this.aspect(p)]
      this.canvas.width = s.w
      this.canvas.height = s.h
    }
    // music element
    const m = p.musicId ? this.clips.get(p.musicId) : null
    if (!m && this.music) {
      this.music.el.pause()
      this.music = null
    } else if (m && this.music?.clip.id !== m.id) {
      this.music?.el.pause()
      this.music = { clip: m, el: m.el as unknown as HTMLAudioElement }
      this.music.el.loop = true
      this.route(this.music.el)
      if (this.playing) {
        this.music.el.currentTime = this.t % (m.duration || 1)
        this.music.el.play().catch(() => {})
      }
    }
    // stop clips that are no longer placed
    const used = new Set(this.montage ? [...this.montage.timeline.uses.keys()] : this.activeSlots().map((s) => s.clipId))
    for (const c of this.clips.values()) {
      if (c.kind === 'video' && !used.has(c.id) && c.id !== p.musicId) (c.el as HTMLVideoElement).pause()
    }
    // start newly placed clips if we're playing
    if (this.playing) this.syncAll(true)
    this.updateGains()
  }

  addClip(c: Clip) {
    this.clips.set(c.id, c)
    if (c.el instanceof HTMLMediaElement) this.route(c.el)
  }

  removeClip(id: string) {
    const c = this.clips.get(id)
    if (!c) return
    if (c.el instanceof HTMLMediaElement) c.el.pause()
    this.clips.delete(id)
  }

  /** Slots visible in the current template that have a clip. */
  activeSlots() {
    const n = this.project.template.regions.length
    return this.project.slots.slice(0, n).filter((s) => s.clipId && this.clips.has(s.clipId))
  }

  totalDuration() {
    if (this.montage) return this.montage.timeline.total
    let max = 0
    for (const s of this.activeSlots()) {
      const c = this.clips.get(s.clipId!)!
      if (c.kind === 'video') max = Math.max(max, Math.max(0.1, c.duration - s.offset))
    }
    return max || this.project.imageSeconds
  }

  // ---------- audio ----------
  private ensureAudio() {
    if (!this.audio) {
      this.audio = new AudioContext()
      this.master = this.audio.createGain()
      this.streamDest = this.audio.createMediaStreamDestination()
      this.master.connect(this.audio.destination)
      this.master.connect(this.streamDest)
      for (const c of this.clips.values()) if (c.el instanceof HTMLMediaElement) this.route(c.el)
      if (this.music) this.route(this.music.el)
    }
    if (this.audio.state === 'suspended') this.audio.resume()
  }

  private route(el: HTMLMediaElement) {
    if (!this.audio || this.gains.has(el)) {
      if (!this.audio) el.muted = true // silent until audio graph exists
      return
    }
    const src = this.audio.createMediaElementSource(el)
    const gain = this.audio.createGain()
    gain.gain.value = 0
    src.connect(gain).connect(this.master!)
    el.muted = false
    this.gains.set(el, gain)
    this.updateGains()
  }

  updateGains() {
    if (!this.audio) return
    const audible = new Set<string>()
    if (this.montage) {
      if (this.montage.timeline.voiceId) audible.add(this.montage.timeline.voiceId)
    } else for (const s of this.activeSlots()) if (!s.muted) audible.add(s.clipId!)
    for (const c of this.clips.values()) {
      if (!(c.el instanceof HTMLMediaElement)) continue
      const g = this.gains.get(c.el)
      if (!g) continue
      let v = audible.has(c.id) ? 1 : 0
      if (c.id === this.project.musicId) v = this.project.musicVolume
      g.gain.value = v
    }
  }

  // ---------- clock ----------
  private clipTime(c: Clip, s: Slot, t: number) {
    const len = Math.max(0.1, c.duration - s.offset)
    if (t < len) return s.offset + t
    return this.project.loopShort ? s.offset + (t % len) : c.duration - 0.05
  }

  /** Montage: each video plays during its uses and pre-seeks to its next one while idle. */
  private syncMontage(play: boolean, force: boolean) {
    const tl = this.montage!.timeline
    const t = this.t
    for (const c of this.clips.values()) {
      if (c.kind !== 'video' || c.id === this.project.musicId) continue
      const v = c.el as HTMLVideoElement
      const uses = tl.uses.get(c.id)
      if (!uses) {
        if (!v.paused) v.pause()
        continue
      }
      const active = uses.find((u) => t >= u.start - 0.02 && t < u.end)
      if (active) {
        let want = active.src + (t - active.start)
        if (want >= c.duration - 0.05) want = c.duration - 0.05
        if (!v.seeking && (force || Math.abs(v.currentTime - want) > 0.25)) v.currentTime = Math.max(0, want)
        if (play && v.paused && want < c.duration - 0.06) v.play().catch(() => {})
        if (!play && !v.paused) v.pause()
      } else {
        if (!v.paused) v.pause()
        const next = uses.find((u) => u.start > t) ?? uses[0]
        if (!v.seeking && Math.abs(v.currentTime - next.src) > 0.05) v.currentTime = next.src
      }
    }
    if (this.music) {
      const m = this.music.el
      if (force) m.currentTime = this.t % (m.duration || 1)
      if (play && m.paused) m.play().catch(() => {})
      if (!play && !m.paused) m.pause()
    }
  }

  private syncAll(play: boolean, force = false) {
    if (this.montage) return this.syncMontage(play, force)
    for (const s of this.activeSlots()) {
      const c = this.clips.get(s.clipId!)!
      if (c.kind !== 'video') continue
      const v = c.el as HTMLVideoElement
      const want = this.clipTime(c, s, this.t)
      if (force || Math.abs(v.currentTime - want) > 0.3) v.currentTime = want
      const finished = !this.project.loopShort && this.t >= c.duration - s.offset
      if (play && !finished && v.paused) v.play().catch(() => {})
      if ((!play || finished) && !v.paused) v.pause()
    }
    if (this.music) {
      const m = this.music.el
      if (force) m.currentTime = this.t % (m.duration || 1)
      if (play && m.paused) m.play().catch(() => {})
      if (!play && !m.paused) m.pause()
    }
  }

  play() {
    this.ensureAudio()
    if (this.t >= this.totalDuration() - 0.05) this.t = 0
    this.playing = true
    this.startPerf = performance.now() - this.t * 1000
    this.syncAll(true, true)
  }

  pause() {
    this.playing = false
    this.syncAll(false)
  }

  seek(t: number) {
    this.t = Math.max(0, Math.min(t, this.totalDuration()))
    this.startPerf = performance.now() - this.t * 1000
    this.syncAll(this.playing, true)
  }

  private lastSync = 0
  private tick() {
    if (!this.project) return
    const total = this.totalDuration()
    if (this.playing) {
      this.t = (performance.now() - this.startPerf) / 1000
      if (this.t >= total) {
        if (this.onEnd) {
          this.t = total
          this.draw()
          const cb = this.onEnd
          this.onEnd = null
          this.pause()
          cb()
          return
        }
        this.t = 0
        this.startPerf = performance.now()
        this.syncAll(true, true)
      } else if (this.montage) {
        this.syncMontage(true, false)
      } else if (performance.now() - this.lastSync > 250) {
        this.lastSync = performance.now()
        this.syncAll(true)
      }
    }
    this.draw()
    this.onTick?.(this.t, total, this.playing)
  }

  // ---------- drawing ----------
  draw() {
    const { ctx, canvas, project: p } = this
    const W = canvas.width
    const H = canvas.height
    const m = this.montage
    if (m) {
      this.painter.draw(this.t, W, H, m.timeline, m.style, m.filter)
      const ec = m.timeline.endCardStart
      if (ec != null && this.t >= ec) this.painter.drawEndCard(this.t, ec, m.handle, W, H)
      this.drawOverlays()
      return
    }
    ctx.fillStyle = p.background
    ctx.fillRect(0, 0, W, H)
    const n = p.template.regions.length
    for (let i = 0; i < n; i++) {
      const s = p.slots[i]
      if (!s?.clipId) continue
      const c = this.clips.get(s.clipId)
      if (!c) continue
      this.drawInRegion(c, s, p.template.regions[i])
    }
    this.drawCaption()
    this.drawOverlays()
  }

  private drawOverlays() {
    for (const o of this.project.overlays ?? []) drawOverlay(this.ctx, this.canvas.width, this.canvas.height, o, this.t)
  }

  private drawInRegion(c: Clip, s: Slot, r: Rect) {
    const { ctx, canvas } = this
    const x = r.x * canvas.width
    const y = r.y * canvas.height
    const w = r.w * canvas.width
    const h = r.h * canvas.height
    const fullBleed = r.w >= 0.999 && r.h >= 0.999
    const rad = fullBleed ? 0 : this.project.radius * Math.min(w, h) * 0.15
    const el = c.el
    const sw = el instanceof HTMLVideoElement ? el.videoWidth : el.naturalWidth
    const sh = el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight
    if (!sw || !sh) return
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, rad)
    ctx.clip()
    let scale: number
    if (s.fit === 'cover') scale = Math.max(w / sw, h / sh)
    else {
      scale = Math.min(w / sw, h / sh)
      ctx.fillStyle = '#000'
      ctx.fillRect(x, y, w, h)
    }
    const dw = sw * scale
    const dh = sh * scale
    ctx.drawImage(el, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
    ctx.restore()
  }

  private drawCaption() {
    const { ctx, canvas } = this
    const { text, style, pos } = this.project.caption
    if (!text.trim()) return
    const W = canvas.width
    const H = canvas.height
    let size = Math.round(Math.min(W, H) * 0.08)
    const font = (sz: number) => `900 ${sz}px "Arial Black", "Helvetica Neue", Arial, sans-serif`
    ctx.font = font(size)
    while (ctx.measureText(text).width > W * 0.88 && size > 12) {
      size -= 2
      ctx.font = font(size)
    }
    const y = pos === 'top' ? H * 0.1 : pos === 'middle' ? H * 0.5 : H * 0.9
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if (style === 'box') {
      const tw = ctx.measureText(text).width
      const px = size * 0.5
      ctx.fillStyle = 'rgba(0,0,0,0.78)'
      ctx.beginPath()
      ctx.roundRect(W / 2 - tw / 2 - px, y - size * 0.75, tw + px * 2, size * 1.5, size * 0.3)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.fillText(text, W / 2, y)
      return
    }
    ctx.lineJoin = 'round'
    ctx.lineWidth = size * 0.18
    ctx.strokeStyle = '#000'
    ctx.strokeText(text, W / 2, y)
    ctx.fillStyle = style === 'meme' ? '#ffd23f' : '#fff'
    ctx.fillText(text, W / 2, y)
  }

  // ---------- export ----------
  async export(onProgress: (f: number) => void): Promise<{ blob: Blob; ext: string }> {
    this.ensureAudio()
    const types = [
      'video/mp4;codecs=avc1.42E01F,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ]
    const mime = types.find((t) => MediaRecorder.isTypeSupported(t)) || ''
    const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm'
    const stream = new MediaStream([
      ...this.canvas.captureStream(30).getVideoTracks(),
      ...this.streamDest!.stream.getAudioTracks(),
    ])
    const rec = new MediaRecorder(stream, {
      mimeType: mime || undefined,
      videoBitsPerSecond: 8_000_000,
    })
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    const done = new Promise<void>((res) => (rec.onstop = () => res()))

    this.pause()
    this.seek(0)
    // give the decoders a moment to land on frame 0
    await new Promise((r) => setTimeout(r, 400))
    const total = this.totalDuration()
    const prevTick = this.onTick
    this.onTick = (t, tot, pl) => {
      prevTick?.(t, tot, pl)
      onProgress(Math.min(1, t / total))
    }
    const ended = new Promise<void>((res) => (this.onEnd = res))
    rec.start(250)
    this.play()
    await ended
    rec.stop()
    await done
    this.onTick = prevTick
    stream.getVideoTracks().forEach((t) => t.stop())
    return { blob: new Blob(chunks, { type: mime || 'video/webm' }), ext }
  }

  cancelExport() {
    if (this.onEnd) {
      const cb = this.onEnd
      this.onEnd = null
      this.pause()
      cb()
    }
  }
}
