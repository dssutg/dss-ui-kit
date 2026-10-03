/**
 * Whether the element sits fully inside the visual viewport, edges inclusive.
 *
 * The comparison is against the viewport, not the document: an element scrolled out of view above
 * the fold is "outside" even though it is inside the page, which is what every caller — checking
 * whether a toast, a dropdown or a validation message is visible to the user right now — needs.
 * Each side is its own comparison rather than a single `intersects` because the answer wanted is
 * containment, not overlap: a straddling element is not fully on screen.
 *
 * `document.documentElement.clientHeight` is the fallback because `window.innerHeight` includes the
 * classic scrollbar and pre-dates `<html>`-based layouts.
 */
export function inViewport(element: Readonly<HTMLElement>) {
  const { top, bottom, left, right } = element.getBoundingClientRect();

  return (
    top >= 0 &&
    left >= 0 &&
    bottom <= (window.innerHeight ?? document.documentElement.clientHeight) &&
    right <= (window.innerWidth ?? document.documentElement.clientWidth)
  );
}

/**
 * Scrolls the page so `element` is visible, on the window's body-scroll only.
 *
 * The offset is computed as `elementRect.top - bodyRect.top - bias`: subtracting the body's own
 * top is what makes the arithmetic hold when the body carries a margin or an offset parent, and
 * `bias` is the caller's say in how much breathing room above the element to leave — typically the
 * height of a sticky header that would otherwise cover the scrolled-to element.
 *
 * Vertical only; horizontal position is untouched, which is the right shape for forms and step
 * flows where the page does not scroll sideways.
 */
export function scrollToElement(element: HTMLElement, bias: number, smooth: boolean) {
  const elementRect = element.getBoundingClientRect();
  const bodyRect = document.body.getBoundingClientRect();
  const offset = elementRect.top - bodyRect.top - bias;
  const behavior = smooth ? 'smooth' : 'instant';

  window.scrollTo({ top: offset, left: 0, behavior });
}

/**
 * Whether a point lies inside the rectangle, edges included — a hit on the border is still on the
 * element.
 *
 * The inclusive comparison matters for hit-testing a pointer against a canvas or a drag handle: an
 * exclusive version misses clicks aimed exactly at the boundary, where a drag often starts.
 */
export function DOMRectContainsPoint(rect: Readonly<DOMRect>, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/**
 * Whether two rectangles describe the same box.
 *
 * Exists for resize callbacks, which fire with fresh `DOMRect` objects even when nothing moved:
 * comparing field by field — rather than by reference or `Object.is` — is what lets a handler
 * recognise a no-op resize and skip the redraw. The reference check is a fast path, not the
 * definition: two distinct objects with equal bounds are equal.
 */
export function areDOMRectsEqual(rect1: DOMRect, rect2: DOMRect): boolean {
  return (
    rect1 === rect2 ||
    (rect1.left === rect2.left &&
      rect1.top === rect2.top &&
      rect1.right === rect2.right &&
      rect1.bottom === rect2.bottom &&
      rect1.width === rect2.width &&
      rect1.height === rect2.height)
  );
}
