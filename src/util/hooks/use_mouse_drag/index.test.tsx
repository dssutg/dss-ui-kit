// SPDX-License-Identifier: MIT
/**
 * `useMouseDrag` tracks a drag over an element: movement since the drag began, where the pointer is
 * now, and the two ends of the gesture. A null element registers nothing, moves without a press are
 * ignored rather than stolen, and a touch event with no active touch carries no position and is
 * ignored. The suite drives real mouse events and TouchEvent-like stubs — jsdom implements neither
 * `Touch` nor `TouchEvent` — through the element and the window the hook listens on, and asserts the
 * drag ends cleanly.
 */
// @vitest-environment jsdom

import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Point2D } from '@/util/math';
import { render } from '@/util/testing/render';
import { useMouseDrag } from './';

/**
 * The callback shape `useMouseDrag` takes for `onDrag`, spelled out so the calls it receives are
 * built and asserted without widening anything.
 */
type OnDrag = (
  move: Point2D,
  positions: { readonly initialPosition: Point2D; readonly newPosition: Point2D },
) => void;

/**
 * The two ends of the gesture as `useMouseDrag` takes them.
 */
type OnDragEnds = {
  readonly onHandleDown?: (position: Point2D) => void;
  readonly onHandleUp?: () => void;
};

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
  for (const [index, value] of touchValues(touches).entries()) {
    byIndex[index] = value;
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

/**
 * A probe that exposes the two callback the hook can be given, omitting them when the props are:
 * a caller may hand over only `onDrag`, only the two ends, or nothing at all. The drag's state is
 * rendered into the DOM so assertions read what a consumer would draw from.
 */
function DragProbe({
  element,
  onDrag,
  onDragEnds,
}: {
  readonly element: HTMLDivElement | null;
  readonly onDrag?: OnDrag;
  readonly onDragEnds?: OnDragEnds;
}) {
  const drag = useMouseDrag(element, onDrag, onDragEnds);
  const { isDragging, position, relativeMove } = drag;

  return (
    <div data-testid="view">
      {`dragging:${isDragging} at:${position.x},${position.y} moved:${relativeMove.x},${relativeMove.y}`}
    </div>
  );
}

/** The element a drag starts on, created in the document before the probe renders. */
function mountDragElement(): HTMLDivElement {
  const element = document.createElement('div');

  document.body.appendChild(element);

  return element;
}

/** Sends `event` to `target` inside an act, so the state updates land before the assertion. */
function sendEvent(target: EventTarget, event: Event): void {
  act(() => {
    target.dispatchEvent(event);
  });
}

/** A mouse event at a position that bubbles and can be prevented. */
function mouse(type: string, x: number, y: number): MouseEvent {
  return new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true });
}

/** A touch event at a position; without coordinates it carries no active touch. */
function touch(type: 'touchstart' | 'touchmove' | 'touchend', x?: number, y?: number): TouchEvent {
  const touches =
    x === undefined
      ? []
      : [new StubTouch({ identifier: 1, target: document.body, clientX: x, clientY: y ?? 0 })];

  // Constructed through the global, which the suite has replaced with the stub above: the type is
  // the DOM one, the instance is the stub.
  return new TouchEvent(type, { touches, bubbles: true, cancelable: true });
}

describe('useMouseDrag', () => {
  beforeEach(() => {
    vi.stubGlobal('TouchEvent', StubTouchEvent);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  test('follows a mouse drag and reports the total movement since the press', async () => {
    const element = mountDragElement();
    const onDrag = vi.fn<OnDrag>();
    const down = mouse('mousedown', 10, 20);

    const view = await render(<DragProbe element={element} onDrag={onDrag} />);

    sendEvent(element, down);

    expect(view.textContent()).toBe('dragging:true at:10,20 moved:0,0');
    expect(down.defaultPrevented).toBe(true);

    const firstMove = mouse('mousemove', 15, 30);
    sendEvent(window, firstMove);

    expect(view.textContent()).toBe('dragging:true at:15,30 moved:5,10');
    expect(firstMove.defaultPrevented).toBe(true);
    expect(onDrag).toHaveBeenCalledWith(
      { x: 5, y: 10 },
      { initialPosition: { x: 10, y: 20 }, newPosition: { x: 15, y: 30 } },
    );

    // Movement is the total since the drag began, not the delta of the last event: a second move of
    // three pixels answers three, whatever the last move moved.
    sendEvent(window, mouse('mousemove', 15, 33));

    expect(view.textContent()).toBe('dragging:true at:15,33 moved:0,3');
  });

  test('ends the drag on mouseup and follows nothing afterwards', async () => {
    const element = mountDragElement();
    const onHandleDown = vi.fn<(position: Point2D) => void>();
    const onHandleUp = vi.fn<() => void>();
    const onDrag = vi.fn<OnDrag>();

    const view = await render(
      <DragProbe element={element} onDrag={onDrag} onDragEnds={{ onHandleDown, onHandleUp }} />,
    );

    sendEvent(element, mouse('mousedown', 4, 5));
    sendEvent(window, mouse('mousemove', 9, 8));

    expect(view.textContent()).toBe('dragging:true at:9,8 moved:5,3');
    expect(onHandleDown).toHaveBeenCalledWith({ x: 4, y: 5 });
    expect(onHandleUp).not.toHaveBeenCalled();

    sendEvent(window, mouse('mouseup', 9, 8));

    expect(view.textContent()).toBe('dragging:false at:9,8 moved:0,0');
    expect(onHandleUp).toHaveBeenCalledTimes(1);

    // A pointer that moves with no press belongs to nothing.
    const untrackedMove = mouse('mousemove', 90, 90);
    sendEvent(window, untrackedMove);

    expect(view.textContent()).toBe('dragging:false at:9,8 moved:0,0');
    expect(untrackedMove.defaultPrevented).toBe(false);
    expect(onDrag).toHaveBeenCalledTimes(1);
  });

  test('tracks a touch drag through the element, ignoring moves with no touch', async () => {
    const element = mountDragElement();
    const onDrag = vi.fn<OnDrag>();

    const view = await render(<DragProbe element={element} onDrag={onDrag} />);

    sendEvent(element, touch('touchstart', 1, 2));
    sendEvent(element, touch('touchmove', 4, 6));

    expect(view.textContent()).toBe('dragging:true at:4,6 moved:3,4');
    expect(onDrag).toHaveBeenCalledWith(
      { x: 3, y: 4 },
      { initialPosition: { x: 1, y: 2 }, newPosition: { x: 4, y: 6 } },
    );

    // `touchmove` reports the touches still down; with the last contact lifted the move carries no
    // position and is ignored rather than answered with the origin.
    const liftedMove = touch('touchmove');
    sendEvent(element, liftedMove);

    expect(view.textContent()).toBe('dragging:true at:4,6 moved:3,4');
    // The move with no touch is claimed even though it moves nothing: `preventDefault` runs before
    // the position is read, and the drag holds its state.
    expect(liftedMove.defaultPrevented).toBe(true);

    sendEvent(element, touch('touchend'));

    expect(view.textContent()).toBe('dragging:false at:4,6 moved:0,0');
  });

  test('ignores a press that carries no pointer position, without preventing it silently', async () => {
    const element = mountDragElement();
    const onHandleDown = vi.fn<(position: Point2D) => void>();

    const view = await render(<DragProbe element={element} onDragEnds={{ onHandleDown }} />);

    const emptyTouch = touch('touchstart');
    sendEvent(element, emptyTouch);

    // The press is still claimed — `preventDefault` runs before the position is read — but no drag
    // begins, and the gesture's callbacks are never called.
    expect(emptyTouch.defaultPrevented).toBe(true);
    expect(view.textContent()).toBe('dragging:false at:0,0 moved:0,0');
    expect(onHandleDown).not.toHaveBeenCalled();

    sendEvent(window, mouse('mousemove', 5, 5));

    expect(view.textContent()).toBe('dragging:false at:0,0 moved:0,0');
  });

  test('registers nothing when the element is null', async () => {
    const onHandleDown = vi.fn<(position: Point2D) => void>();
    const onHandleUp = vi.fn<() => void>();

    const view = await render(
      <DragProbe element={null} onDragEnds={{ onHandleDown, onHandleUp }} />,
    );

    const pressOnDocument = mouse('mousedown', 3, 4);
    sendEvent(document, pressOnDocument);

    expect(view.textContent()).toBe('dragging:false at:0,0 moved:0,0');
    expect(pressOnDocument.defaultPrevented).toBe(false);
    expect(onHandleDown).not.toHaveBeenCalled();
    expect(onHandleUp).not.toHaveBeenCalled();
  });

  test('works with no callbacks at all', async () => {
    const element = mountDragElement();

    const view = await render(<DragProbe element={element} />);

    sendEvent(element, mouse('mousedown', 7, 8));
    sendEvent(window, mouse('mousemove', 11, 10));
    sendEvent(window, mouse('mouseup', 11, 10));

    expect(view.textContent()).toBe('dragging:false at:11,10 moved:0,0');
  });

  test('removes its listeners when the component unmounts', async () => {
    const element = mountDragElement();
    const removeWindowListener = vi.spyOn(window, 'removeEventListener');
    const removeElementListener = vi.spyOn(element, 'removeEventListener');

    const view = await render(<DragProbe element={element} />);

    view.unmount();

    // The window listeners for the gesture's middle and end, and the element listeners for its
    // start, are all gone with the component.
    expect(removeWindowListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(removeWindowListener).toHaveBeenCalledWith('mouseup', expect.any(Function));
    expect(removeElementListener).toHaveBeenCalledWith('mousedown', expect.any(Function));
    expect(removeElementListener).toHaveBeenCalledWith('touchstart', expect.any(Function));
    expect(removeElementListener).toHaveBeenCalledWith('touchmove', expect.any(Function));
    expect(removeElementListener).toHaveBeenCalledWith('touchend', expect.any(Function));
  });
});
