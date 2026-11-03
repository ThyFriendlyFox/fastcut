import { describe, expect, it } from 'vitest'
import { DEFAULT_FORMAT, TEMPLATES, outputSize } from './templates'

describe('outputSize', () => {
  it('follows the template ratio on Auto', () => {
    expect(outputSize(DEFAULT_FORMAT, '16:9')).toEqual({ w: 1920, h: 1080 })
    expect(outputSize(DEFAULT_FORMAT, '9:16')).toEqual({ w: 1080, h: 1920 })
  })

  it('uses quality as the short side', () => {
    expect(outputSize({ ...DEFAULT_FORMAT, shape: '4:5', quality: 720 }, '16:9')).toEqual({ w: 720, h: 900 })
    expect(outputSize({ ...DEFAULT_FORMAT, shape: '16:9', quality: 2160 }, '1:1')).toEqual({ w: 3840, h: 2160 })
  })

  it('clamps custom sizes and keeps them even', () => {
    expect(outputSize({ ...DEFAULT_FORMAT, shape: 'custom', customW: 1001, customH: 50 }, '16:9')).toEqual({ w: 1002, h: 240 })
    expect(outputSize({ ...DEFAULT_FORMAT, shape: 'custom', customW: 99999, customH: 720 }, '16:9')).toEqual({ w: 3840, h: 720 })
  })
})

describe('templates', () => {
  it('keeps every box inside the frame', () => {
    for (const t of TEMPLATES)
      for (const r of t.regions) {
        expect(r.x).toBeGreaterThanOrEqual(0)
        expect(r.y).toBeGreaterThanOrEqual(0)
        expect(r.x + r.w).toBeLessThanOrEqual(1.0001)
        expect(r.y + r.h).toBeLessThanOrEqual(1.0001)
      }
  })
})
