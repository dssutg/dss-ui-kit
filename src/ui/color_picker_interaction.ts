import { clamp } from '@/lib/math';
import type { Interaction } from '@/ui/color_picker_types';

/** The position reported for a pointer event that carries no usable coordinates. */
const NO_INTERACTION: Interaction = { left: 0, top: 0 };

// Check if an event was triggered by touch
export function isTouch(event: MouseEvent | TouchEvent): event is TouchEvent {
  return 'touches' in event;
}

/**
 * The touch carrying `touchId`, or the first touch when none does.
 *
 * A drag can start on one finger and continue with another still resting on the panel, so the touch
 * that began it is tracked by identifier rather than assumed to still be the one moving. Returning
 * `null` when the list is empty lets the caller skip a move rather than read a coordinate from
 * nothing; every move handler here already has to tolerate a touch ending under it.
 */
function getTouchPoint(touches: TouchList, touchId: null | number): Touch | null {
  for (const touch of touches) {
    if (touch.identifier === touchId) {
      return touch;
    }
  }

  return touches.item(0);
}

/** How far one arrow-key press moves the handle, as a fraction of the handle's track. */
const ARROW_KEY_DELTA = 0.05;

/**
 * How far an arrow key moves the handle along one axis: `negativeKeyCode` moves it back, the
 * positive one forward, and any other key moves it not at all.
 */
function getAxisDelta(keyCode: number, negativeKeyCode: number, positiveKeyCode: number): number {
  if (keyCode === positiveKeyCode) {
    return ARROW_KEY_DELTA;
  }

  if (keyCode === negativeKeyCode) {
    return -ARROW_KEY_DELTA;
  }

  return 0;
}

// Finds the proper window object to fix iframe embedding issues
export function getParentWindow(node?: HTMLDivElement | null): Window {
  return node?.ownerDocument.defaultView || self;
}

// Returns a relative position of the pointer inside the node's bounding box
export const getRelativePosition = (
  node: HTMLDivElement,
  event: MouseEvent | TouchEvent,
  touchId: null | number,
): Interaction => {
  const rect = node.getBoundingClientRect();

  // Get user's pointer position from `touches` array if it's a `TouchEvent`
  const pointer = isTouch(event) ? getTouchPoint(event.touches, touchId) : event;

  // A move with no touch to read is a touch that ended between events. There is no position to
  // report, and returning the last one would drag the handle to where the finger left off.
  if (pointer === null) {
    return NO_INTERACTION;
  }

  const parent = getParentWindow(node);

  return {
    left: clamp((pointer.pageX - (rect.left + parent.scrollX)) / rect.width, 0, 1),
    top: clamp((pointer.pageY - (rect.top + parent.scrollY)) / rect.height, 0, 1),
  };
};

// Browsers introduced an intervention, making touch events passive by default.
// This workaround removes `preventDefault` call from the touch handlers.
// https://github.com/facebook/react/issues/19651
export const preventDefaultMove = (event: MouseEvent | TouchEvent): void => {
  !isTouch(event) && event.preventDefault();
};

// Prevent mobile browsers from handling mouse events (conflicting with touch ones).
// If we detected a touch interaction before, we prefer reacting to touch events only.
export const isInvalid = (event: MouseEvent | TouchEvent, hasTouch: boolean): boolean => {
  return hasTouch && !isTouch(event);
};

/**
 * Which finger a touch interaction belongs to.
 *
 * A multi-finger gesture produces one touch event per finger, and only the one that started on the
 * handle may move it. The identifier is what tells the later moves apart: without it, a second
 * finger landing anywhere in the document would drag the handle while the first was released.
 */
export function getTouchId(event: TouchEvent): number | null {
  return event.changedTouches.item(0)?.identifier ?? null;
}

/**
 * How far an arrow key moves the handle, as a fraction of the handle's track.
 *
 * Key codes (37 left, 38 up, 39 right, 40 down) are used instead of key names ('ArrowRight',
 * 'ArrowDown', and so on) to reduce the size of the library.
 */
export function getArrowKeyInteraction(event: KeyboardEvent): Interaction | null {
  const keyCode = event.which || event.keyCode;

  if (keyCode < 37 || keyCode > 40) {
    return null;
  }

  // Do not scroll the page by arrow keys while the handle has the focus.
  event.preventDefault();

  return {
    left: getAxisDelta(keyCode, 37, 39),
    top: getAxisDelta(keyCode, 38, 40),
  };
}
