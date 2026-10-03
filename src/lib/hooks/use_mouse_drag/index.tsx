import { useState } from 'react';
import { getPointerPosition } from '@/lib/dom';
import { useEventListener } from '@/lib/hooks/use_event_listener';
import type { Point2D } from '@/lib/math';

/**
 * Tracks a drag over an element, reporting the movement and where the pointer is now.
 *
 * Movement is the total since the drag began, not the delta of the last event, so a consumer can
 * accumulate it without keeping its own running total. `onHandleDown` and `onHandleUp` report the two
 * ends of the gesture, which is where a consumer starts and stops a resize; the pointer is tracked
 * with pointer events, so touch works without a second path.
 *
 * `element` is null until the thing being dragged exists, and a null element registers nothing.
 */
export function useMouseDrag(
  element: Element | null,
  onDrag?: (
    move: Point2D,
    {
      initialPosition,
      newPosition,
    }: {
      readonly initialPosition: Point2D;
      readonly newPosition: Point2D;
    },
  ) => void,
  {
    onHandleDown,
    onHandleUp,
  }: {
    readonly onHandleDown?: (initialPosition: Point2D) => void;
    readonly onHandleUp?: () => void;
  } = {},
) {
  const [isDragging, setIsDragging] = useState(false);

  const [initialPosition, setInitialPosition] = useState<Point2D>({
    x: 0,
    y: 0,
  });

  const [position, setPosition] = useState<Point2D>({ x: 0, y: 0 });
  const [relativeMove, setRelativeMove] = useState<Point2D>({ x: 0, y: 0 });
  const [lastPosition, setLastPosition] = useState<Point2D>({ x: 0, y: 0 });

  function handleDown(event: TouchEvent | MouseEvent) {
    event.preventDefault();

    const initialPosition = getPointerPosition(event);

    if (initialPosition === null) {
      return;
    }

    setIsDragging(true);
    setInitialPosition(initialPosition);
    setLastPosition(initialPosition);
    setPosition(initialPosition);

    onHandleDown?.(initialPosition);
  }

  function handleMove(event: TouchEvent | MouseEvent) {
    if (!isDragging) {
      return;
    }

    event.preventDefault();

    const newPosition = getPointerPosition(event);

    if (newPosition === null) {
      return;
    }

    const x = newPosition.x - lastPosition.x;
    const y = newPosition.y - lastPosition.y;

    setRelativeMove({ x, y });
    setLastPosition(newPosition);
    setPosition(newPosition);

    onDrag?.({ x, y }, { initialPosition, newPosition });
  }

  function handleUp() {
    setIsDragging(false);
    setRelativeMove({ x: 0, y: 0 });

    onHandleUp?.();
  }

  useEventListener('mousedown', handleDown, element);
  useEventListener('mousemove', handleMove, window);
  useEventListener('mouseup', handleUp, window);

  useEventListener('touchstart', handleDown, element);
  useEventListener('touchmove', handleMove, element);
  useEventListener('touchend', handleUp, element);

  return { isDragging, position, relativeMove };
}
