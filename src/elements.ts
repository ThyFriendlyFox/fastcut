// Moving and resizing elements on the video. Positions are fractions of the frame (0..1).

/** Offset (fraction of frame) and uniform scale applied around an element's default spot. */
export type Xform = { dx: number; dy: number; scale: number }
export const NO_XFORM: Xform = { dx: 0, dy: 0, scale: 1 }

/** Center and size as fractions of the frame. */
export type Box = { cx: number; cy: number; w: number; h: number }

/** Where an element sits once its transform is applied. */
export function xformBox(base: Box, x: Xform = NO_XFORM): Box {
  return { cx: base.cx + x.dx, cy: base.cy + x.dy, w: base.w * x.scale, h: base.h * x.scale }
}

/** The transform that puts `base` at `target` (size taken from the width). */
export function boxToXform(base: Box, target: Box): Xform {
  return { dx: target.cx - base.cx, dy: target.cy - base.cy, scale: Math.max(0.2, Math.min(6, target.w / base.w)) }
}

/** Applies a transform to the canvas around a pixel anchor. */
export function applyXform(ctx: CanvasRenderingContext2D, W: number, H: number, ax: number, ay: number, x?: Xform) {
  if (!x || (x.dx === 0 && x.dy === 0 && x.scale === 1)) return
  ctx.translate(ax + x.dx * W, ay + x.dy * H)
  ctx.scale(x.scale, x.scale)
  ctx.translate(-ax, -ay)
}

const SNAP = 0.015
/** Snaps a moving box's center to the frame's center lines. Returns which guides are active. */
export function snapCenter(b: Box): { box: Box; vx: boolean; hy: boolean } {
  const vx = Math.abs(b.cx - 0.5) < SNAP
  const hy = Math.abs(b.cy - 0.5) < SNAP
  return { box: { ...b, cx: vx ? 0.5 : b.cx, cy: hy ? 0.5 : b.cy }, vx, hy }
}
