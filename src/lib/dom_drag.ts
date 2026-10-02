import { getPointerPosition } from '@/lib/dom_pointer';
import type { Point2D } from '@/lib/math';

// Handle element dragging with mouse
export class DragHandler {
  currentCursorPosition: Point2D;
  elementToDrag: HTMLElement;
  dragTriggerElement: HTMLElement;
  onTryToDrag: () => void;
  enabled: boolean;
  isNowDrag: boolean;
  onMouseDownHandler: ((event: MouseEvent) => void) | null;
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

  internalOnMouseMoveHandler = (event: MouseEvent) => {
    if (!this.enabled || !this.isNowDrag) {
      return;
    }
    this.internalHandleMoveEvent(event);
  };

  internalOnTouchHandlerMoveHandler = (event: TouchEvent) => {
    if (!this.enabled || !this.isNowDrag) {
      return;
    }
    this.internalHandleMoveEvent(event);
  };

  removeTemporaryEventListeners = () => {
    document.removeEventListener('mouseup', this.removeTemporaryEventListeners);
    document.removeEventListener('mousemove', this.internalOnMouseMoveHandler);
    this.isNowDrag = false;
  };

  removeAllEventListeners = () => {
    this.removeTemporaryEventListeners();
    this.dragTriggerElement.removeEventListener('mousedown', this.internalOnMouseDownHandler);
    this.dragTriggerElement.removeEventListener('touchstart', this.internalOnTouchStartHandler);
    document.removeEventListener('touchend', this.removeTemporaryEventListeners);
    document.removeEventListener('touchmove', this.internalOnTouchHandlerMoveHandler);
  };

  setEnabled = (enabled: boolean) => {
    this.enabled = enabled;
  };

  enable = () => this.setEnabled(true);
  disable = () => this.setEnabled(false);
  toggle = () => this.setEnabled(!this.enabled);

  clampPosition = (x: number, y: number) => [x, y];

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

  getElementToDragPosition = () => ({
    x: this.elementToDrag.offsetLeft,
    y: this.elementToDrag.offsetTop,
  });
}
