import type { Point2D } from '@/util/math';

/**
 * The first active touch of a pointer event, or `null` when there is none.
 *
 * A `TouchList` is empty the moment the last contact lifts, and `touchend` arrives in exactly that
 * state, so a handler that fires on touch cannot assume index zero exists — not even for `touchmove`,
 * which reports the touches still down rather than the one that moved. Four call sites needed this
 * and each had answered it differently: one asserted, one checked `length` first and then asserted
 * again, one silently treated a missing touch as the origin. The check belongs here so that the
 * answer is the same everywhere.
 */
export function firstTouch(event: TouchEvent | MouseEvent): Touch | null {
  return event instanceof TouchEvent ? event.touches.item(0) : null;
}

/**
 * The position of a pointer event, or `null` when it is a touch event with no active touch.
 *
 * Returns `null` rather than falling back to a default, because an absent position and a position at
 * the origin mean different things: one is an event to ignore, the other is a real drag to the
 * top-left corner.
 */
export function getPointerPosition(event: MouseEvent | TouchEvent): Point2D | null {
  if (event instanceof MouseEvent) {
    return { x: event.clientX, y: event.clientY };
  }

  const touch = firstTouch(event);

  return touch === null ? null : { x: touch.clientX, y: touch.clientY };
}
