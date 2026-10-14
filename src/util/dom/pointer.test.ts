// SPDX-License-Identifier: MIT
/**
 * `firstTouch` and `getPointerPosition` answer one question two ways — where the pointer is — for
 * events whose shape differs: a `TouchEvent` may arrive while no touch is down (`touchend` is
 * exactly that), which is why a handler must be able to read `null` rather than an origin. The
 * suite exercises each shape with real `MouseEvent`s and TouchEvent-like stubs, asserting both the
 * position read and the `null`.
 *
 * jsdom implements neither `Touch` nor `TouchEvent`; the stubs at the top provide the two shapes
 * the source reads (`touches[0]`, `touches.item(0)`) with nothing else about the event changed.
 */
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { firstTouch, getPointerPosition } from './pointer';

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

/** A touch at the given viewport position. */
function touchAt(x: number, y: number): Touch {
  return new StubTouch({ identifier: 1, target: document.body, clientX: x, clientY: y });
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('firstTouch', () => {
  beforeEach(() => {
    vi.stubGlobal('TouchEvent', StubTouchEvent);
  });

  test('returns the first active touch', () => {
    const touch = touchAt(5, 6);
    const event = new TouchEvent('touchmove', { touches: [touch] });
    expect(firstTouch(event)).toBe(touch);
  });

  test('returns null once the last contact has lifted', () => {
    const event = new TouchEvent('touchend', { touches: [] });
    expect(firstTouch(event)).toBeNull();
  });

  test('returns null for a mouse event', () => {
    const event = new MouseEvent('mousemove', {
      clientX: 1,
      clientY: 2,
      bubbles: true,
      cancelable: true,
    });
    expect(firstTouch(event)).toBeNull();
  });
});

describe('getPointerPosition', () => {
  beforeEach(() => {
    vi.stubGlobal('TouchEvent', StubTouchEvent);
  });

  test('reads the client position of a mouse event', () => {
    const event = new MouseEvent('mousemove', { clientX: 3, clientY: 4 });
    expect(getPointerPosition(event)).toEqual({ x: 3, y: 4 });
  });

  test('reads the first active touch of a touch event', () => {
    const event = new TouchEvent('touchmove', { touches: [touchAt(30, 40)] });
    expect(getPointerPosition(event)).toEqual({ x: 30, y: 40 });
  });

  test('answers null rather than the origin for a touch event with no touch', () => {
    const event = new TouchEvent('touchmove', { touches: [] });
    expect(getPointerPosition(event)).toBeNull();
  });
});
