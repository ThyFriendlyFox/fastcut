import { describe, expect, it } from 'vitest'
import { EDIT_STYLES, PlanInput, plan } from './montage'

const style = (id: string) => EDIT_STYLES.find((s) => s.id === id)!
const clips = ['a', 'b', 'c'].map((id) => ({ id, kind: 'video' as const, duration: 8 }))
const base: PlanInput = {
  style: style('highlight'),
  clips,
  voice: null,
  voiceMode: 'intro',
  words: null,
  script: '',
  speed: 1,
  length: 10,
  beats: null,
  handle: '',
}

describe('plan', () => {
  it('fills exactly the montage length', () => {
    const tl = plan(base)
    expect(tl.total).toBe(10)
    expect(tl.shots[0].start).toBe(0)
    expect(tl.shots[tl.shots.length - 1].end).toBe(10)
    tl.shots.slice(1).forEach((s, i) => expect(s.start).toBe(tl.shots[i].end))
  })

  it('is deterministic, so preview matches export', () => {
    expect(JSON.stringify(plan(base).shots)).toBe(JSON.stringify(plan(base).shots))
  })

  it('cuts on the beat', () => {
    const beats = Array.from({ length: 40 }, (_, i) => i * 0.5)
    const tl = plan({ ...base, beats })
    for (const s of tl.shots) expect(beats).toContain(s.start)
    // Highlight Reel cuts every 2 beats
    expect(tl.shots[1].start - tl.shots[0].start).toBeCloseTo(1)
  })

  it('adds a 2.5 s end card when a handle is set', () => {
    const tl = plan({ ...base, handle: '@me' })
    expect(tl.endCardStart).toBe(10)
    expect(tl.total).toBe(12.5)
  })

  it('shows the talking clip first, then the montage', () => {
    const voice = { id: 'v', kind: 'video' as const, duration: 4 }
    const tl = plan({ ...base, clips: [voice, ...clips], voice })
    expect(tl.shots[0].layers[0].clipId).toBe('v')
    expect(tl.shots[1].start).toBe(4)
    expect(tl.total).toBe(14)
    expect(tl.voiceEnd).toBe(4)
  })

  it('pops a new clip in a box over the still-playing previous one', () => {
    const tl = plan(base)
    const pop = tl.shots.find((s) => s.transition === 'popin')!
    expect(pop.layers).toHaveLength(2)
    expect(pop.layers[1].box).toBeDefined()
    const prev = tl.shots[tl.shots.indexOf(pop) - 1]
    expect(pop.layers[0].clipId).toBe(prev.layers[0].clipId)
    expect(pop.layers[0].src).toBeCloseTo(prev.layers[0].src + (pop.start - prev.start))
  })

  it('turns script lines into building phrases', () => {
    const tl = plan({ ...base, style: style('motivation'), script: 'stop scrolling\nget back to work' })
    expect(tl.phrases.map((p) => p.words.map((w) => w.text).join(' '))).toEqual(['stop scrolling', 'get back to work'])
  })

  it('shows one word at a time in pop styles', () => {
    const tl = plan({ ...base, script: 'one two three' })
    expect(tl.phrases).toHaveLength(3)
    expect(tl.phrases.every((p) => p.words.length === 1)).toBe(true)
  })

  it('plays a single clip continuously through the cuts', () => {
    const tl = plan({ ...base, clips: [clips[0]], length: 6 })
    expect(tl.uses.get('a')).toHaveLength(1)
  })
})
