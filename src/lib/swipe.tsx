import { useEffect, useRef } from 'react';

export class Swipe {
  downX: number | null;
  downY: number | null;
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

  onUpSwipe = (_event: Event, _deltaX: number, _deltaY: number) => {};
  onDownSwipe = (_event: Event, _deltaX: number, _deltaY: number) => {};
  onLeftSwipe = (_event: Event, _deltaX: number, _deltaY: number) => {};
  onRightSwipe = (_event: Event, _deltaX: number, _deltaY: number) => {};

  onTouchStart = (event: TouchEvent) => {
    if (!event.touches[0]) {
      return;
    }

    this.downX = event.touches[0].clientX;
    this.downY = event.touches[0].clientY;
  };

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

// NOTE that we use element ref here instead of the element itself.
// Otherwise, this hook wouldn't work.

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

export type SwipeCallback = (event: Event, deltaX: number, deltaY: number) => void;

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
