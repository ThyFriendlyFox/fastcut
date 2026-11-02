import { Aspect, Rect } from './templates'

export type TransitionKind = 'cut' | 'flash' | 'slide' | 'slices' | 'diagonal' | 'zoom' | 'fade' | 'popin'
export type TextKind = 'pop' | 'kinetic' | 'none'
export type FilterKind = 'none' | 'bw' | 'warm' | 'film' | 'vivid'
export type FrameKind = 'full' | 'card' | 'letterbox'

export type EditStyle = {
  id: string
  name: string
  blurb: string
  aspect: Aspect
  frame: FrameKind
  cutEvery: number // seconds per shot when there's no song
  beatsPerCut: number // beats per shot when there is a song
  transitions: TransitionKind[]
  filter: FilterKind
  text: TextKind
  textColor: string
  punch: boolean // jump-zoom on the talking clip
}

export const EDIT_STYLES: EditStyle[] = [
  {
    id: 'highlight',
    name: 'Highlight Reel',
    blurb: 'White flashes, slides and pop-up boxes. Great for pets, trips and friends.',
    aspect: '16:9',
    frame: 'full',
    cutEvery: 1.1,
    beatsPerCut: 2,
    transitions: ['flash', 'slide', 'popin', 'slices', 'zoom', 'diagonal'],
    filter: 'none',
    text: 'pop',
    textColor: '#2ec4b6',
    punch: true,
  },
  {
    id: 'motivation',
    name: 'Motivation',
    blurb: 'Small movie card on black, lightning-fast cuts, big moody words.',
    aspect: '9:16',
    frame: 'card',
    cutEvery: 0.35,
    beatsPerCut: 1,
    transitions: ['cut'],
    filter: 'film',
    text: 'kinetic',
    textColor: '#ffffff',
    punch: false,
  },
  {
    id: 'hype',
    name: 'Hype',
    blurb: 'Full screen, a cut on every beat, zoom punches and flashes.',
    aspect: '9:16',
    frame: 'full',
    cutEvery: 0.45,
    beatsPerCut: 1,
    transitions: ['zoom', 'flash', 'cut', 'zoom', 'slices'],
    filter: 'vivid',
    text: 'pop',
    textColor: '#ffd23f',
    punch: true,
  },
  {
    id: 'talk',
    name: 'Talk + Captions',
    blurb: 'You talking with one word at a time on screen. Extra clips become b-roll.',
    aspect: '9:16',
    frame: 'full',
    cutEvery: 1.4,
    beatsPerCut: 2,
    transitions: ['flash', 'zoom'],
    filter: 'none',
    text: 'pop',
    textColor: '#ffffff',
    punch: true,
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    blurb: 'Movie bars, soft fades, warm color and elegant words.',
    aspect: '16:9',
    frame: 'letterbox',
    cutEvery: 1.8,
    beatsPerCut: 4,
    transitions: ['fade', 'fade', 'cut'],
    filter: 'warm',
    text: 'kinetic',
    textColor: '#ffffff',
    punch: false,
  },
  {
    id: 'memories',
    name: 'Memories',
    blurb: 'Black & white, slow fades, gentle words. Lovely for photos.',
    aspect: '1:1',
    frame: 'full',
    cutEvery: 2.2,
    beatsPerCut: 4,
    transitions: ['fade'],
    filter: 'bw',
    text: 'kinetic',
    textColor: '#ffffff',
    punch: false,
  },
]

export const FILTERS: Record<FilterKind, string> = {
  none: 'none',
  bw: 'grayscale(1) contrast(1.15)',
  warm: 'sepia(0.35) saturate(1.2) contrast(1.05)',
  film: 'saturate(0.75) contrast(1.2) brightness(0.9)',
  vivid: 'saturate(1.45) contrast(1.12)',
}

export type TimedWord = { text: string; t: number }
export type ClipMeta = { id: string; kind: 'video' | 'image' | 'audio'; duration: number }

export type Layer = { clipId: string; src: number; box?: Rect }
export type Shot = { start: number; end: number; layers: Layer[]; transition: TransitionKind }
export type Phrase = { start: number; end: number; words: TimedWord[] }
export type Use = { start: number; end: number; src: number }

export type Timeline = {
  total: number
  shots: Shot[]
  phrases: Phrase[]
  endCardStart: number | null
  uses: Map<string, Use[]>
  voiceId: string | null
  voiceEnd: number
}

export type PlanInput = {
  style: EditStyle
  clips: ClipMeta[] // visual clips in order
  voice: ClipMeta | null
  voiceMode: 'intro' | 'over'
  words: TimedWord[] | null // from auto-captions (times relative to the voice clip)
  script: string
  speed: number // 2 = chill, 1 = normal, 0.6 = fast, 0.4 = insane
  length: number // montage length when there's no voice-over
  beats: number[] | null
  handle: string
}

export const TRANSITION_TIME: Record<TransitionKind, number> = {
  cut: 0,
  flash: 0.3,
  slide: 0.3,
  slices: 0.4,
  diagonal: 0.35,
  zoom: 0.25,
  fade: 0.5,
  popin: 0.35,
}
const END_CARD = 2.5

// deterministic "random" so preview == export
const rand = (i: number) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

const POP_BOXES: Rect[] = [
  { x: 0.04, y: 0.06, w: 0.38, h: 0.38 },
  { x: 0.58, y: 0.56, w: 0.38, h: 0.38 },
  { x: 0.58, y: 0.06, w: 0.38, h: 0.38 },
  { x: 0.04, y: 0.56, w: 0.38, h: 0.38 },
]

export function plan(inp: PlanInput): Timeline {
  const { style, voice } = inp
  const montageClips = inp.clips.filter((c) => c.id !== voice?.id && c.kind !== 'audio')
  const handleOn = inp.handle.trim().length > 0

  let montageStart = 0
  let contentEnd: number
  if (voice && inp.voiceMode === 'intro') {
    montageStart = Math.min(voice.duration, 90)
    contentEnd = montageStart + (montageClips.length ? inp.length : 0)
  } else if (voice) {
    contentEnd = Math.min(voice.duration, 120)
  } else {
    contentEnd = inp.length
  }
  const total = contentEnd + (handleOn ? END_CARD : 0)

  // ----- cut points -----
  const cuts: number[] = []
  if (montageClips.length) {
    let first = montageStart
    if (voice && inp.voiceMode === 'over') first = Math.min(1.6, contentEnd) // show the speaker first
    if (inp.beats && inp.beats.length > 4) {
      const period = median(diff(inp.beats))
      let bpc = Math.max(1, Math.round(style.beatsPerCut * inp.speed))
      while (period * bpc < 0.22) bpc *= 2
      const usable = inp.beats.filter((b) => b >= first - 0.01)
      for (let i = 0; i < usable.length; i += bpc) if (usable[i] < total - 0.15) cuts.push(usable[i])
      if (!cuts.length || cuts[0] > first + 0.05) cuts.unshift(first)
      // fill past the end of the detected beats
      let t = cuts[cuts.length - 1] + period * bpc
      while (t < total - 0.15) {
        cuts.push(t)
        t += period * bpc
      }
    } else {
      const step = Math.max(0.18, style.cutEvery * inp.speed)
      let t = first
      let i = 0
      while (t < total - 0.15) {
        cuts.push(t)
        t += step * (0.85 + 0.3 * rand(i++))
      }
    }
  }

  // ----- shots -----
  const shots: Shot[] = []
  if (voice && (inp.voiceMode === 'intro' || inp.voiceMode === 'over')) {
    const end = cuts.length ? cuts[0] : total
    if (end > 0) shots.push({ start: 0, end, layers: [{ clipId: voice.id, src: 0 }], transition: 'cut' })
  }
  if (montageClips.length) {
    const useCount = new Map<string, number>()
    const plannedUses = new Map<string, number>()
    cuts.forEach((_, k) => {
      const c = montageClips[k % montageClips.length]
      plannedUses.set(c.id, (plannedUses.get(c.id) ?? 0) + 1)
    })
    let popCorner = 0
    cuts.forEach((start, k) => {
      const end = k + 1 < cuts.length ? cuts[k + 1] : total
      const c = montageClips[k % montageClips.length]
      const n = useCount.get(c.id) ?? 0
      useCount.set(c.id, n + 1)
      const m = plannedUses.get(c.id)!
      const len = end - start + 0.5
      let src = 0
      if (c.kind === 'video') {
        if (montageClips.length === 1) src = (start - cuts[0]) % Math.max(0.5, c.duration)
        else {
          const avail = Math.max(0, c.duration - len)
          src = m > 1 ? (avail * n) / (m - 1) : Math.min(avail, c.duration * 0.15)
        }
      }
      let transition: TransitionKind = shots.length === 0 ? 'cut' : style.transitions[k % style.transitions.length]
      if (k === 0 && shots.length && style.transitions.includes('flash')) transition = 'flash'
      const prev = shots[shots.length - 1]
      if (transition === 'popin') {
        // the new clip pops up in a box on top of the previous shot, which keeps playing
        if (!prev || prev.transition === 'popin' || montageClips.length < 2 || prev.layers[0].clipId === c.id) transition = 'flash'
        else {
          const bg = prev.layers[0]
          const bgClip = [...montageClips, ...(voice ? [voice] : [])].find((x) => x.id === bg.clipId)
          shots.push({
            start,
            end,
            transition,
            layers: [
              { clipId: bg.clipId, src: bgClip?.kind === 'video' ? bg.src + (start - prev.start) : 0 },
              { clipId: c.id, src, box: POP_BOXES[popCorner++ % POP_BOXES.length] },
            ],
          })
          return
        }
      }
      shots.push({ start, end, layers: [{ clipId: c.id, src }], transition })
    })
  }
  if (!shots.length) shots.push({ start: 0, end: total, layers: [], transition: 'cut' })
  shots[shots.length - 1].end = total

  // ----- clip uses (when each video element must be playing, and from where) -----
  const uses = new Map<string, Use[]>()
  const addUse = (id: string, u: Use) => {
    const list = uses.get(id) ?? []
    const last = list[list.length - 1]
    // merge if it's a continuation of the previous use
    if (last && u.start <= last.end + 0.05 && Math.abs(last.src + (u.start - last.start) - u.src) < 0.08) {
      last.end = Math.max(last.end, u.end)
    } else list.push(u)
    uses.set(id, list)
  }
  shots.forEach((s, i) => {
    const next = shots[i + 1]
    const overlap = next ? TRANSITION_TIME[next.transition] + (next.transition === 'popin' ? next.end - next.start : 0) : 0
    for (const l of s.layers) {
      if (voice && l.clipId === voice.id) continue
      addUse(l.clipId, { start: s.start, end: s.end + overlap, src: l.src })
    }
  })
  let voiceEnd = 0
  if (voice) {
    voiceEnd = inp.voiceMode === 'intro' ? montageStart : contentEnd
    uses.set(voice.id, [{ start: 0, end: voiceEnd + (inp.voiceMode === 'intro' && shots[1] ? TRANSITION_TIME[shots[1].transition] : 0), src: 0 }])
    // voice clip shown inside the montage too (over mode): always in sync with the audio
    for (const s of shots) for (const l of s.layers) if (l.clipId === voice.id) l.src = s.start
  }

  // ----- text -----
  const textEnd = handleOn ? contentEnd : total
  const phrases = style.text === 'none' ? [] : buildPhrases(inp, style.text, textEnd)

  return { total, shots, phrases, endCardStart: handleOn ? contentEnd : null, uses, voiceId: voice?.id ?? null, voiceEnd }
}

function buildPhrases(inp: PlanInput, kind: TextKind, textEnd: number): Phrase[] {
  const typed = inp.script.trim()
  let words: TimedWord[] = []
  let lines: string[][] | null = null
  if (inp.words && inp.words.length) {
    // auto-captions; if the user edited the text, keep timing when word counts match
    const edited = typed ? typed.split(/\s+/) : null
    if (edited && edited.length !== inp.words.length) {
      const a = inp.words[0].t
      const b = inp.words[inp.words.length - 1].t + 0.4
      words = edited.map((w, i) => ({ text: w, t: a + ((b - a) * i) / edited.length }))
    } else words = inp.words.map((w, i) => ({ text: edited ? edited[i] : w.text, t: w.t }))
  } else if (typed) {
    lines = typed
      .split(/\n+/)
      .map((l) => l.trim().split(/\s+/).filter(Boolean))
      .filter((l) => l.length)
    if (kind === 'kinetic' && lines.length === 1 && lines[0].length > 4) {
      const all = lines[0]
      lines = []
      for (let i = 0; i < all.length; i += 3) lines.push(all.slice(i, i + 3))
    }
    const flat = lines.flat()
    const start = 0.15
    const span = Math.max(0.5, textEnd - start - 0.3)
    if (kind === 'pop') {
      const per = span / flat.length
      words = flat.map((w, i) => ({ text: w, t: start + i * per }))
    } else {
      const per = span / lines.length
      lines.forEach((l, li) => {
        const step = Math.min(0.3, (per * 0.6) / l.length)
        l.forEach((w, wi) => words.push({ text: w, t: start + li * per + wi * step }))
      })
    }
  }
  if (!words.length) return []
  words = words.filter((w) => w.t < textEnd)

  if (kind === 'pop') {
    return words.map((w, i) => ({
      start: w.t,
      end: Math.min(i + 1 < words.length ? words[i + 1].t : w.t + 1.2, w.t + 1.2, textEnd),
      words: [w],
    }))
  }
  // kinetic: group into short phrases that build up word by word
  const phrases: Phrase[] = []
  if (lines && !inp.words) {
    let k = 0
    for (const l of lines) {
      const ws = words.slice(k, k + l.length)
      k += l.length
      if (ws.length) phrases.push({ start: ws[0].t, end: 0, words: ws })
    }
  } else {
    let cur: TimedWord[] = []
    words.forEach((w, i) => {
      const prev = words[i - 1]
      if (cur.length && (cur.length >= 4 || w.t - prev.t > 0.6 || /[.,!?]$/.test(prev.text))) {
        phrases.push({ start: cur[0].t, end: 0, words: cur })
        cur = []
      }
      cur.push(w)
    })
    if (cur.length) phrases.push({ start: cur[0].t, end: 0, words: cur })
  }
  phrases.forEach((p, i) => {
    const lastWord = p.words[p.words.length - 1].t
    p.end = Math.min(i + 1 < phrases.length ? phrases[i + 1].start : lastWord + 2.5, textEnd)
    if (p.end <= lastWord) p.end = lastWord + 0.3
  })
  return phrases
}

function diff(a: number[]) {
  return a.slice(1).map((v, i) => v - a[i])
}
function median(a: number[]) {
  const s = [...a].sort((x, y) => x - y)
  return s[Math.floor(s.length / 2)] || 0.5
}
