import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Clip, Engine, Project, Slot, emptySlot } from './engine'
import { ASPECT_SIZE, Aspect, BACKGROUNDS, TEMPLATES, Template } from './templates'

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
    template: TEMPLATES[0],
    slots: TEMPLATES[0].regions.map(emptySlot),
    background: BACKGROUNDS[0],
    radius: 0.5,
    caption: { text: '', style: 'classic', pos: 'bottom' },
    musicId: null,
    musicVolume: 0.6,
    loopShort: true,
    imageSeconds: 5,
  }))
  const [selected, setSelected] = useState<number | null>(null)
  const [armed, setArmed] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const [time, setTime] = useState({ t: 0, total: 5, playing: false })
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 })
  const [exporting, setExporting] = useState<null | { progress: number; url?: string; ext?: string }>(null)
  const exportCancelled = useRef(false)

  // engine lifecycle
  useEffect(() => {
    const e = new Engine(canvasRef.current!)
    engineRef.current = e
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
    engineRef.current?.setProject(project)
  }, [project])

  // fit stage into available space
  useLayoutEffect(() => {
    const el = stageWrapRef.current!
    const ro = new ResizeObserver(() => {
      const a = ASPECT_SIZE[project.template.aspect]
      const W = el.clientWidth
      const H = el.clientHeight
      const scale = Math.min(W / a.w, H / a.h)
      setStageSize({ w: Math.floor(a.w * scale), h: Math.floor(a.h * scale) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [project.template.aspect])

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
      return { ...p, slots, musicId: audio && !p.musicId ? audio.id : p.musicId }
    })
  }

  const removeClipEverywhere = (id: string) => {
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
    if (!e.activeSlots().length) return
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
  const step = filled === 0 ? 2 : 3

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
          <li className={step >= 1 ? 'done' : ''}>Pick a template</li>
          <li className={step === 2 ? 'now' : step > 2 ? 'done' : ''}>Drag clips into the boxes</li>
          <li className={step === 3 ? 'now' : ''}>Export</li>
        </ol>
        <button className="btn primary" disabled={!filled} onClick={startExport}>
          ⬇ Export video
        </button>
      </header>

      <aside className="panel left">
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
      </aside>

      <main className="center">
        <div className="stage-wrap" ref={stageWrapRef} style={{ ['--ar' as string]: `${ASPECT_SIZE[project.template.aspect].w} / ${ASPECT_SIZE[project.template.aspect].h}` }}>
          <div className="stage" style={{ width: stageSize.w, height: stageSize.h }}>
            <canvas ref={canvasRef} />
            {project.template.regions.map((r, i) => {
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
                    } else if (has) setSelected(selected === i ? null : i)
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

        <section className="bin">
          <div className="bin-head">
            <h3>Your clips</h3>
            <span className="muted">Drag a clip onto a box — or tap a clip, then tap a box.</span>
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
                className={'clip' + (usedIds.has(c.id) ? ' used' : '') + (armed === c.id ? ' armed' : '')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/fastcut-clip', c.id)}
                onClick={() => setArmed(armed === c.id ? null : c.id)}
                title={c.name}
              >
                {c.kind === 'video' ? <video src={c.url + '#t=0.1'} muted preload="metadata" /> : <img src={c.url} alt="" />}
                <span className="clip-name">{c.name}</span>
                {c.kind === 'video' && <span className="clip-dur">{fmt(c.duration)}</span>}
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
        {sel && selClip ? (
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

            <h3>Music</h3>
            {project.musicId ? (
              <div className="field">
                <div className="music">
                  <span>🎵 {audioClips.find((c) => c.id === project.musicId)?.name}</span>
                  <button className="x inline" onClick={() => update((p) => ({ ...p, musicId: null }))} aria-label="Remove music">
                    ×
                  </button>
                </div>
                <label>Music volume</label>
                <input type="range" min={0} max={1} step={0.05} value={project.musicVolume} onChange={(e) => update((p) => ({ ...p, musicVolume: Number(e.target.value) }))} />
              </div>
            ) : (
              <button className="btn full" onClick={() => musicRef.current?.click()}>
                + Add a song
              </button>
            )}

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
      </aside>

      <input
        ref={fileRef}
        type="file"
        accept="video/*,image/*"
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
        accept="audio/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          const c = await loadClip(f)
          if (!c) return
          engineRef.current!.addClip(c)
          setClips((cs) => [...cs, { id: c.id, name: c.name, kind: 'audio', url: c.url, duration: c.duration }])
          update((p) => ({ ...p, musicId: c.id }))
        }}
      />

      {exporting && (
        <div className="modal-bg">
          <div className="modal">
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
          </div>
        </div>
      )}
    </div>
  )
}
