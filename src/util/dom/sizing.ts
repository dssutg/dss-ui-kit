import { clamp } from '@/util/math';

/**
 * The device pixel ratio, floored at 1.
 *
 * Sizing a canvas or a glyph by CSS pixels alone blurs it on a HiDPI screen, so renderers
 * multiply by this value and draw the larger backing store. The floor exists because a browser
 * reporting `0` or a zoomed-out ratio below one would otherwise shrink the backing store and make
 * the output blurry on an ordinary screen too — one device pixel is the cheapest safe minimum.
 */
export function getDpr() {
  return Math.max(1, window.devicePixelRatio || 1);
}

/**
 * A size that grows linearly with the media width, clamped to a fixed range.
 *
 * The proportional part is `growFactor / minDesktopWidth`: callers pick a reference layout width
 * (`minDesktopWidth`) and how much the size grows per unit of that width, so a font or an element
 * scales with the window rather than snapping at media-query boundaries. Clamping bounds the
 * result so narrow windows do not shrink text below legibility and wide ones do not balloon it.
 *
 * The values it works on are runtime numbers — a canvas renderer and chart code need a numeric
 * size to hand to drawing code, where a CSS `clamp()` expression cannot go. All defaults are
 * inert (0/0/0/0 with a 1-pixel reference), so a caller omitting arguments gets zero rather than
 * a surprise; the function never invents a size.
 */
export function getResponsiveSize(
  minSize = 0,
  maxSize = 0,
  growFactor = 0,
  mediaWidth = 0,
  minDesktopWidth = 1,
) {
  const size = (growFactor * mediaWidth) / minDesktopWidth;

  return clamp(size, minSize, maxSize);
}
