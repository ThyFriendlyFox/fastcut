import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Clip, Engine, Montage, Project, Slot, emptySlot } from './engine'
import { ASPECT_SIZE, Aspect, BACKGROUNDS, TEMPLATES, Template } from './templates'
import { EDIT_STYLES, EditStyle, FilterKind, TimedWord, plan } from './montage'
import { FONTS } from './montageDraw'
import { SongInfo, detectBeats } from './beats'
import { transcribe } from './captions'
import { OVERLAY_COLORS, Overlay, PRESETS, Preset, drawOverlay } from './overlays'
import { AnimatePresence, motion } from 'motion/react'

const spring = { type: 'spring', stiffness: 500, damping: 34 } as const

/** Song waveform with a draggable window showing which part of the song plays under the video. */
function SongStrip({
  song,
  start,
  length,
  t,
  fadeIn,
  fadeOut,
  onStart,
}: {
  song: SongInfo
  start: number
  length: number
  t: number
  fadeIn: boolean
  fadeOut: boolean
  onStart: (s: number) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; start: number } | null>(null)
  const maxStart = Math.max(0, song.duration - Math.min(length, song.duration))
  const winW = Math.min(1, length / song.duration)
  const winX = song.duration ? start / song.duration : 0

  useEffect(() => {
    const c = ref.current!
    const r = c.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    c.width = r.width * dpr
    c.height = r.height * dpr
    const ctx = c.getContext('2d')!
    const W = c.width
    const H = c.height
    ctx.clearRect(0, 0, W, H)
    const n = song.peaks.length
    const bw = W / n
    for (let i = 0; i < n; i++) {
      const x = i * bw
      const f = i / n
      const inWin = f >= winX && f <= winX + winW
      let h = song.peaks[i] * H * 0.9
      if (inWin) {
        const local = (f - winX) * song.duration
        const left = (winX + winW - f) * song.duration
        if (fadeIn) h *= Math.min(1, local / 1.5)
        if (fadeOut) h *= Math.min(1, left / 2)
      }
      ctx.fillStyle = inWin ? '#ff3d6e' : 'rgba(255,255,255,0.22)'
      ctx.fillRect(x, (H - h) / 2, Math.max(1, bw - dpr), Math.max(dpr, h))
    }
    // beat ticks inside the window
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    for (const b of song.beats) {
      const f = b / song.duration
      if (f >= winX && f <= winX + winW) ctx.fillRect(f * W, H - 4 * dpr, dpr, 4 * dpr)
    }
  }, [song, winX, winW, fadeIn, fadeOut])

  const toSec = (dx: number) => (dx / (wrap.current?.clientWidth || 1)) * song.duration
  const head = winX + Math.min(t, length) / song.duration

  return (
    <div
      className="song-strip"
      ref={wrap}
      onPointerDown={(e) => {
        const r = wrap.current!.getBoundingClientRect()
        const f = (e.clientX - r.left) / r.width
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        // clicking outside the window jumps it there (centered)
        if (f < winX || f > winX + winW) {
          const ns = Math.max(0, Math.min(maxStart, f * song.duration - length / 2))
          onStart(ns)
          drag.current = { x: e.clientX, start: ns }
        } else drag.current = { x: e.clientX, start }
      }}
      onPointerMove={(e) => {
        if (!drag.current) return
        onStart(Math.max(0, Math.min(maxStart, drag.current.start + toSec(e.clientX - drag.current.x))))
      }}
      onPointerUp={() => (drag.current = null)}
    >
      <canvas ref={ref} />
      <div className="song-win" style={{ left: `${winX * 100}%`, width: `${winW * 100}%` }}>
        <span>{fmt(start)}</span>
      </div>
      <div className="song-head" style={{ left: `${head * 100}%` }} />
    </div>
  )
}

/** Live looping preview of a motion graphic, drawn with the same code as the export. */
function OverlayPreview({ preset }: { preset: Preset }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!
    const ctx = c.getContext('2d')!
    const o: Overlay = { id: 'preview-' + preset.kind, kind: preset.kind, text: preset.text, start: 0, duration: Math.min(preset.duration, 3), color: preset.color }
    let raf = 0
    const loop = (now: number) => {
      const t = (now / 1000) % (o.duration + 0.6)
      const g = ctx.createLinearGradient(0, 0, c.width, c.height)
      g.addColorStop(0, '#2b2d42')
      g.addColorStop(1, '#5c4d7d')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, c.width, c.height)
      drawOverlay(ctx, c.width, c.height, o, t)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [preset])
  return <canvas ref={ref} width={320} height={180} />
}

const uid = () => Math.random().toString(36).slice(2, 10)
const fmt = (s: number) => {
  s = Math.max(0, s)
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

type ClipInfo = { id: string; name: string; kind: Clip['kind']; url: string; duration: number }

function loadClip(file: File): Promise<Clip | null> {
  const url = URL.createObjectURL(file)
  const id = uid()
  const name = file.name.replace(/\.[^.]+$/, '')
  if (file.type.startsWith('image/')) {
    return new Promise((res) => {
      const img = new Image()
      img.onload = () => res({ id, name, kind: 'image', url, el: img, duration: 0 })
      img.onerror = () => res(null)
      img.src = url
    })
  }
  if (file.type.startsWith('video/') || file.type.startsWith('audio/') || /\.(mp4|mov|webm|m4v|mkv|mp3|wav|m4a|ogg)$/i.test(file.name)) {
    const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg)$/i.test(file.name)
    return new Promise((res) => {
      const el = document.createElement(isAudio ? 'audio' : 'video') as HTMLVideoElement
      el.preload = 'auto'
      el.playsInline = true
      el.muted = true
      el.crossOrigin = 'anonymous'
      el.onloadedmetadata = () =>
        res({ id, name, kind: isAudio ? 'audio' : 'video', url, el, duration: isFinite(el.duration) ? el.duration : 10 })
      el.onerror = () => res(null)
      el.src = url
    })
  }
  return Promise.resolve(null)
}

type EditSettings = {
  styleId: string
  voiceId: string | null
  voiceMode: 'intro' | 'over'
  words: TimedWord[] | null
  wordsFor: string | null
  script: string
  speed: number
  length: number
  handle: string
  filter: FilterKind | null
  onBeat: boolean
}

const PACES = [
  { label: 'Chill', v: 1.8 },
  { label: 'Normal', v: 1 },
  { label: 'Fast', v: 0.6 },
  { label: 'Insane', v: 0.4 },
]
const FILTER_LABELS: [FilterKind, string][] = [
  ['none', 'Original'],
  ['bw', 'B&W'],
  ['warm', 'Warm'],
  ['film', 'Moody'],
  ['vivid', 'Vivid'],
]

function StyleCard({ s, active, onClick }: { s: EditStyle; active: boolean; onClick: () => void }) {
  const a = ASPECT_SIZE[s.aspect]
  const sample = s.frame === 'card' ? 'RISE' : s.text === 'kinetic' ? 'DREAM' : 'WOW'
  return (
    <motion.button className={'style-card' + (active ? ' active' : '')} onClick={onClick} whileTap={{ scale: 0.97 }} whileHover={{ x: 3 }} transition={spring}>
      <div className={'style-prev ' + s.id + (s.aspect === '9:16' ? ' tall' : '')} style={{ aspectRatio: `${a.w}/${a.h}` }}>
        <div className={'style-inner frame-' + s.frame}>
          <span
            style={{
              fontFamily: s.text === 'kinetic' ? FONTS.serif : FONTS.pop,
              color: s.textColor,
              transform: s.text === 'kinetic' ? 'scaleX(0.6)' : undefined,
            }}
          >
            {sample}
          </span>
        </div>
      </div>
      <div className="style-text">
        <b>{s.name}</b>
        <span>{s.blurb}</span>
      </div>
    </motion.button>
  )
}

function TemplateThumb({ t, active, onClick }: { t: Template; active: boolean; onClick: () => void }) {
  const a = ASPECT_SIZE[t.aspect]
  return (
    <button className={'tpl' + (active ? ' active' : '')} onClick={onClick} title={t.name}>
      <div className={'tpl-frame' + (t.aspect === '9:16' ? ' tall' : '')} style={{ aspectRatio: `${a.w}/${a.h}` }}>
        {t.regions.map((r, i) => (
          <div
            key={i}
            className="tpl-box"
            style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
          />
        ))}
      </div>
      <span>{t.name}</span>
    </button>
  )
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const stageWrapRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const musicRef = useRef<HTMLInputElement>(null)
  const pickTarget = useRef<number | null>(null)

  const [clips, setClips] = useState<ClipInfo[]>([])
  const [aspectFilter, setAspectFilter] = useState<Aspect | 'all'>('all')
  const [project, setProject] = useState<Project>(() => ({
    mode: 'layout',
    montage: null,
    overlays: [],
    template: TEMPLATES[0],
    slots: TEMPLATES[0].regions.map(emptySlot),
    background: BACKGROUNDS[0],
    radius: 0.5,
    caption: { text: '', style: 'classic', pos: 'bottom' },
    musicId: null,
    musicVolume: 0.6,
    musicStart: 0,
    musicFadeIn: true,
    musicFadeOut: true,
    duck: true,
    clipVolume: 1,
    loopShort: true,
    imageSeconds: 5,
  }))
  const [selected, setSelected] = useState<number | null>(null)
  const [rightTab, setRightTab] = useState<'edit' | 'motion'>('edit')
  const [openOverlay, setOpenOverlay] = useState<string | null>(null)
  const [armed, setArmed] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const [time, setTime] = useState({ t: 0, total: 5, playing: false })
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 })
  const [exporting, setExporting] = useState<null | { progress: number; url?: string; ext?: string }>(null)
  const exportCancelled = useRef(false)
  const [edit, setEdit] = useState<EditSettings>({
    styleId: EDIT_STYLES[0].id,
    voiceId: null,
    voiceMode: 'intro',
    words: null,
    wordsFor: null,
    script: '',
    speed: 1,
    length: 12,
    handle: '',
    filter: null,
    onBeat: true,
  })
  const [beats, setBeats] = useState<(SongInfo & { id: string }) | null>(null)
  const [capStatus, setCapStatus] = useState<string | null>(null)
  const [fontsReady, setFontsReady] = useState(0)
  const patchEdit = (p: Partial<EditSettings>) => setEdit((e) => ({ ...e, ...p }))
  const style = EDIT_STYLES.find((x) => x.id === edit.styleId)!

  useEffect(() => {
    Promise.all(
      ['48px Anton', '700 48px "Playfair Display"', '400 48px "Playfair Display"', '48px "Great Vibes"'].map((f) => document.fonts.load(f)),
    )
      .catch(() => {})
      .then(() => setFontsReady((n) => n + 1))
  }, [])

  // find the beat of the song so cuts can land on it
  useEffect(() => {
    const id = project.musicId
    if (!id || beats?.id === id) return
    const c = clips.find((x) => x.id === id)
    if (!c) return
    let alive = true
    detectBeats(c.url)
      .then((b) => alive && setBeats({ id, ...b }))
      .catch((e) => console.warn('beat detection failed', e))
    return () => {
      alive = false
    }
  }, [project.musicId, clips, beats?.id])

  const montage: Montage | null = useMemo(() => {
    const visual = clips.filter((c) => c.kind !== 'audio')
    const voice = edit.voiceId ? clips.find((c) => c.id === edit.voiceId && c.kind === 'video') ?? null : null
    const songBeats =
      edit.onBeat && beats && beats.id === project.musicId ? beats.beats.map((b) => b - project.musicStart).filter((b) => b >= 0) : null
    const timeline = plan({
      style,
      clips: visual,
      voice,
      voiceMode: edit.voiceMode,
      words: voice && edit.wordsFor === voice.id ? edit.words : null,
      script: edit.script,
      speed: edit.speed,
      length: edit.length,
      beats: songBeats,
      handle: edit.handle,
    })
    return { timeline, style, filter: edit.filter ?? style.filter, handle: edit.handle }
  }, [clips, edit, style, beats, project.musicId, project.musicStart])

  // engine lifecycle
  useEffect(() => {
    const e = new Engine(canvasRef.current!)
    engineRef.current = e
    ;(window as unknown as { fastcut: Engine }).fastcut = e // handy for debugging
    e.setProject(project)
    let last = 0
    e.onTick = (t, total, playing) => {
      const now = performance.now()
      if (now - last > 100 || !playing) {
        last = now
        setTime((p) => (p.t === t && p.total === total && p.playing === playing ? p : { t, total, playing }))
      }
    }
    return () => e.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    engineRef.current?.setProject({ ...project, montage })
  }, [project, montage, fontsReady])

  const isMontage = project.mode === 'montage'
  const stageAspect: Aspect = isMontage ? style.aspect : project.template.aspect

  // fit stage into available space
  useLayoutEffect(() => {
    const el = stageWrapRef.current!
    const ro = new ResizeObserver(() => {
      const a = ASPECT_SIZE[stageAspect]
      const W = el.clientWidth
      const H = el.clientHeight
      const scale = Math.min(W / a.w, H / a.h)
      setStageSize({ w: Math.floor(a.w * scale), h: Math.floor(a.h * scale) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [stageAspect])

  const update = useCallback((fn: (p: Project) => Project) => setProject((p) => fn(p)), [])

  const updateSlot = (i: number, patch: Partial<Slot>) =>
    update((p) => {
      const slots = [...p.slots]
      slots[i] = { ...slots[i], ...patch }
      return { ...p, slots }
    })

  /** Put a clip in a region. If it's already elsewhere, the two regions swap. */
  const place = (i: number, clipId: string) =>
    update((p) => {
      const slots = [...p.slots]
      const from = slots.findIndex((s, k) => k < p.template.regions.length && s.clipId === clipId)
      if (from === i) return p
      if (from >= 0) {
        const tmp = slots[i]
        slots[i] = slots[from]
        slots[from] = tmp
      } else {
        // first clip with sound gets audio on by default
        const anySound = slots.some((s, k) => k < p.template.regions.length && s.clipId && !s.muted)
        slots[i] = { ...emptySlot(), clipId, muted: anySound }
      }
      return { ...p, slots }
    })

  const swapSlots = (a: number, b: number) =>
    update((p) => {
      const slots = [...p.slots]
      const tmp = slots[a]
      slots[a] = slots[b]
      slots[b] = tmp
      return { ...p, slots }
    })

  const addFiles = async (files: FileList | File[], targetRegion?: number | null) => {
    const loaded = (await Promise.all(Array.from(files).map(loadClip))).filter(Boolean) as Clip[]
    if (!loaded.length) return
    const e = engineRef.current!
    loaded.forEach((c) => e.addClip(c))
    setClips((cs) => [...cs, ...loaded.map(({ id, name, kind, url, duration }) => ({ id, name, kind, url, duration }))])
    const visual = loaded.filter((c) => c.kind !== 'audio')
    const audio = loaded.find((c) => c.kind === 'audio')
    update((p) => {
      const n = p.template.regions.length
      const slots = [...p.slots]
      while (slots.length < n) slots.push(emptySlot())
      // fill target first, then empty boxes from the biggest down
      const order = [...Array(n).keys()].sort(
        (a, b) => p.template.regions[b].w * p.template.regions[b].h - p.template.regions[a].w * p.template.regions[a].h,
      )
      let anySound = slots.some((s, k) => k < n && s.clipId && !s.muted)
      visual.forEach((c, idx) => {
        const k = idx === 0 && targetRegion != null && targetRegion < n ? targetRegion : order.find((k) => !slots[k].clipId)
        if (k == null) return
        slots[k] = { ...emptySlot(), clipId: c.id, muted: anySound || c.kind !== 'video' }
        if (c.kind === 'video') anySound = true
      })
      return { ...p, slots, musicId: audio ? audio.id : p.musicId, musicStart: audio ? 0 : p.musicStart }
    })
  }

  const moveClip = (id: string, beforeId: string) =>
    setClips((cs) => {
      const from = cs.findIndex((c) => c.id === id)
      if (from < 0 || id === beforeId) return cs
      const next = [...cs]
      const [c] = next.splice(from, 1)
      next.splice(next.findIndex((x) => x.id === beforeId), 0, c)
      return next
    })

  const addOverlay = (pr: Preset) => {
    const total = engineRef.current?.totalDuration() ?? 5
    const duration = pr.full ? total : Math.min(pr.duration, total)
    const start = pr.full ? 0 : Math.max(0, Math.min(time.t, total - duration))
    const o: Overlay = { id: uid(), kind: pr.kind, text: pr.text, start, duration, color: pr.color }
    update((p) => ({ ...p, overlays: [...p.overlays, o] }))
    setOpenOverlay(o.id)
    engineRef.current?.seek(start)
  }
  const patchOverlay = (id: string, patch: Partial<Overlay>) =>
    update((p) => ({ ...p, overlays: p.overlays.map((o) => (o.id === id ? { ...o, ...patch } : o)) }))

  const autoCaption = async () => {
    const v = clips.find((c) => c.id === edit.voiceId)
    if (!v) return
    try {
      const words = await transcribe(v.url, setCapStatus)
      if (!words.length) {
        setCapStatus('No speech found in that clip.')
        return
      }
      patchEdit({ words, wordsFor: v.id, script: words.map((w) => w.text).join(' ') })
      setCapStatus(null)
    } catch (e) {
      console.error(e)
      setCapStatus('Auto-captions could not load. Check your connection and try again.')
    }
  }

  const removeClipEverywhere = (id: string) => {
    if (edit.voiceId === id) patchEdit({ voiceId: null, words: null, wordsFor: null })
    engineRef.current?.removeClip(id)
    setClips((cs) => cs.filter((c) => c.id !== id))
    update((p) => ({
      ...p,
      slots: p.slots.map((s) => (s.clipId === id ? emptySlot() : s)),
      musicId: p.musicId === id ? null : p.musicId,
    }))
  }

  const chooseTemplate = (t: Template) => {
    update((p) => {
      // biggest box's clip goes to the new biggest box, and so on
      const area = (tp: Template, i: number) => tp.regions[i].w * tp.regions[i].h
      const bySize = (tp: Template) => [...tp.regions.keys()].sort((a, b) => area(tp, b) - area(tp, a))
      const oldN = p.template.regions.length
      const placed = [
        ...bySize(p.template).map((i) => p.slots[i]),
        ...p.slots.slice(oldN), // leftovers from earlier switches
      ].filter((s) => s?.clipId)
      const slots: Slot[] = t.regions.map(emptySlot)
      bySize(t).forEach((i, k) => placed[k] && (slots[i] = placed[k]))
      return { ...p, template: t, slots: [...slots, ...placed.slice(t.regions.length)] }
    })
    setSelected(null)
  }

  const togglePlay = () => {
    const e = engineRef.current!
    e.playing ? e.pause() : e.play()
  }

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.code === 'Space' && !(ev.target instanceof HTMLInputElement) && !(ev.target instanceof HTMLTextAreaElement)) {
        ev.preventDefault()
        togglePlay()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const startExport = async () => {
    const e = engineRef.current!
    if (!canExport) return
    exportCancelled.current = false
    setSelected(null)
    setExporting({ progress: 0 })
    try {
      const { blob, ext } = await e.export((f) => setExporting((x) => (x && !x.url ? { progress: f } : x)))
      if (exportCancelled.current) return
      setExporting({ progress: 1, url: URL.createObjectURL(blob), ext })
    } catch (err) {
      console.error(err)
      alert('Sorry, export failed in this browser. Try the latest Chrome, Edge or Safari.')
      setExporting(null)
    }
  }

  const n = project.template.regions.length
  const visibleClips = clips.filter((c) => c.kind !== 'audio')
  const audioClips = clips.filter((c) => c.kind === 'audio')
  const usedIds = new Set(project.slots.slice(0, n).map((s) => s.clipId))
  const filled = project.slots.slice(0, n).filter((s) => s.clipId).length
  const sel = selected != null && selected < n ? project.slots[selected] : null
  const selClip = sel?.clipId ? clips.find((c) => c.id === sel.clipId) : null
  const montageReady = isMontage && (visibleClips.length > 0 || !!edit.voiceId)
  const canExport = isMontage ? montageReady : filled > 0
  const step = (isMontage ? montageReady : filled > 0) ? 3 : 2
  const videoClips = clips.filter((c) => c.kind === 'video')
  const order = new Map(visibleClips.filter((c) => c.id !== edit.voiceId).map((c, i) => [c.id, i + 1]))

  return (
    <div
      className="app"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
      }}
    >
      <header className="topbar">
        <div className="logo">
          <span className="logo-mark">▶</span> FastCut
        </div>
        <ol className="steps">
          <li className={step >= 1 ? 'done' : ''}>{isMontage ? 'Pick a style' : 'Pick a template'}</li>
          <li className={step === 2 ? 'now' : step > 2 ? 'done' : ''}>{isMontage ? 'Add your clips' : 'Drag clips into the boxes'}</li>
          <li className={step === 3 ? 'now' : ''}>Export</li>
        </ol>
        <button className="btn primary" disabled={!canExport} onClick={startExport}>
          ⬇ Export video
        </button>
      </header>

      <aside className="panel left">
        <div className="mode-tabs">
          {(['layout', 'montage'] as const).map((m) => (
            <button key={m} className={project.mode === m ? 'on' : ''} onClick={() => (update((p) => ({ ...p, mode: m })), setSelected(null))}>
              {project.mode === m && <motion.span layoutId="mtab" className="tab-pill" transition={spring} />}
              <span>{m === 'layout' ? '🧩 Layouts' : '⚡ Fast edits'}</span>
            </button>
          ))}
        </div>
        {isMontage ? (
          <>
            <h3>1. Pick a style</h3>
            <div className="style-list">
              {EDIT_STYLES.map((s) => (
                <StyleCard key={s.id} s={s} active={s.id === edit.styleId} onClick={() => patchEdit({ styleId: s.id, filter: null })} />
              ))}
            </div>
          </>
        ) : (
        <>
        <h3>1. Templates</h3>
        <div className="chips">
          {(['all', '16:9', '9:16', '1:1'] as const).map((a) => (
            <button key={a} className={'chip' + (aspectFilter === a ? ' on' : '')} onClick={() => setAspectFilter(a)}>
              {a === 'all' ? 'All' : a === '16:9' ? 'Wide' : a === '9:16' ? 'Tall' : 'Square'}
            </button>
          ))}
        </div>
        <div className="tpl-grid">
          {TEMPLATES.filter((t) => aspectFilter === 'all' || t.aspect === aspectFilter).map((t) => (
            <TemplateThumb key={t.id} t={t} active={t.id === project.template.id} onClick={() => chooseTemplate(t)} />
          ))}
        </div>
        </>
        )}
      </aside>

      <main className="center">
        <div className="stage-wrap" ref={stageWrapRef} style={{ ['--ar' as string]: `${ASPECT_SIZE[project.template.aspect].w} / ${ASPECT_SIZE[project.template.aspect].h}` }}>
          <div className="stage" style={{ width: stageSize.w, height: stageSize.h }}>
            <canvas ref={canvasRef} />
            {isMontage && !montageReady && (
              <button className="montage-drop" onClick={() => ((pickTarget.current = null), fileRef.current?.click())}>
                <span className="plus">+</span>
                <b>Drop all your clips here</b>
                <span>Videos and photos. We'll cut them together for you.</span>
              </button>
            )}
            {!isMontage && project.template.regions.map((r, i) => {
              const s = project.slots[i]
              const has = !!s?.clipId
              return (
                <div
                  key={project.template.id + i}
                  className={
                    'region' +
                    (has ? ' filled' : '') +
                    (selected === i ? ' selected' : '') +
                    (dragOver === i ? ' over' : '') +
                    (armed && !has ? ' armed' : '')
                  }
                  style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
                  draggable={has}
                  onDragStart={(e) => e.dataTransfer.setData('text/fastcut-slot', String(i))}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setDragOver(i)
                  }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setDragOver(null)
                    const slot = e.dataTransfer.getData('text/fastcut-slot')
                    const clip = e.dataTransfer.getData('text/fastcut-clip')
                    if (slot !== '') swapSlots(Number(slot), i)
                    else if (clip) place(i, clip)
                    else if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files, i)
                    setSelected(i)
                  }}
                  onClick={() => {
                    if (armed) {
                      place(i, armed)
                      setArmed(null)
                      setSelected(i)
                    } else if (has) {
                      setSelected(selected === i ? null : i)
                      setRightTab('edit')
                    }
                    else {
                      pickTarget.current = i
                      fileRef.current?.click()
                    }
                  }}
                >
                  {!has && (
                    <div className="region-empty">
                      <span className="plus">+</span>
                      <span className="hint">{armed ? 'Tap to put it here' : 'Drop a clip'}</span>
                    </div>
                  )}
                  {has && !s.muted && <span className="badge">🔊</span>}
                </div>
              )
            })}
          </div>
        </div>

        <div className="transport">
          <button className="play" onClick={togglePlay} aria-label={time.playing ? 'Pause' : 'Play'}>
            {time.playing ? '❚❚' : '▶'}
          </button>
          <span className="time">{fmt(time.t)}</span>
          <input
            type="range"
            min={0}
            max={time.total}
            step={0.01}
            value={Math.min(time.t, time.total)}
            onChange={(e) => engineRef.current?.seek(Number(e.target.value))}
          />
          <span className="time">{fmt(time.total)}</span>
        </div>

        <section className="audio-bar">
          <div className="audio-head">
            <h3>🎵 Audio</h3>
            {project.musicId ? (
              <>
                <span className="song-name">{audioClips.find((c) => c.id === project.musicId)?.name}</span>
                <button className="btn tiny" onClick={() => musicRef.current?.click()}>
                  Change song
                </button>
                <button className="btn tiny danger" onClick={() => update((p) => ({ ...p, musicId: null }))}>
                  Remove
                </button>
              </>
            ) : (
              <button className="btn tiny" onClick={() => musicRef.current?.click()}>
                + Add a song (MP3)
              </button>
            )}
          </div>
          {project.musicId && beats?.id === project.musicId && (
            <>
              <SongStrip
                song={beats}
                start={project.musicStart}
                length={time.total}
                t={time.t}
                fadeIn={project.musicFadeIn}
                fadeOut={project.musicFadeOut}
                onStart={(st) => update((p) => ({ ...p, musicStart: st }))}
              />
              <p className="hint-text strip-hint">Drag the pink part to choose which bit of the song plays.</p>
            </>
          )}
          {project.musicId && beats?.id !== project.musicId && <p className="hint-text">Reading the song…</p>}
          <div className="audio-controls">
            {project.musicId && (
              <label className="knob">
                <span>Song {Math.round(project.musicVolume * 100)}%</span>
                <input type="range" min={0} max={1} step={0.05} value={project.musicVolume} onChange={(e) => update((p) => ({ ...p, musicVolume: Number(e.target.value) }))} />
              </label>
            )}
            {(!isMontage || edit.voiceId) && (
            <label className="knob">
              <span>
                {isMontage ? 'Voice' : 'Clip sound'} {project.clipVolume === 0 ? '(muted)' : Math.round(project.clipVolume * 100) + '%'}
              </span>
              <input type="range" min={0} max={1.5} step={0.05} value={project.clipVolume} onChange={(e) => update((p) => ({ ...p, clipVolume: Number(e.target.value) }))} />
            </label>
            )}
            {project.musicId && (
              <div className="toggles">
                <button className={'toggle' + (project.musicFadeIn ? ' on' : '')} onClick={() => update((p) => ({ ...p, musicFadeIn: !p.musicFadeIn }))}>
                  Fade in
                </button>
                <button className={'toggle' + (project.musicFadeOut ? ' on' : '')} onClick={() => update((p) => ({ ...p, musicFadeOut: !p.musicFadeOut }))}>
                  Fade out
                </button>
                {isMontage && edit.voiceId && (
                  <button className={'toggle' + (project.duck ? ' on' : '')} onClick={() => update((p) => ({ ...p, duck: !p.duck }))}>
                    Quieter when I talk
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="bin">
          <div className="bin-head">
            <h3>Your clips</h3>
            <span className="muted">
              {isMontage ? 'They play in this order. Drag to reorder.' : 'Drag a clip onto a box — or tap a clip, then tap a box.'}
            </span>
            <button className="btn" onClick={() => ((pickTarget.current = null), fileRef.current?.click())}>
              + Add clips
            </button>
          </div>
          <div className="bin-list">
            {visibleClips.length === 0 && (
              <button className="bin-empty" onClick={() => ((pickTarget.current = null), fileRef.current?.click())}>
                Drop videos or photos anywhere on this page, or click to browse.
              </button>
            )}
            {visibleClips.map((c) => (
              <div
                key={c.id}
                className={
                  'clip' + (!isMontage && usedIds.has(c.id) ? ' used' : '') + (armed === c.id ? ' armed' : '') + (isMontage ? ' ordered' : '')
                }
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/fastcut-clip', c.id)}
                onDragOver={(e) => isMontage && e.preventDefault()}
                onDrop={(e) => {
                  if (!isMontage) return
                  const id = e.dataTransfer.getData('text/fastcut-clip')
                  if (!id) return
                  e.preventDefault()
                  e.stopPropagation()
                  moveClip(id, c.id)
                }}
                onClick={() => !isMontage && setArmed(armed === c.id ? null : c.id)}
                title={c.name}
              >
                {c.kind === 'video' ? <video src={c.url + '#t=0.1'} muted preload="metadata" /> : <img src={c.url} alt="" />}
                <span className="clip-name">{c.name}</span>
                {c.kind === 'video' && <span className="clip-dur">{fmt(c.duration)}</span>}
                {isMontage && (
                  <span className={'clip-num' + (c.id === edit.voiceId ? ' voice' : '')}>{c.id === edit.voiceId ? '🎤' : order.get(c.id)}</span>
                )}
                <button
                  className="x"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeClipEverywhere(c.id)
                  }}
                  aria-label="Remove clip"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>

      <aside className="panel right">
        <div className="mode-tabs small">
          {(['edit', 'motion'] as const).map((k) => (
            <button key={k} className={rightTab === k ? 'on' : ''} onClick={() => setRightTab(k)}>
              {rightTab === k && <motion.span layoutId="rtab" className="tab-pill" transition={spring} />}
              <span>{k === 'edit' ? '⚙️ Settings' : '✨ Motion'}</span>
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait" initial={false}>
        <motion.div key={rightTab} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }}>
        {rightTab === 'motion' ? (
          <>
            <h3>Add motion graphics</h3>
            <p className="hint-text top">Tap one to drop it in at the playhead. They're saved into your video.</p>
            <div className="fx-grid">
              {PRESETS.map((pr) => (
                <motion.button key={pr.kind} className="fx" onClick={() => addOverlay(pr)} whileHover={{ y: -3 }} whileTap={{ scale: 0.94 }} transition={spring}>
                  <OverlayPreview preset={pr} />
                  <span>{pr.name}</span>
                </motion.button>
              ))}
            </div>
            {project.overlays.length > 0 && <h3>In your video</h3>}
            <div className="fx-list">
              <AnimatePresence initial={false}>
                {project.overlays.map((o) => {
                  const pr = PRESETS.find((x) => x.kind === o.kind)!
                  const open = openOverlay === o.id
                  const total = time.total
                  return (
                    <motion.div
                      key={o.id}
                      layout
                      className={'fx-item' + (open ? ' open' : '')}
                      initial={{ opacity: 0, scale: 0.9, height: 0 }}
                      animate={{ opacity: 1, scale: 1, height: 'auto' }}
                      exit={{ opacity: 0, scale: 0.9, height: 0 }}
                      transition={spring}
                    >
                      <button className="fx-head" onClick={() => (setOpenOverlay(open ? null : o.id), engineRef.current?.seek(o.start))}>
                        <span className="dot" style={{ background: o.color }} />
                        <b>{pr.name}</b>
                        <span className="muted">
                          {fmt(o.start)}–{fmt(o.start + o.duration)}
                        </span>
                      </button>
                      {open && (
                        <div className="fx-body">
                          {pr.hasText && (
                            <input className="text" value={o.text} maxLength={40} onChange={(e) => patchOverlay(o.id, { text: e.target.value })} />
                          )}
                          <div className="swatches small">
                            {OVERLAY_COLORS.map((c) => (
                              <button
                                key={c}
                                className={'swatch' + (o.color === c ? ' on' : '')}
                                style={{ background: c }}
                                onClick={() => patchOverlay(o.id, { color: c })}
                                aria-label={c}
                              />
                            ))}
                          </div>
                          <label>
                            Starts at <b>{fmt(o.start)}</b>
                          </label>
                          <input
                            type="range"
                            min={0}
                            max={Math.max(0, total - 0.5)}
                            step={0.05}
                            value={o.start}
                            onChange={(e) => {
                              patchOverlay(o.id, { start: Number(e.target.value) })
                              engineRef.current?.seek(Number(e.target.value))
                            }}
                          />
                          <label>
                            Lasts <b>{o.duration.toFixed(1)}s</b>
                          </label>
                          <input
                            type="range"
                            min={0.5}
                            max={Math.max(1, total)}
                            step={0.1}
                            value={o.duration}
                            onChange={(e) => patchOverlay(o.id, { duration: Number(e.target.value) })}
                          />
                          <button className="btn danger full" onClick={() => update((p) => ({ ...p, overlays: p.overlays.filter((x) => x.id !== o.id) }))}>
                            Remove
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </>
        ) : isMontage ? (
          <>
            <h3>Talking clip</h3>
            <div className="field">
              <select
                className="text"
                value={edit.voiceId ?? ''}
                onChange={(e) => patchEdit({ voiceId: e.target.value || null })}
              >
                <option value="">None — just music & clips</option>
                {videoClips.map((c) => (
                  <option key={c.id} value={c.id}>
                    🎤 {c.name}
                  </option>
                ))}
              </select>
            </div>
            {edit.voiceId && (
              <>
                <div className="field">
                  <div className="seg">
                    <button className={edit.voiceMode === 'intro' ? 'on' : ''} onClick={() => patchEdit({ voiceMode: 'intro' })}>
                      Show me first
                    </button>
                    <button className={edit.voiceMode === 'over' ? 'on' : ''} onClick={() => patchEdit({ voiceMode: 'over' })}>
                      Voice over clips
                    </button>
                  </div>
                </div>
                <button className="btn full magic" disabled={!!capStatus && !capStatus.startsWith('No') && !capStatus.startsWith('Auto')} onClick={autoCaption}>
                  ✨ Auto-caption what I say
                </button>
                {capStatus && <p className="status">{capStatus}</p>}
              </>
            )}

            <h3>Words on screen</h3>
            <div className="field">
              <textarea
                className="text"
                rows={4}
                placeholder={style.text === 'kinetic' ? 'Type your words. One phrase per line.' : 'Type your words. They pop up one at a time.'}
                value={edit.script}
                onChange={(e) => patchEdit({ script: e.target.value })}
              />
              {edit.words && edit.wordsFor === edit.voiceId && <p className="hint-text">Timed to your voice. You can fix typos.</p>}
            </div>

            {project.musicId && (
              <label className="check">
                <input type="checkbox" checked={edit.onBeat} onChange={(e) => patchEdit({ onBeat: e.target.checked })} />
                {beats?.id === project.musicId ? `Cut on the song's beat (${beats.bpm} BPM)` : 'Finding the beat…'}
              </label>
            )}

            <h3>Pace</h3>
            <div className="field">
              <div className="seg">
                {PACES.map((x) => (
                  <button key={x.label} className={edit.speed === x.v ? 'on' : ''} onClick={() => patchEdit({ speed: x.v })}>
                    {x.label}
                  </button>
                ))}
              </div>
            </div>
            {!(edit.voiceId && edit.voiceMode === 'over') && (
              <div className="field">
                <label>
                  Montage length: <b>{edit.length}s</b>
                </label>
                <input type="range" min={4} max={60} step={1} value={edit.length} onChange={(e) => patchEdit({ length: Number(e.target.value) })} />
              </div>
            )}

            <h3>Color</h3>
            <div className="field">
              <div className="seg wrap">
                {FILTER_LABELS.map(([k, l]) => (
                  <button key={k} className={(edit.filter ?? style.filter) === k ? 'on' : ''} onClick={() => patchEdit({ filter: k })}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <h3>End card</h3>
            <div className="field">
              <input className="text" placeholder="@yourname (optional)" value={edit.handle} maxLength={30} onChange={(e) => patchEdit({ handle: e.target.value })} />
            </div>
            <p className="tip">Tip: add a song and the cuts land on its beat automatically. Pick a talking clip to get auto-captions.</p>
          </>
        ) : sel && selClip ? (
          <>
            <h3>Selected box</h3>
            <div className="field">
              <label>Sound</label>
              <div className="seg">
                <button className={!sel.muted ? 'on' : ''} disabled={selClip.kind !== 'video'} onClick={() => updateSlot(selected!, { muted: false })}>
                  🔊 On
                </button>
                <button className={sel.muted ? 'on' : ''} onClick={() => updateSlot(selected!, { muted: true })}>
                  🔇 Off
                </button>
              </div>
            </div>
            <div className="field">
              <label>Fill the box</label>
              <div className="seg">
                <button className={sel.fit === 'cover' ? 'on' : ''} onClick={() => updateSlot(selected!, { fit: 'cover' })}>
                  Fill (crop)
                </button>
                <button className={sel.fit === 'contain' ? 'on' : ''} onClick={() => updateSlot(selected!, { fit: 'contain' })}>
                  Fit (no crop)
                </button>
              </div>
            </div>
            {selClip.kind === 'video' && (
              <div className="field">
                <label>
                  Start from <b>{fmt(sel.offset)}</b>
                </label>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, selClip.duration - 0.5)}
                  step={0.1}
                  value={sel.offset}
                  onChange={(e) => {
                    updateSlot(selected!, { offset: Number(e.target.value) })
                    engineRef.current?.seek(0)
                  }}
                />
              </div>
            )}
            <div className="row">
              <button
                className="btn"
                onClick={() => {
                  pickTarget.current = selected
                  fileRef.current?.click()
                }}
              >
                Replace
              </button>
              <button className="btn danger" onClick={() => (updateSlot(selected!, emptySlot()), setSelected(null))}>
                Empty box
              </button>
            </div>
            <button className="btn ghost full" onClick={() => setSelected(null)}>
              ← Back to style
            </button>
          </>
        ) : (
          <>
            <h3>Style</h3>
            <div className="field">
              <label>Background</label>
              <div className="swatches">
                {BACKGROUNDS.map((b) => (
                  <button
                    key={b}
                    className={'swatch' + (project.background === b ? ' on' : '')}
                    style={{ background: b }}
                    onClick={() => update((p) => ({ ...p, background: b }))}
                    aria-label={b}
                  />
                ))}
                <label className="swatch custom" title="Custom color">
                  <input type="color" value={project.background} onChange={(e) => update((p) => ({ ...p, background: e.target.value }))} />
                </label>
              </div>
            </div>
            <div className="field">
              <label>Rounded corners</label>
              <input type="range" min={0} max={1} step={0.05} value={project.radius} onChange={(e) => update((p) => ({ ...p, radius: Number(e.target.value) }))} />
            </div>

            <h3>Text</h3>
            <div className="field">
              <input
                className="text"
                placeholder="Type a caption…"
                value={project.caption.text}
                maxLength={60}
                onChange={(e) => update((p) => ({ ...p, caption: { ...p.caption, text: e.target.value } }))}
              />
            </div>
            <div className="field">
              <div className="seg">
                {(['classic', 'meme', 'box'] as const).map((s) => (
                  <button key={s} className={project.caption.style === s ? 'on' : ''} onClick={() => update((p) => ({ ...p, caption: { ...p.caption, style: s } }))}>
                    {s === 'classic' ? 'Classic' : s === 'meme' ? 'Yellow' : 'Boxed'}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <div className="seg">
                {(['top', 'middle', 'bottom'] as const).map((s) => (
                  <button key={s} className={project.caption.pos === s ? 'on' : ''} onClick={() => update((p) => ({ ...p, caption: { ...p.caption, pos: s } }))}>
                    {s[0].toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <h3>Timing</h3>
            <label className="check">
              <input type="checkbox" checked={project.loopShort} onChange={(e) => update((p) => ({ ...p, loopShort: e.target.checked }))} />
              Loop shorter clips until the longest ends
            </label>
            <div className="field">
              <label>
                Length if only photos: <b>{project.imageSeconds}s</b>
              </label>
              <input type="range" min={2} max={30} step={1} value={project.imageSeconds} onChange={(e) => update((p) => ({ ...p, imageSeconds: Number(e.target.value) }))} />
            </div>
            <p className="tip">Tip: click a filled box to change its sound, crop or start time. Drag one box onto another to swap them.</p>
          </>
        )}
        </motion.div>
        </AnimatePresence>
      </aside>

      <input
        ref={fileRef}
        type="file"
        accept="video/*,image/*,audio/*,.mp3,.m4a,.wav"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files, pickTarget.current)
          e.target.value = ''
        }}
      />
      <input
        ref={musicRef}
        type="file"
        accept="audio/*,.mp3,.m4a,.wav"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          const c = await loadClip(f)
          if (!c) return
          engineRef.current!.addClip(c)
          setClips((cs) => [...cs, { id: c.id, name: c.name, kind: 'audio', url: c.url, duration: c.duration }])
          update((p) => ({ ...p, musicId: c.id, musicStart: 0 }))
        }}
      />

      <AnimatePresence>
      {exporting && (
        <motion.div className="modal-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="modal" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }} transition={spring}>
            {!exporting.url ? (
              <>
                <h2>Making your video…</h2>
                <p className="muted">Keep this tab open and visible. It records in real time, so it takes as long as the video.</p>
                <div className="bar">
                  <div style={{ width: `${exporting.progress * 100}%` }} />
                </div>
                <p>{Math.round(exporting.progress * 100)}%</p>
                <button
                  className="btn"
                  onClick={() => {
                    exportCancelled.current = true
                    engineRef.current?.cancelExport()
                    setExporting(null)
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <h2>Your video is ready 🎉</h2>
                <video src={exporting.url} controls className="result" />
                <div className="row">
                  <a className="btn primary" href={exporting.url} download={`fastcut.${exporting.ext}`}>
                    ⬇ Download
                  </a>
                  <button className="btn" onClick={() => setExporting(null)}>
                    Back to editing
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  )
}
