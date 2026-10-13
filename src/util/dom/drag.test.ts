/**
 * `DragHandler` wires a panel's handle to a panel: a press on the handle claims the drag, each move
 * applies a delta from the last cursor position, and the release detaches the document-level
 * listeners again. The suite drives real `MouseEvent`s and TouchEvent-like stubs through the
 * listener set and asserts the `top`/`left`/`bottom`/`right` the element ends with, since that is
 * the element state callers observe.
 *
 * jsdom implements neither `Touch` nor `TouchEvent`; the stubs at the top provide exactly the two
 * shapes the source reads (`touches[0]`, `touches.item(0)`) with no validation between them. The
 * element position itself is read back through `offsetLeft`/`offsetTop`, which jsdom never
 * computes, so the tests that need a non-zero origin override those two properties; everything
 * else is the real DOM.
 */
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DragHandler } from './drag';

/** A `Touch` carrying only the fields the source reads plus the interface's required ones. */
class StubTouch implements Touch {
  readonly clientX: number;
  readonly clientY: number;
  readonly force: number;
  readonly identifier: number;
  readonly pageX: number;
  readonly pageY: number;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly rotationAngle: number;
  readonly screenX: number;
  readonly screenY: number;
  readonly target: EventTarget;

  constructor(init: TouchInit) {
    this.clientX = init.clientX ?? 0;
    this.clientY = init.clientY ?? 0;
    this.force = init.force ?? 0;
    this.identifier = init.identifier;
    this.pageX = init.pageX ?? 0;
    this.pageY = init.pageY ?? 0;
    this.radiusX = init.radiusX ?? 0;
    this.radiusY = init.radiusY ?? 0;
    this.rotationAngle = init.rotationAngle ?? 0;
    this.screenX = init.screenX ?? 0;
    this.screenY = init.screenY ?? 0;
    this.target = init.target;
  }
}

/** Builds a `TouchList`-shaped object: `length`, `item(index)` and numeric-indexed touches. */
function stubTouchList(touches: readonly Touch[]): TouchList {
  const byIndex: { [index: number]: Touch } = {};
  for (const [index, touch] of touchValues(touches).entries()) {
    byIndex[index] = touch;
  }

  return {
    ...byIndex,
    length: touches.length,
    item: (index: number): Touch | null => byIndex[index] ?? null,
    [Symbol.iterator]: (): ArrayIterator<Touch> => touchValues(touches).values(),
  };
}

/** The touches as an array; the iterator the `TouchList` interface requires is built from it. */
function touchValues(touches: readonly Touch[]): Touch[] {
  const values: Touch[] = [];
  for (let index = 0; index < touches.length; index += 1) {
    const touch = touches[index];
    if (touch !== undefined) {
      values.push(touch);
    }
  }

  return values;
}

/** A `TouchEvent`-shaped event whose `touches` is a fake list built from the given touches. */
class StubTouchEvent extends Event {
  readonly touches: TouchList;

  constructor(type: string, init: TouchEventInit = {}) {
    super(type, init);
    this.touches = stubTouchList(init.touches ?? []);
  }
}

afterEach(() => {
  for (const handler of handlers) {
    handler.removeAllEventListeners();
  }
  handlers.length = 0;
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

/** The handlers constructed by the running test, so they can be torn down after it. */
const handlers: DragHandler[] = [];

/** The elements and the handler one test drags with. */
interface MountedDrag {
  readonly element: HTMLDivElement;
  readonly trigger: HTMLButtonElement;
  readonly handler: DragHandler;
}

/** Elements in the document plus a `DragHandler` over them, cleaned up after the test. */
function mountDrag(onTryToDrag?: () => void): MountedDrag {
  const element = document.createElement('div');
  const trigger = document.createElement('button');
  document.body.appendChild(element);
  document.body.appendChild(trigger);

  const handler = new DragHandler(element, trigger, onTryToDrag);
  handlers.push(handler);

  return { element, trigger, handler };
}

/** A mouse event at the given position that bubbles to the document. */
function mouse(type: 'mousedown' | 'mousemove' | 'mouseup', x: number, y: number): MouseEvent {
  return new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true });
}

/** A touch event at the given position; without coordinates it carries no active touch. */
function touch(type: 'touchstart' | 'touchmove' | 'touchend', x?: number, y?: number): TouchEvent {
  const touches =
    x === undefined
      ? []
      : [new StubTouch({ identifier: 1, target: document.body, clientX: x, clientY: y ?? 0 })];

  return new TouchEvent(type, { touches, bubbles: true, cancelable: true });
}

describe('DragHandler', () => {
  beforeEach(() => {
    vi.stubGlobal('TouchEvent', StubTouchEvent);
  });

  test('claims a press on the trigger element and notifies through onTryToDrag', () => {
    const onTryToDrag = vi.fn(() => {});
    const { trigger, handler } = mountDrag(onTryToDrag);

    const start = mouse('mousedown', 100, 50);
    trigger.dispatchEvent(start);

    expect(handler.isNowDrag).toBe(true);
    expect(start.defaultPrevented).toBe(true);
    expect(onTryToDrag).toHaveBeenCalledOnce();
  });

  test('moves the element by the delta from the last cursor position', () => {
    const { element, trigger, handler } = mountDrag();
    let elementX = 20;
    let elementY = 30;
    Object.defineProperty(element, 'offsetLeft', { get: () => elementX, configurable: true });
    Object.defineProperty(element, 'offsetTop', { get: () => elementY, configurable: true });

    trigger.dispatchEvent(mouse('mousedown', 100, 50));

    // The first move: delta (100 - 120, 50 - 40); the element moves to (40, 0) floor.
    trigger.dispatchEvent(mouse('mousemove', 120, 40));
    expect(element.style.left).toBe('40px');
    expect(element.style.top).toBe('20px');
    expect(element.style.bottom).toBe('auto');
    expect(element.style.right).toBe('auto');

    // A caller that repositions the element between moves is composed with, not overwritten: the
    // next delta is taken from the element's new position, not the last one written.
    elementX = 60;
    elementY = 10;
    trigger.dispatchEvent(mouse('mousemove', 130, 30));
    expect(element.style.left).toBe('70px');
    expect(element.style.top).toBe('0px');

    document.dispatchEvent(mouse('mouseup', 130, 30));
    expect(handler.isNowDrag).toBe(false);

    trigger.dispatchEvent(mouse('mousemove', 999, 999));
    expect(element.style.left).toBe('70px');
  });

  test('ignores a press while disabled', () => {
    const { element, trigger, handler } = mountDrag();
    handler.disable();

    const start = mouse('mousedown', 100, 50);
    trigger.dispatchEvent(start);

    expect(handler.isNowDrag).toBe(false);
    expect(start.defaultPrevented).toBe(false);
    expect(element.style.left).toBe('');
  });

  test('toggles the enabled switch back on', () => {
    const { handler } = mountDrag();
    handler.disable();
    expect(handler.enabled).toBe(false);
    handler.toggle();
    expect(handler.enabled).toBe(true);
    handler.enable();
    expect(handler.enabled).toBe(true);
  });

  test('delegates the mouse press to a caller-supplied handler without claiming the drag', () => {
    const { trigger, handler } = mountDrag();
    const delegated: MouseEvent[] = [];
    handler.onMouseDownHandler = (event) => delegated.push(event);

    const start = mouse('mousedown', 100, 50);
    trigger.dispatchEvent(start);

    expect(delegated).toEqual([start]);
    expect(handler.isNowDrag).toBe(false);
    expect(start.defaultPrevented).toBe(false);
  });

  test('claims a touch press and moves the element until the gesture ends', () => {
    const { element, trigger } = mountDrag();

    trigger.dispatchEvent(touch('touchstart', 30, 30));

    // A move that carries no active touch is the gesture ending rather than moving; no coordinate
    // is applied and no default is prevented.
    const moveWithNoActiveTouch = touch('touchmove');
    document.dispatchEvent(moveWithNoActiveTouch);
    expect(moveWithNoActiveTouch.defaultPrevented).toBe(false);
    expect(element.style.left).toBe('');

    document.dispatchEvent(touch('touchmove', 40, 20));
    expect(element.style.left).toBe('10px');
    expect(element.style.top).toBe('0px');

    document.dispatchEvent(touch('touchend'));
    expect(element.style.top).toBe('0px');
    document.dispatchEvent(touch('touchmove', 50, 50));
    expect(element.style.left).toBe('10px');
  });

  test('ignores a touch press carrying no active touch', () => {
    const { element, handler, trigger } = mountDrag();

    trigger.dispatchEvent(touch('touchstart'));

    expect(handler.isNowDrag).toBe(false);
    expect(element.style.top).toBe('');
  });

  test('ignores a touch press while disabled, and a touch move after the gesture ended', () => {
    const { element, handler, trigger } = mountDrag();
    handler.disable();

    trigger.dispatchEvent(touch('touchstart', 30, 30));
    expect(handler.isNowDrag).toBe(false);

    handler.enable();
    document.dispatchEvent(touch('touchstart', 60, 60));
    document.dispatchEvent(touch('touchend'));

    const moveWithNoActiveTouch = touch('touchmove');
    document.dispatchEvent(moveWithNoActiveTouch);
    expect(moveWithNoActiveTouch.defaultPrevented).toBe(false);
    expect(element.style.left).toBe('');
  });

  test('delegates the touch press to a caller-supplied handler without claiming the drag', () => {
    const { trigger, handler } = mountDrag();
    const delegated: TouchEvent[] = [];
    handler.onTouchStartHandler = (event) => delegated.push(event);

    const start = touch('touchstart', 30, 30);
    trigger.dispatchEvent(start);

    expect(delegated).toEqual([start]);
    expect(handler.isNowDrag).toBe(false);
    expect(start.defaultPrevented).toBe(false);
  });

  test('lets onTryToDrag refuse the drag by disabling the handler after the flag flipped', () => {
    const { element, trigger, handler } = mountDrag();
    let isNowDragInsideCallback = true;
    const veto = vi.fn(() => {
      isNowDragInsideCallback = handler.isNowDrag;
      handler.disable();
    });
    handler.onTryToDrag = veto;

    trigger.dispatchEvent(mouse('mousedown', 100, 50));
    expect(veto).toHaveBeenCalledOnce();
    expect(isNowDragInsideCallback).toBe(true);

    trigger.dispatchEvent(mouse('mousemove', 120, 40));
    expect(element.style.left).toBe('');
  });

  test('removeAllEventListeners detaches the standing trigger and document listeners', () => {
    const { element, trigger, handler } = mountDrag();
    handler.removeAllEventListeners();

    trigger.dispatchEvent(mouse('mousedown', 100, 50));
    trigger.dispatchEvent(mouse('mousemove', 120, 40));
    document.dispatchEvent(touch('touchstart', 30, 30));
    document.dispatchEvent(touch('touchmove', 40, 20));

    expect(handler.isNowDrag).toBe(false);
    expect(element.style.left).toBe('');
    expect(element.style.top).toBe('');
  });

  test('reports the element position read back from the element', () => {
    const { element, handler } = mountDrag();
    Object.defineProperty(element, 'offsetLeft', { value: 40, configurable: true });
    Object.defineProperty(element, 'offsetTop', { value: 15, configurable: true });

    expect(handler.getElementToDragPosition()).toEqual({ x: 40, y: 15 });
  });

  describe('moveElementToDrag', () => {
    test('floors a negative Y to zero by default and leaves X alone', () => {
      const { element, handler } = mountDrag();

      handler.moveElementToDrag(10, -5);

      expect(element.style.top).toBe('0px');
      expect(element.style.left).toBe('10px');
    });

    test('floors a negative X to zero when asked to', () => {
      const { element, handler } = mountDrag();

      handler.moveElementToDrag(-7, 3, true, true);

      expect(element.style.left).toBe('0px');
      expect(element.style.top).toBe('3px');
    });

    test('keeps caller-supplied negative coordinates when correction is off', () => {
      const { element, handler } = mountDrag();

      handler.moveElementToDrag(-7, -3, false, false);

      expect(element.style.left).toBe('-7px');
      expect(element.style.top).toBe('-3px');
    });

    /**
     * A JS caller may hand the handler fewer arguments than the signature names; the guard is
     * there for them, so the test calls through `Reflect.apply` with an argument list holding
     * holes, the way such a caller does. A skipped side leaves already-written styles alone,
     * which is why the two directions get their own element.
     */
    test('skips a side whose coordinate is absent', () => {
      const noX = mountDrag();
      Reflect.apply(noX.handler.moveElementToDrag, noX.handler, [undefined, 5, true, true]);
      expect(noX.element.style.top).toBe('5px');
      expect(noX.element.style.left).toBe('');

      const noY = mountDrag();
      Reflect.apply(noY.handler.moveElementToDrag, noY.handler, [5, undefined, true, true]);
      expect(noY.element.style.top).toBe('');
      expect(noY.element.style.left).toBe('5px');
      expect(noY.element.style.bottom).toBe('auto');
      expect(noY.element.style.right).toBe('auto');
    });
  });

  test('composes with the clampPosition hook a subclass supplies', () => {
    class MaxWidthDrag extends DragHandler {
      /** Keeps the dragged element from crossing x = 50, a caller's own layout rule. */
      override clampPosition = (x: number, y: number) => [Math.min(x, 50), y];
    }

    const element = document.createElement('div');
    const trigger = document.createElement('button');
    document.body.appendChild(element);
    document.body.appendChild(trigger);
    const handler = new MaxWidthDrag(element, trigger);
    handlers.push(handler);

    trigger.dispatchEvent(mouse('mousedown', 0, 0));
    trigger.dispatchEvent(mouse('mousemove', 100, 0));

    expect(element.style.left).toBe('50px');
  });
});
