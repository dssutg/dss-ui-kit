import { useEffect, useRef } from 'react';

/**
 * Touch-gesture recognition, decoupled from any one element.
 *
 * The class holds the gesture state and the callbacks; an element only meets it through
 * {@link Swipe.addListenersToElement}. A swipe never waits for the finger to lift: the direction is
 * settled on the first `touchmove` where the horizontal and vertical travel can be compared, the
 * matching callback fires, and the stroke ends there. Movement is measured from where the touch
 * started — `deltaX`/`deltaY` carry it signed, and the four callbacks take it from there — and the
 * `min*`/`max*` fields restrict where a stroke may begin, defaulting to the whole viewport.
 */
export class Swipe {
  /** Where the current touch came down; `null` between strokes. */
  downX: number | null;
  downY: number | null;

  /**
   * The rectangle a stroke must start inside, in client coordinates; `null` bounds mean the viewport
   * edge on that side. A stroke that begins outside — or moves outside, since the check runs on every
   * `touchmove` before any delta is taken — is discarded silently rather than reported, so a
   * caller reserving an edge of the screen for its own gesture does not receive the swipes it
   * excluded.
   */
  minX: number | null;
  maxX: number | null;
  minY: number | null;
  maxY: number | null;

  constructor() {
    this.downX = null;
    this.downY = null;

    this.minX = null;
    this.maxX = null;
    this.minY = null;
    this.maxY = null;
  }

  /**
   * The four swipe callbacks, one per direction, defaulting to no-ops so an uninterested direction
   * needs no handler. They are instance fields rather than prototype methods so a consumer's `useSwipe`
   * can replace one per render without touching the class.
   */
  onUpSwipe = (_event: Event, _deltaX: number, _deltaY: number) => {};
  onDownSwipe = (_event: Event, _deltaX: number, _deltaY: number) => {};
  onLeftSwipe = (_event: Event, _deltaX: number, _deltaY: number) => {};
  onRightSwipe = (_event: Event, _deltaX: number, _deltaY: number) => {};

  /** Records where the gesture began, and nothing else; the delta is computed per move. */
  onTouchStart = (event: TouchEvent) => {
    if (!event.touches[0]) {
      return;
    }

    this.downX = event.touches[0].clientX;
    this.downY = event.touches[0].clientY;
  };

  /** Not a public API: shared by {@link Swipe.onTouchMove} and the range fields above. */
  isSwipeInsideAllowedRange() {
    const { downX: x, downY: y } = this;

    if (x === null || y === null) {
      return false;
    }

    const minX = this.minX ?? 0;
    const maxX = this.maxX ?? window.innerWidth - 1;
    const minY = this.minY ?? 0;
    const maxY = this.maxY ?? window.innerHeight - 1;

    return x >= minX && x <= maxX && y >= minY && y <= maxY;
  }

  /**
   * Resolves one stroke and swallows it: the direction with the larger travel wins, and the gesture is
   * closed at once, so a stroke answers exactly one callback even if the finger keeps moving. Ties
   * (`diffX === diffY`) read as vertical. Listeners are attached non-passive so the browser's own
   * scroll does not cancel the gesture the element is being told about.
   */
  onTouchMove = (event: TouchEvent) => {
    if (this.downX === null || this.downY === null) {
      return;
    }

    if (!event.touches[0]) {
      return;
    }

    if (!this.isSwipeInsideAllowedRange()) {
      this.downX = null;
      this.downY = null;

      return;
    }

    const deltaX = this.downX - event.touches[0].clientX;
    const deltaY = this.downY - event.touches[0].clientY;

    const diffX = Math.abs(deltaX);
    const diffY = Math.abs(deltaY);

    if (diffX > diffY) {
      if (deltaX > 0) {
        this.onRightSwipe(event, deltaX, deltaY);
      } else {
        this.onLeftSwipe(event, deltaX, deltaY);
      }
    } else if (deltaY > 0) {
      this.onDownSwipe(event, deltaX, deltaY);
    } else {
      this.onUpSwipe(event, deltaX, deltaY);
    }

    this.downX = null;
    this.downY = null;
  };

  /**
   * Wires the gesture to an element, and detaches with {@link Swipe.removeListenersFromElement}. They
   * exist so one {@link Swipe} instance can serve any number of elements over its life — the hook the
   * other direction (element first, callbacks swapped per render) goes through `useSwipe` instead.
   */
  addListenersToElement = (element: HTMLElement) => {
    element.addEventListener('touchstart', this.onTouchStart, {
      passive: false,
    });
    element.addEventListener('touchmove', this.onTouchMove, { passive: false });
  };

  removeListenersFromElement = (element: HTMLElement) => {
    element.removeEventListener('touchstart', this.onTouchStart);
    element.removeEventListener('touchmove', this.onTouchMove);
  };
}

/**
 * Stops `touchstart` and `touchmove` from crossing this element's boundary, so a swipe that begins on
 * it is not also delivered to the ancestors its listeners are watching.
 *
 * The ref and not the element is the parameter for the same reason every ref-based hook is: a hook
 * re-runs after mount, by which time the element itself may have been captured stale — reading
 * `ref.current` on the effect gives the node that actually exists, and the ref in the dependency list
 * re-arms the listeners if the node is replaced.
 */
export function useSwipePrevention(elementRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const stop = (event: TouchEvent) => event.stopPropagation();

    const active: AddEventListenerOptions = { passive: false };

    const element = elementRef?.current;

    if (!element) {
      return undefined;
    }

    element.addEventListener('touchstart', stop, active);
    element.addEventListener('touchmove', stop, active);

    return () => {
      element.removeEventListener('touchstart', stop);
      element.removeEventListener('touchmove', stop);
    };
  }, [elementRef, elementRef?.current]);
}

/** What a direction callback receives: the original touch event and the signed travel from the start. */
export type SwipeCallback = (event: Event, deltaX: number, deltaY: number) => void;

/**
 * Owning hook for gesture recognition: the {@link Swipe} instance lives across renders, while the
 * callbacks and bounds are re-applied whenever a prop changes.
 *
 * It is deliberately one instance per component: the recognizer outlives renders, so no stroke can be
 * lost the moment the panel it observes re-renders. Omitting a callback keeps the previous one —
 * {@link Swipe} defaults to no-ops that are only replaced, never unsubscription — and setting the
 * bounds to an empty region, say `minX = maxX`, is how recognition is switched off.
 */
export function useSwipe({
  onUpSwipe,
  onDownSwipe,
  onLeftSwipe,
  onRightSwipe,
  minX = null,
  maxX = null,
  minY = null,
  maxY = null,
}: {
  readonly onUpSwipe?: SwipeCallback | undefined;
  readonly onDownSwipe?: SwipeCallback | undefined;
  readonly onLeftSwipe?: SwipeCallback | undefined;
  readonly onRightSwipe?: SwipeCallback | undefined;
  readonly minX?: number | null | undefined;
  readonly maxX?: number | null | undefined;
  readonly minY?: number | null | undefined;
  readonly maxY?: number | null | undefined;
}) {
  const swipe = useRef(new Swipe());

  useEffect(() => {
    swipe.current.minX = minX;
    swipe.current.maxX = maxX;
    swipe.current.minY = minY;
    swipe.current.maxY = maxY;

    if (onUpSwipe) {
      swipe.current.onUpSwipe = onUpSwipe;
    }

    if (onDownSwipe) {
      swipe.current.onDownSwipe = onDownSwipe;
    }

    if (onLeftSwipe) {
      swipe.current.onLeftSwipe = onLeftSwipe;
    }

    if (onRightSwipe) {
      swipe.current.onRightSwipe = onRightSwipe;
    }
  }, [onUpSwipe, onDownSwipe, onLeftSwipe, onRightSwipe, minX, maxX, minY, maxY]);

  return swipe.current;
}
