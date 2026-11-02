import type { Overlay } from './overlays'
import type { Format, Template } from './templates'
import type { CaptionPos, CaptionStyle } from './engine'
import type { FilterKind } from './montage'
import type { Xform } from './elements'

/** A template the user saved: box layout or Fast edits setup, plus motion graphics and size. */
export type UserTemplate = {
  id: string
  name: string
  createdAt: string
  kind: 'layout' | 'montage'
  format: Format
  overlays: Overlay[]
  // layout
  template?: Template
  background?: string
  radius?: number
  caption?: { text: string; style: CaptionStyle; pos: CaptionPos; xform?: Xform }
  // fast edits
  edit?: {
    styleId: string
    voiceMode: 'intro' | 'over'
    speed: number
    length: number
    handle: string
    filter: FilterKind | null
    onBeat: boolean
    textXform?: Xform
  }
}

const KEY = 'fastcut.templates.v1'

// Saved in this browser only. Storage can be missing (private mode), so every access is guarded.
export function loadUserTemplates(): UserTemplate[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveUserTemplates(list: UserTemplate[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // storage full or blocked: the templates stay for this session
  }
}
