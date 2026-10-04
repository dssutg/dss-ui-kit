import { useCallback, useEffect, useRef } from 'react';
import { getPointerPosition } from '@/util/dom';
import { useGranularEffect } from '@/util/hooks/use_granular_effect';
import { clamp, type Point2D } from '@/util/math';

/**
 * How far from the edge a drag has to start before it moves the panel.
 *
 * A few pixels of slop, because a drag that begins anywhere on the page would fight every horizontal
 * scroll and every other thing the page does with a pointer; one that begins on the panel, or within
 * this distance of the edge it slides in from, is unambiguous.
 */
export const DEFAULT_DRAG_START_EDGE_WIDTH = 25;

const TRANSITION = 'transform 0.3s, box-shadow 0.3s';

/** The highest opacity the overlay behind the panel reaches, at the panel's open offset. */
const OVERLAY_OPACITY = 0.5;

/**
 * Slides a panel in from the edge of the viewport and back out, following a drag.
 *
 * The panel and its backdrop are the caller's elements: this returns the two refs to put on them and
 * writes their position as the pointer moves. That is the reason for the imperative style — a panel
 * dragged by the pointer would otherwise re-render the application on every pointer event, and a
 * menu cannot afford to make the page it is in stutter while it opens.
 *
 * `visible` and `onVisibleChange` are the caller's, because whether the panel is open is a fact about
 * the application and not about a gesture. Releasing the drag reports the side it ended on through
 * `onVisibleChange` and moves the panel there itself, so the two stay in agreement even if the caller
 * renders for a moment before it sets the state it was handed.
 *
 * The panel comes in from the left, which is why the drag is only recognised from that edge of the
 * viewport; a caller whose panel is on the right can take the horizontal movement from
 * {@link useMouseDrag} and apply the same offset arithmetic itself.
 *
 * The drag is taken from `mousedown`/`mousemove`/`mouseup` and their touch counterparts rather than
 * from pointer events, because a `touchmove` listener that calls `preventDefault` has to be registered
 * as non-passive to be allowed to, and the only way to ask for that before the gesture starts is the
 * older API. A vertical drag is handed back to the panel's own scrolling rather than stolen: it aborts
 * the drag, so a panel with a list in it can still be scrolled.
 */
export function useDraggablePanel({
  visible,
  onVisibleChange,
  animated = true,
  dragStartEdgeWidth = DEFAULT_DRAG_START_EDGE_WIDTH,
}: {
  readonly visible: boolean;
  readonly onVisibleChange: (visible: boolean) => void;
  readonly animated?: boolean | undefined;
  readonly dragStartEdgeWidth?: number | undefined;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  /**
   * The backdrop behind the panel, which the caller clicks to close it.
   *
   * A button rather than a `div`, and the type says so: a backdrop that only the mouse can reach is
   * one a keyboard user cannot close the panel with.
   */
  const overlayRef = useRef<HTMLButtonElement>(null);

  /** Where the panel is now, in pixels from its open position: zero when open, its width when closed. */
  const offsetRef = useRef(0);

  /** The pointer position the drag was last seen at, since a move reports a position and not a delta. */
  const lastPointerPositionRef = useRef({ x: 0, y: 0 });

  const isDraggingRef = useRef(false);

  /**
   * The closed offset for the panel, which is its own width and not a number the caller knows: the
   * panel may be any width, and one the caller measures on every open would flicker at the wrong size.
   */
  const closedOffset = useCallback(() => panelRef.current?.offsetWidth ?? 0, []);

  /**
   * Puts the panel at an offset, and fades the overlay in proportion to how open that offset is.
   *
   * The backdrop fades rather than appearing, so a panel that is dragged half open looks half
   * dismissed — the state the pointer is describing is the state on screen.
   */
  const movePanelTo = useCallback((offset: number) => {
    const panel = panelRef.current;
    const overlay = overlayRef.current;

    if (!panel || !overlay) {
      return;
    }

    const panelWidth = panel.offsetWidth;
    const boundedOffset = clamp(offset, -panelWidth, 0);
    const openFraction = (panelWidth - Math.abs(boundedOffset)) / panelWidth;

    panel.style.transform = `translateX(${boundedOffset}px)`;
    panel.style.boxShadow = openFraction > 0 ? 'rgb(0 0 0) 0px 19px 14px 4px' : 'none';

    overlay.style.opacity = `${openFraction * OVERLAY_OPACITY}`;

    offsetRef.current = boundedOffset;
  }, []);

  useGranularEffect(
    () => {
      if (panelRef.current) {
        movePanelTo(visible ? 0 : -closedOffset());
      }
    },
    [visible],
    [movePanelTo, closedOffset],
  );

  useGranularEffect(
    () => {
      const panel = panelRef.current;

      if (!panel) {
        return;
      }

      panel.style.transition = animated ? TRANSITION : 'none';

      if (!animated) {
        // With no transition there is nothing to animate, so the backdrop is left where the panel is
        // rather than faded by a change that never had time to happen.
        overlayRef.current?.style.setProperty('opacity', '0');
      }
    },
    [animated],
    [],
  );

  useEffect(() => {
    /** Decides whether a press is the start of a drag of this panel, and hands it to {@link trackDrag}. */
    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const panel = panelRef.current;

      if (!panel) {
        return;
      }

      const pointer = getPointerPosition(event);

      if (pointer === null) {
        return;
      }

      const startsOnPanel = panel.contains(event.target as Node);

      // A drag that starts in the middle of the screen is not a gesture to open the panel, even if it
      // would end up crossing it.
      if (!startsOnPanel && pointer.x > dragStartEdgeWidth) {
        return;
      }
      trackDrag(panel, pointer);
    }

    /**
     * Follows one drag from where it began to where it was released, moving the panel as it goes.
     *
     * The panel is an argument rather than read from the ref, so that the handlers below work on
     * the element that was measured at the start of the gesture: a panel unmounted mid-drag leaves
     * the ref null while the pointer is still down.
     */
    function trackDrag(panel: HTMLDivElement, startPointer: Point2D) {
      lastPointerPositionRef.current = startPointer;
      isDraggingRef.current = false;

      document.body.style.userSelect = 'none';
      panel.style.transition = 'none';

      function handlePointerMove(moveEvent: MouseEvent | TouchEvent) {
        const newPosition = getPointerPosition(moveEvent);

        if (newPosition === null) {
          return;
        }

        const horizontalMove = newPosition.x - lastPointerPositionRef.current.x;
        const verticalMove = newPosition.y - lastPointerPositionRef.current.y;

        // The panel scrolls vertically, so a gesture that is mostly vertical belongs to the scroll and
        // not to the panel: hand it back before taking the pointer.
        if (!isDraggingRef.current && Math.abs(verticalMove) > Math.abs(horizontalMove)) {
          handlePointerUp();

          return;
        }

        moveEvent.preventDefault();

        panel.style.pointerEvents = 'none';
        isDraggingRef.current = true;

        movePanelTo(offsetRef.current + horizontalMove);

        lastPointerPositionRef.current = newPosition;
      }

      function handlePointerUp() {
        document.body.style.userSelect = '';

        panel.style.transition = animated ? TRANSITION : 'none';
        panel.style.pointerEvents = '';

        // Released past halfway open, the panel finishes opening; released short of it, it closes.
        // Either way the caller is told which, so that closing the panel from a drag does not need a
        // second gesture to finish.
        const endedVisible = Math.abs(offsetRef.current) < panel.offsetWidth / 2;

        movePanelTo(endedVisible ? 0 : -closedOffset());
        onVisibleChange(endedVisible);

        document.removeEventListener('touchmove', handlePointerMove);
        document.removeEventListener('mousemove', handlePointerMove);
        document.removeEventListener('touchend', handlePointerUp);
        document.removeEventListener('mouseup', handlePointerUp);
      }

      // `touchmove` is registered as non-passive so that `handlePointerMove` may call `preventDefault`,
      // which is what stops the page scrolling under a horizontal drag.
      document.addEventListener('touchmove', handlePointerMove, { passive: false });
      document.addEventListener('mousemove', handlePointerMove);
      document.addEventListener('touchend', handlePointerUp);
      document.addEventListener('mouseup', handlePointerUp);
    }

    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [animated, dragStartEdgeWidth, movePanelTo, closedOffset, onVisibleChange]);

  return { panelRef, overlayRef };
}
