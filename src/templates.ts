export type Rect = { x: number; y: number; w: number; h: number }
export type Aspect = '16:9' | '9:16' | '1:1'

export type Template = {
  id: string
  name: string
  aspect: Aspect
  regions: Rect[]
}

export const ASPECT_SIZE: Record<Aspect, { w: number; h: number }> = {
  '16:9': { w: 1920, h: 1080 },
  '9:16': { w: 1080, h: 1920 },
  '1:1': { w: 1080, h: 1080 },
}

// Regions are fractions of the canvas (0..1). Gap/margins are baked in.
const g = 0.02

export const TEMPLATES: Template[] = [
  {
    id: 'center-stage',
    name: 'Center Stage',
    aspect: '16:9',
    regions: [
      { x: 0.06, y: 0.14, w: 0.2, h: 0.32 },
      { x: 0.06, y: 0.54, w: 0.2, h: 0.32 },
      { x: 0.74, y: 0.14, w: 0.2, h: 0.32 },
      { x: 0.74, y: 0.54, w: 0.2, h: 0.32 },
      { x: 0.29, y: 0.14, w: 0.42, h: 0.72 },
    ],
  },
  {
    id: 'full',
    name: 'Full Screen',
    aspect: '16:9',
    regions: [{ x: 0, y: 0, w: 1, h: 1 }],
  },
  {
    id: 'side-by-side',
    name: 'Side by Side',
    aspect: '16:9',
    regions: [
      { x: g, y: 0.12, w: 0.5 - 1.5 * g, h: 0.76 },
      { x: 0.5 + g / 2, y: 0.12, w: 0.5 - 1.5 * g, h: 0.76 },
    ],
  },
  {
    id: 'pip',
    name: 'Picture in Picture',
    aspect: '16:9',
    regions: [
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 0.7, y: 0.64, w: 0.27, h: 0.3 },
    ],
  },
  {
    id: 'grid-4',
    name: 'Grid of 4',
    aspect: '16:9',
    regions: [
      { x: g, y: 2 * g, w: 0.5 - 1.5 * g, h: 0.5 - 3 * g },
      { x: 0.5 + g / 2, y: 2 * g, w: 0.5 - 1.5 * g, h: 0.5 - 3 * g },
      { x: g, y: 0.5 + g, w: 0.5 - 1.5 * g, h: 0.5 - 3 * g },
      { x: 0.5 + g / 2, y: 0.5 + g, w: 0.5 - 1.5 * g, h: 0.5 - 3 * g },
    ],
  },
  {
    id: 'trio',
    name: 'Three Up',
    aspect: '16:9',
    regions: [
      { x: g, y: 0.15, w: 1 / 3 - (4 / 3) * g, h: 0.7 },
      { x: 1 / 3 + g / 3, y: 0.15, w: 1 / 3 - (4 / 3) * g, h: 0.7 },
      { x: 2 / 3 - g / 3 + g, y: 0.15, w: 1 / 3 - (4 / 3) * g, h: 0.7 },
    ],
  },
  {
    id: 'spotlight',
    name: 'Spotlight',
    aspect: '16:9',
    regions: [
      { x: g, y: 2 * g, w: 0.68, h: 1 - 4 * g },
      { x: 0.68 + 2 * g, y: 2 * g, w: 0.32 - 3 * g, h: (1 - 6 * g) / 3 },
      { x: 0.68 + 2 * g, y: 3 * g + (1 - 6 * g) / 3, w: 0.32 - 3 * g, h: (1 - 6 * g) / 3 },
      { x: 0.68 + 2 * g, y: 1 - 2 * g - (1 - 6 * g) / 3, w: 0.32 - 3 * g, h: (1 - 6 * g) / 3 },
    ],
  },
  {
    id: 'story-full',
    name: 'Story',
    aspect: '9:16',
    regions: [{ x: 0, y: 0, w: 1, h: 1 }],
  },
  {
    id: 'reaction',
    name: 'Reaction',
    aspect: '9:16',
    regions: [
      { x: 0, y: 0, w: 1, h: 0.5 - g / 4 },
      { x: 0, y: 0.5 + g / 4, w: 1, h: 0.5 - g / 4 },
    ],
  },
  {
    id: 'story-stack',
    name: 'Triple Stack',
    aspect: '9:16',
    regions: [
      { x: 0.04, y: 0.03, w: 0.92, h: 0.3 },
      { x: 0.04, y: 0.35, w: 0.92, h: 0.3 },
      { x: 0.04, y: 0.67, w: 0.92, h: 0.3 },
    ],
  },
  {
    id: 'square-grid',
    name: 'Square Grid',
    aspect: '1:1',
    regions: [
      { x: g, y: g, w: 0.5 - 1.5 * g, h: 0.5 - 1.5 * g },
      { x: 0.5 + g / 2, y: g, w: 0.5 - 1.5 * g, h: 0.5 - 1.5 * g },
      { x: g, y: 0.5 + g / 2, w: 0.5 - 1.5 * g, h: 0.5 - 1.5 * g },
      { x: 0.5 + g / 2, y: 0.5 + g / 2, w: 0.5 - 1.5 * g, h: 0.5 - 1.5 * g },
    ],
  },
  {
    id: 'square-duo',
    name: 'Before / After',
    aspect: '1:1',
    regions: [
      { x: g, y: 0.2, w: 0.5 - 1.5 * g, h: 0.6 },
      { x: 0.5 + g / 2, y: 0.2, w: 0.5 - 1.5 * g, h: 0.6 },
    ],
  },
]

export const BACKGROUNDS = ['#0f0f14', '#ffffff', '#ff3d6e', '#ffd23f', '#3ddc97', '#4361ee', '#9b5de5', '#f3ece2']
