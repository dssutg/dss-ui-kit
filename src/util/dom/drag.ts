import type { Point2D } from '@/util/math';
import { getPointerPosition } from './pointer';

/**
 * Mouse and touch dragging for a single element, driven by `top`/`left` style updates.
 *
 * The element that moves and the element that starts the drag are deliberately two elements: a modal
 * or a floating panel moves when its header is dragged, not when its body is. Pass the panel as
 * `elementToDrag` and its handle as `dragTriggerElement`. Listeners are wired in the constructor, at
 * which point the trigger element must already be in the document. `onTryToDrag` runs when a drag
 * starts and is the caller's veto point and notification: {@link DragHandler.isNowDrag} flips to
 * `true` before it fires, so a callback that wants to refuse the drag reads the flag and disables
 * the handler afterwards via {@link DragHandler.disable} — a `return` on its own stops nothing.
 *
 * The cursor position at the last move is kept in {@link DragHandler.currentCursorPosition} and each
 * move applies a delta, so the drag composes correctly with a caller that repositions the element
 * between moves rather than fighting overwrites.
 *
 * While a drag is active, document-level `mousemove`/`mouseup` (and standing `touchmove`/
 * `touchend`) listeners stay attached. They are removed when the pointer is released, but an element
 * torn out of the document mid-drag, or a handler simply retired, will not see the mouseup — so an
 * instance that goes away must call {@link DragHandler.removeAllEventListeners} to detach everything,
 * including the permanent trigger listeners the constructor installed. {@link DragHandler.disable}
 * silences the handlers but still leaves the listeners attached, so the two are not interchangeable
 * as cleanup.
 *
 * There is no cancel method: a drag ends only when the pointer is released.
 */
export class DragHandler {
  /** Pointer position as of the previous move; each move applies a delta from this, not an absolute move. */
  currentCursorPosition: Point2D;
  /** The element whose `top`/`left` the drag updates; it is also where the position is read back from. */
  elementToDrag: HTMLElement;
  /** The element whose `mousedown`/`touchstart` starts a drag — a handle, not the moved element itself. */
  dragTriggerElement: HTMLElement;
  /**
   * Runs when a drag begins, with {@link DragHandler.isNowDrag} already `true`.
   *
   * It is a notification rather than a veto: returning early stops nothing, and a callback that
   * refuses the drag must disable the handler (and re-enable when the state changes) itself.
   */
  onTryToDrag: () => void;
  /** Master switch consulted by both start handlers and both move handlers. */
  enabled: boolean;
  /** `true` between a press on the trigger element and the pointer being released. */
  isNowDrag: boolean;
  /**
   * A caller-supplied override for the `mousedown` start: when set, the press is not claimed and
   * {@link DragHandler.internalHandleMoveEvent} never sees the pointer, so the caller owns the drag.
   */
  onMouseDownHandler: ((event: MouseEvent) => void) | null;
  /** The touch counterpart of {@link DragHandler.onMouseDownHandler}. */
  onTouchStartHandler: ((event: TouchEvent) => void) | null;

  constructor(elementToDrag: HTMLElement, dragTriggerElement: HTMLElement, onTryToDrag = () => {}) {
    this.currentCursorPosition = { x: 0, y: 0 };

    this.elementToDrag = elementToDrag;
    this.dragTriggerElement = dragTriggerElement;

    this.dragTriggerElement.addEventListener('mousedown', this.internalOnMouseDownHandler);
    this.dragTriggerElement.addEventListener('touchstart', this.internalOnTouchStartHandler);
    this.onMouseDownHandler = null;
    this.onTouchStartHandler = null;
    document.addEventListener('touchend', this.removeTemporaryEventListeners);
    document.addEventListener('touchmove', this.internalOnTouchHandlerMoveHandler);

    this.onTryToDrag = onTryToDrag;

    this.enabled = true;

    this.isNowDrag = false;
  }

  /**
   * Mouse entry point wired to the trigger element. Delegates to a caller-supplied
   * {@link DragHandler.onMouseDownHandler} when there is one; otherwise claims the press, records the
   * cursor and attaches the document-level move/release listeners for the duration of the drag.
   */
  internalOnMouseDownHandler = (event: MouseEvent) => {
    if (!this.enabled) {
      return;
    }

    if (this.onMouseDownHandler) {
      this.onMouseDownHandler(event);

      return;
    }

    event.preventDefault();

    this.currentCursorPosition = {
      x: event.clientX,
      y: event.clientY,
    };

    document.addEventListener('mouseup', this.removeTemporaryEventListeners);
    document.addEventListener('mousemove', this.internalOnMouseMoveHandler);

    this.isNowDrag = true;

    this.onTryToDrag();
  };

  /**
   * Touch entry point wired to the trigger element, mirroring
   * {@link DragHandler.internalOnMouseDownHandler}. Unlike the mouse path it attaches no
   * document-level listeners at start, because a single standing `touchmove`/`touchend` pair is
   * installed in the constructor for the instance's whole life.
   */
  internalOnTouchStartHandler = (event: TouchEvent) => {
    if (event.touches[0] === undefined) {
      return;
    }

    if (!this.enabled) {
      return;
    }

    if (this.onTouchStartHandler) {
      this.onTouchStartHandler(event);

      return;
    }

    event.preventDefault();

    this.currentCursorPosition = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
    };

    this.isNowDrag = true;

    this.onTryToDrag();
  };

  /**
   * The one move handler both input paths funnel through.
   *
   * Works by delta from {@link DragHandler.currentCursorPosition} rather than by absolute position,
   * so it composes with repositioning the element between moves — a caller that clamps or animates
   * mid-drag does not get overwritten by stale coordinates.
   */
  internalHandleMoveEvent = (event: MouseEvent | TouchEvent) => {
    const position = getPointerPosition(event);

    // A touch event with no active touch is the gesture ending rather than moving.
    if (position === null) {
      return;
    }

    event.preventDefault();

    const currentElementToDragPosition = this.getElementToDragPosition();

    const deltaX = this.currentCursorPosition.x - position.x;
    const deltaY = this.currentCursorPosition.y - position.y;

    this.currentCursorPosition = position;

    const newElementToDragX = currentElementToDragPosition.x - deltaX;
    const newElementToDragY = currentElementToDragPosition.y - deltaY;

    this.moveElementToDrag(newElementToDragX, newElementToDragY);
  };

  /** Mouse move handler for the duration of a drag. */
  internalOnMouseMoveHandler = (event: MouseEvent) => {
    if (!this.enabled || !this.isNowDrag) {
      return;
    }
    this.internalHandleMoveEvent(event);
  };

  /** Standing touch move handler installed for the instance's whole life, not per drag. */
  internalOnTouchHandlerMoveHandler = (event: TouchEvent) => {
    if (!this.enabled || !this.isNowDrag) {
      return;
    }
    this.internalHandleMoveEvent(event);
  };

  /**
   * Ends the current drag and detaches the document-level listeners a mouse drag attached.
   *
   * It is also the `mouseup`/`touchend` handler itself, hence the recursive `removeEventListener` —
   * removal is idempotent, so a touch end followed by the mouse path is harmless.
   */
  removeTemporaryEventListeners = () => {
    document.removeEventListener('mouseup', this.removeTemporaryEventListeners);
    document.removeEventListener('mousemove', this.internalOnMouseMoveHandler);
    this.isNowDrag = false;
  };

  /**
   * Detaches everything the instance installed, including the standing listeners the constructor
   * put on `document`. The only correct teardown for an instance going away — see the class comment
   * for why dropping an active instance is not safe by itself.
   */
  removeAllEventListeners = () => {
    this.removeTemporaryEventListeners();
    this.dragTriggerElement.removeEventListener('mousedown', this.internalOnMouseDownHandler);
    this.dragTriggerElement.removeEventListener('touchstart', this.internalOnTouchStartHandler);
    document.removeEventListener('touchend', this.removeTemporaryEventListeners);
    document.removeEventListener('touchmove', this.internalOnTouchHandlerMoveHandler);
  };

  /** Suppresses or resumes dragging without touching any listener: cheaper than, but not a substitute for, {@link DragHandler.removeAllEventListeners}. */
  setEnabled = (enabled: boolean) => {
    this.enabled = enabled;
  };

  enable = () => this.setEnabled(true);
  disable = () => this.setEnabled(false);
  toggle = () => this.setEnabled(!this.enabled);

  /**
   * Hook for a caller that wants to constrain dragging beyond the non-negative floor applied by
   * {@link DragHandler.moveElementToDrag}. The default identity is deliberately inextensible: a
   * subclass overrides this, overriding {@link DragHandler.moveElementToDrag} alone would not be
   * seen by the internal move path.
   */
  clampPosition = (x: number, y: number) => [x, y];

  /**
   * Applies a position to the dragged element by CSS `top`/`left`.
   *
   * Negative coordinates are floored to zero by default — drag a panel off the top-left of the
   * screen and it stops there rather than vanishing, and only the Y correction is on by default
   * because callers position the X edge themselves.
   *
   * `bottom`/`right` are forced to `auto` on every move: an element that arrived with an
   * anchoring pair of sides set would otherwise ignore the `top`/`left` being written.
   */
  moveElementToDrag = (
    x: number,
    y: number,
    shouldCorrectIfInvalidX = false,
    shouldCorrectIfInvalidY = true,
  ) => {
    const validX = shouldCorrectIfInvalidX && x !== undefined ? Math.max(0, x) : x;
    const validY = shouldCorrectIfInvalidY && y !== undefined ? Math.max(0, y) : y;

    const [clampedX, clampedY] = this.clampPosition(validX, validY);

    if (clampedY !== undefined) {
      this.elementToDrag.style.top = `${clampedY}px`;
    }
    if (clampedX !== undefined) {
      this.elementToDrag.style.left = `${clampedX}px`;
    }

    // Bottom and right should affect top and left
    this.elementToDrag.style.bottom = 'auto';
    this.elementToDrag.style.right = 'auto';
  };

  /**
   * The element's current position, read back from `offsetLeft`/`offsetTop` rather than cached: the
   * caller is free to move the element between moves (a clamp, an animation) and the next delta is
   * computed from where the element actually is.
   */
  getElementToDragPosition = () => ({
    x: this.elementToDrag.offsetLeft,
    y: this.elementToDrag.offsetTop,
  });
}
