import { describe, expect, it } from 'vitest'
import { NO_XFORM, boxToXform, snapCenter, xformBox } from './elements'

const base = { cx: 0.5, cy: 0.7, w: 0.4, h: 0.1 }

describe('move and resize', () => {
  it('leaves an untouched element where it was', () => {
    expect(xformBox(base, NO_XFORM)).toEqual(base)
  })

  it('round-trips a moved and resized box', () => {
    const target = { cx: 0.3, cy: 0.2, w: 0.6, h: 0.15 }
    const back = xformBox(base, boxToXform(base, target))
    expect(back.cx).toBeCloseTo(0.3)
    expect(back.cy).toBeCloseTo(0.2)
    expect(back.w).toBeCloseTo(0.6)
    expect(back.h).toBeCloseTo(0.15)
  })

  it('limits the scale to 0.2–6', () => {
    expect(boxToXform(base, { ...base, w: 0.001 }).scale).toBe(0.2)
    expect(boxToXform(base, { ...base, w: 100 }).scale).toBe(6)
  })

  it('snaps to the center lines when close', () => {
    const s = snapCenter({ cx: 0.508, cy: 0.3, w: 0.1, h: 0.1 })
    expect(s.box.cx).toBe(0.5)
    expect(s.vx).toBe(true)
    expect(s.hy).toBe(false)
  })
})
