// SPDX-License-Identifier: MIT
/**
 * Touch-gesture recognition, driven with real events against a real element: a touch comes down
 * somewhere in the allowed range, the first move where the two travel distances can be compared
 * settles the direction and closes the gesture, and every later move is ignored. The suite pins
 * the direction resolution (ties read vertical), the signed deltas the callbacks receive, the
 * bounds a stroke must start inside, and the silent discard of a stroke that begins outside. The
 * two hooks are driven the way a component uses them — through rendered probes.
 *
 * jsdom implements neither `Touch` nor `TouchEvent`; the stubs below provide the one shape the
 * source reads (`touches[0]` and its coordinates) with nothing else about the event changed.
 */
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { render } from '@/util/testing/render';
import { Swipe, useSwipe, useSwipePrevention } from './';

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

/** A `TouchEvent`-shaped event whose `touches` is a fake list built from the given touches. */
class StubTouchEvent extends Event {
  readonly touches: TouchList;

  constructor(type: string, init: TouchEventInit = {}) {
    super(type, init);
    this.touches = touchListOf(init.touches ?? []);
  }
}

/** Builds a `TouchList`-shaped object: `length`, `item(index)` and numeric-indexed touches. */
function touchListOf(touches: readonly Touch[]): TouchList {
  const byIndex: { [index: number]: Touch } = {};

  for (const [index, touch] of touches.entries()) {
    byIndex[index] = touch;
  }

  return {
    ...byIndex,
    length: touches.length,
    item: (index: number): Touch | null => byIndex[index] ?? null,
    [Symbol.iterator]: (): ArrayIterator<Touch> => touches.values(),
  };
}

/** A touch event at the given position; without coordinates it carries no active touch. */
function touch(type: 'touchstart' | 'touchmove', x?: number, y?: number): TouchEvent {
  const touches =
    x === undefined
      ? []
      : [new StubTouch({ identifier: 1, target: document.body, clientX: x, clientY: y ?? 0 })];

  return new TouchEvent(type, { touches, bubbles: true, cancelable: true });
}

/** An element in the document with a fresh recognizer wired to it. */
function mountSwipe(bounds?: Pick<Swipe, 'maxX' | 'maxY' | 'minX' | 'minY'>): {
  element: HTMLDivElement;
  swipe: Swipe;
} {
  const element = document.createElement('div');

  document.body.appendChild(element);

  const swipe = new Swipe();

  if (bounds) {
    swipe.minX = bounds.minX;
    swipe.maxX = bounds.maxX;
    swipe.minY = bounds.minY;
    swipe.maxY = bounds.maxY;
  }

  swipe.addListenersToElement(element);

  return { element, swipe };
}

describe('Swipe', () => {
  beforeEach(() => {
    vi.stubGlobal('TouchEvent', StubTouchEvent);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  test('a finger pulled left is a right swipe, reported once with the signed travel', () => {
    const { element, swipe } = mountSwipe();
    const onRightSwipe = vi.fn();
    const onLeftSwipe = vi.fn();
    const onDownSwipe = vi.fn();
    const onUpSwipe = vi.fn();

    swipe.onRightSwipe = onRightSwipe;
    swipe.onLeftSwipe = onLeftSwipe;
    swipe.onDownSwipe = onDownSwipe;
    swipe.onUpSwipe = onUpSwipe;

    element.dispatchEvent(touch('touchstart', 100, 100));
    element.dispatchEvent(touch('touchmove', 50, 90));

    expect(onRightSwipe).toHaveBeenCalledWith(expect.anything(), 50, 10);
    expect(onLeftSwipe).not.toHaveBeenCalled();
    expect(onDownSwipe).not.toHaveBeenCalled();
    expect(onUpSwipe).not.toHaveBeenCalled();

    // The gesture settled on the first comparable move and is closed; the finger may keep moving.
    element.dispatchEvent(touch('touchmove', 0, 0));

    expect(onRightSwipe).toHaveBeenCalledOnce();
  });

  test('a finger pulled right is a left swipe', () => {
    const { element, swipe } = mountSwipe();
    const onLeftSwipe = vi.fn();

    swipe.onLeftSwipe = onLeftSwipe;

    element.dispatchEvent(touch('touchstart', 100, 100));
    element.dispatchEvent(touch('touchmove', 150, 90));

    expect(onLeftSwipe).toHaveBeenCalledWith(expect.anything(), -50, 10);
  });

  test('a tie between the two travels reads vertical, by the vertical delta sign', () => {
    const { element, swipe } = mountSwipe();
    const onDownSwipe = vi.fn();
    const onUpSwipe = vi.fn();

    swipe.onDownSwipe = onDownSwipe;
    swipe.onUpSwipe = onUpSwipe;

    // The finger moved up on screen — the vertical delta is positive, and that names a down swipe.
    element.dispatchEvent(touch('touchstart', 100, 100));
    element.dispatchEvent(touch('touchmove', 50, 50));

    expect(onDownSwipe).toHaveBeenCalledWith(expect.anything(), 50, 50);

    const other = mountSwipe();

    other.swipe.onUpSwipe = onUpSwipe;

    // The finger moved down on screen — a negative vertical delta, so the stroke answers up.
    other.element.dispatchEvent(touch('touchstart', 100, 100));
    other.element.dispatchEvent(touch('touchmove', 150, 150));

    expect(onUpSwipe).toHaveBeenCalledWith(expect.anything(), -50, -50);
    expect(onDownSwipe).toHaveBeenCalledOnce();
  });

  test('a vertical travel larger than the horizontal one settles a vertical direction', () => {
    const { element, swipe } = mountSwipe();
    const onDownSwipe = vi.fn();
    const onUpSwipe = vi.fn();

    swipe.onDownSwipe = onDownSwipe;
    swipe.onUpSwipe = onUpSwipe;

    element.dispatchEvent(touch('touchstart', 100, 100));
    element.dispatchEvent(touch('touchmove', 90, 30));

    expect(onDownSwipe).toHaveBeenCalledWith(expect.anything(), 10, 70);

    const other = mountSwipe();

    other.swipe.onUpSwipe = onUpSwipe;

    other.element.dispatchEvent(touch('touchstart', 100, 100));
    other.element.dispatchEvent(touch('touchmove', 110, 170));

    expect(onUpSwipe).toHaveBeenCalledWith(expect.anything(), -10, -70);
  });

  test('a move with no touch down is ignored', () => {
    const { element, swipe } = mountSwipe();
    const onRightSwipe = vi.fn();

    swipe.onRightSwipe = onRightSwipe;

    element.dispatchEvent(touch('touchmove', 50, 50));

    expect(onRightSwipe).not.toHaveBeenCalled();
  });

  test('a touch start carrying no active touch starts nothing', () => {
    const { element, swipe } = mountSwipe();
    const onRightSwipe = vi.fn();

    swipe.onRightSwipe = onRightSwipe;

    element.dispatchEvent(touch('touchstart'));
    element.dispatchEvent(touch('touchmove', 50, 50));

    expect(onRightSwipe).not.toHaveBeenCalled();
  });

  test('a move with no active touch does not end the gesture', () => {
    const { element, swipe } = mountSwipe();
    const onRightSwipe = vi.fn();

    swipe.onRightSwipe = onRightSwipe;

    element.dispatchEvent(touch('touchstart', 100, 100));
    element.dispatchEvent(touch('touchmove'));
    element.dispatchEvent(touch('touchmove', 50, 90));

    expect(onRightSwipe).toHaveBeenCalledOnce();
  });

  test('a stroke starting outside any bound is discarded silently, gesture closed', () => {
    const cases = [
      { at: [40, 100] as const, bounds: { maxX: null, maxY: null, minX: 50, minY: null } },
      { at: [210, 100] as const, bounds: { maxX: 200, maxY: null, minX: null, minY: null } },
      { at: [100, 40] as const, bounds: { maxX: null, maxY: null, minX: null, minY: 50 } },
      { at: [100, 210] as const, bounds: { maxX: null, maxY: 200, minX: null, minY: null } },
    ];

    for (const { at, bounds } of cases) {
      const { element, swipe } = mountSwipe(bounds);
      const onRightSwipe = vi.fn();

      swipe.onRightSwipe = onRightSwipe;

      element.dispatchEvent(touch('touchstart', at[0], at[1]));
      element.dispatchEvent(touch('touchmove', 150, 100));

      expect(onRightSwipe).not.toHaveBeenCalled();
    }
  });

  test('a stroke starting inside every bound is recognized', () => {
    const { element, swipe } = mountSwipe({ maxX: 200, maxY: 200, minX: 50, minY: 50 });
    const onRightSwipe = vi.fn();

    swipe.onRightSwipe = onRightSwipe;

    element.dispatchEvent(touch('touchstart', 100, 100));
    element.dispatchEvent(touch('touchmove', 20, 90));

    expect(onRightSwipe).toHaveBeenCalledWith(expect.anything(), 80, 10);
  });

  test('the unbounded range runs to the viewport edges and covers the origin', () => {
    const onUpSwipe = vi.fn();

    const outsideWidth = mountSwipe();

    outsideWidth.swipe.onUpSwipe = onUpSwipe;
    outsideWidth.element.dispatchEvent(touch('touchstart', window.innerWidth, 100));
    outsideWidth.element.dispatchEvent(touch('touchmove', window.innerWidth - 20, 50));

    expect(onUpSwipe).not.toHaveBeenCalled();

    const outsideHeight = mountSwipe();

    outsideHeight.swipe.onUpSwipe = onUpSwipe;
    outsideHeight.element.dispatchEvent(touch('touchstart', 100, window.innerHeight));
    outsideHeight.element.dispatchEvent(touch('touchmove', 50, window.innerHeight - 20));

    expect(onUpSwipe).not.toHaveBeenCalled();

    // One inside the far edges, and the origin itself, are both strokes the range allows.
    const insideHeight = mountSwipe();

    insideHeight.element.dispatchEvent(touch('touchstart', 100, window.innerHeight - 1));

    expect(insideHeight.swipe.isSwipeInsideAllowedRange()).toBe(true);

    const insideOrigin = mountSwipe();

    insideOrigin.swipe.onUpSwipe = onUpSwipe;
    insideOrigin.element.dispatchEvent(touch('touchstart', 0, 0));

    expect(insideOrigin.swipe.isSwipeInsideAllowedRange()).toBe(true);
  });

  test('answers false while no touch is down, and reads bounds the fields hold', () => {
    const swipe = new Swipe();

    expect(swipe.isSwipeInsideAllowedRange()).toBe(false);

    // A half-recorded origin is not a stroke: one coordinate present, the other absent.
    swipe.downX = 100;

    expect(swipe.isSwipeInsideAllowedRange()).toBe(false);

    swipe.downX = null;
    swipe.downY = 100;

    expect(swipe.isSwipeInsideAllowedRange()).toBe(false);

    swipe.downX = 1000;
    swipe.downY = 100;
    swipe.minX = 50;

    expect(swipe.isSwipeInsideAllowedRange()).toBe(true);

    swipe.minX = 2000;

    expect(swipe.isSwipeInsideAllowedRange()).toBe(false);
    expect(swipe.downX).toBe(1000);
  });

  test('swiping an unconfigured recognizer reaches every default no-op and throws nothing', () => {
    const { element, swipe } = mountSwipe();

    // One stroke per direction: right, left, down (the vertical positive delta), and up. All four
    // default no-op callbacks run exactly once across these, and none of it throws.
    element.dispatchEvent(touch('touchstart', 200, 200));
    element.dispatchEvent(touch('touchmove', 120, 200));
    element.dispatchEvent(touch('touchstart', 200, 200));
    element.dispatchEvent(touch('touchmove', 280, 200));
    element.dispatchEvent(touch('touchstart', 200, 200));
    element.dispatchEvent(touch('touchmove', 200, 120));
    element.dispatchEvent(touch('touchstart', 200, 200));
    element.dispatchEvent(touch('touchmove', 200, 280));

    expect(swipe.downX).toBeNull();
    expect(swipe.downY).toBeNull();
  });

  test('removing the listeners stops the recognition, and adding them back restores it', () => {
    const { element, swipe } = mountSwipe();
    const onRightSwipe = vi.fn();

    swipe.onRightSwipe = onRightSwipe;

    swipe.removeListenersFromElement(element);
    element.dispatchEvent(touch('touchstart', 100, 100));
    element.dispatchEvent(touch('touchmove', 50, 90));

    expect(onRightSwipe).not.toHaveBeenCalled();

    swipe.addListenersToElement(element);
    element.dispatchEvent(touch('touchstart', 100, 100));
    element.dispatchEvent(touch('touchmove', 50, 90));

    expect(onRightSwipe).toHaveBeenCalledOnce();
  });
});

/** The recognizers each render captured, in order; the current one is at the end. */
let swipes: Swipe[];

beforeEach(() => {
  swipes = [];
});

/** The recognizer the last probe render produced, failing loudly when there is none. */
function currentSwipe(): Swipe {
  const swipe = swipes.at(-1);

  if (swipe === undefined) {
    throw new Error('a SwipeProbe must be rendered before its recognizer is driven');
  }

  return swipe;
}

function SwipeProbe(props: Parameters<typeof useSwipe>[0]) {
  const swipe = useSwipe(props);

  swipes.push(swipe);

  return <div />;
}

describe('useSwipe', () => {
  beforeEach(() => {
    vi.stubGlobal('TouchEvent', StubTouchEvent);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  test('bounds default to null when no bounds are rendered', async () => {
    await render(<SwipeProbe />);

    const swipe = currentSwipe();

    expect(swipe.minX).toBeNull();
    expect(swipe.maxX).toBeNull();
    expect(swipe.minY).toBeNull();
    expect(swipe.maxY).toBeNull();
  });

  test('re-applies the bounds and runs the callbacks a render passes', async () => {
    const right: unknown[] = [];
    const left: unknown[] = [];
    const down: unknown[] = [];
    const up: unknown[] = [];

    await render(<SwipeProbe minX={10} minY={20} />);

    expect(currentSwipe().minX).toBe(10);
    expect(currentSwipe().minY).toBe(20);

    await render(
      <SwipeProbe
        onDownSwipe={(_event, deltaX, deltaY) => down.push(deltaX, deltaY)}
        onLeftSwipe={(_event, deltaX, deltaY) => left.push(deltaX, deltaY)}
        onRightSwipe={(_event, deltaX, deltaY) => right.push(deltaX, deltaY)}
        onUpSwipe={(_event, deltaX, deltaY) => up.push(deltaX, deltaY)}
      />,
    );

    const swipe = currentSwipe();

    expect(swipe.minX).toBeNull();

    const element = document.createElement('div');

    document.body.appendChild(element);
    swipe.addListenersToElement(element);

    element.dispatchEvent(touch('touchstart', 100, 40));
    element.dispatchEvent(touch('touchmove', 60, 10));
    element.dispatchEvent(touch('touchstart', 100, 40));
    element.dispatchEvent(touch('touchmove', 140, 10));
    element.dispatchEvent(touch('touchstart', 100, 40));
    element.dispatchEvent(touch('touchmove', 100, 5));
    element.dispatchEvent(touch('touchstart', 100, 40));
    element.dispatchEvent(touch('touchmove', 100, 70));

    expect(right).toEqual([40, 30]);
    expect(left).toEqual([-40, 30]);
    expect(down).toEqual([0, 35]);
    expect(up).toEqual([0, -30]);
  });

  test('an omitted callback keeps the previously installed one', async () => {
    const onUpSwipe = vi.fn();
    const view = await render(<SwipeProbe onUpSwipe={onUpSwipe} />);

    await view.update(<SwipeProbe />);

    const swipe = currentSwipe();
    const element = document.createElement('div');

    document.body.appendChild(element);
    swipe.addListenersToElement(element);

    // The stroke reads vertical (the horizontal travel is smaller), and the vertical delta lands
    // negative, which is the up direction for this recognizer.
    element.dispatchEvent(touch('touchstart', 100, 100));
    element.dispatchEvent(touch('touchmove', 90, 150));

    expect(onUpSwipe).toHaveBeenCalledOnce();
  });
});

/** The ref the probe owns, as a real caller would; reset per test. */
let probeRef: { current: HTMLDivElement | null };

beforeEach(() => {
  probeRef = { current: null };
});

function PreventionProbe() {
  useSwipePrevention(probeRef);

  return <div ref={probeRef} />;
}

describe('useSwipePrevention', () => {
  beforeEach(() => {
    vi.stubGlobal('TouchEvent', StubTouchEvent);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  test('stops touch events at the element, and unhooks itself on unmount', async () => {
    const added: {
      listener: EventListenerOrEventListenerObject;
      target: EventTarget;
      type: string;
    }[] = [];
    const removed: {
      listener: EventListenerOrEventListenerObject;
      target: EventTarget;
      type: string;
    }[] = [];

    vi.spyOn(HTMLDivElement.prototype, 'addEventListener').mockImplementation(function capture(
      this: HTMLDivElement,
      type,
      listener,
      options,
    ) {
      added.push({ listener, target: this, type });

      return Element.prototype.addEventListener.call(this, type, listener, options);
    });

    vi.spyOn(HTMLDivElement.prototype, 'removeEventListener').mockImplementation(function capture(
      this: HTMLDivElement,
      type,
      listener,
    ) {
      removed.push({ listener, target: this, type });

      return Element.prototype.removeEventListener.call(this, type, listener);
    });

    const view = await render(<PreventionProbe />);

    // The probe's own div is the one inside the render container; the container is its parent.
    const element = view.container.firstElementChild;

    if (element === null) {
      throw new Error('the prevention probe rendered nothing');
    }

    const parent = element.parentElement;
    const stopper = added.find((entry) => entry.target === element && entry.type === 'touchstart');

    expect(stopper).toBeDefined();
    expect(added.some((entry) => entry.target === element && entry.type === 'touchmove')).toBe(
      true,
    );

    const seenOnParent: string[] = [];

    parent?.addEventListener('touchstart', (event) => {
      seenOnParent.push(event.type);
    });

    element.dispatchEvent(touch('touchstart', 10, 10));

    expect(seenOnParent).toEqual([]);

    added.length = 0;
    removed.length = 0;

    view.unmount();

    const stopperBefore = stopper?.listener;

    expect(
      removed.some(
        (entry) =>
          entry.target === element &&
          entry.type === 'touchstart' &&
          entry.listener === stopperBefore,
      ),
    ).toBe(true);
    expect(removed.some((entry) => entry.target === element && entry.type === 'touchmove')).toBe(
      true,
    );
  });

  test('renders fine while the ref is still empty', async () => {
    let renderedSomething = false;

    function EmptyRefProbe() {
      useSwipePrevention(probeRef);

      renderedSomething = true;

      return <div />;
    }

    await render(<EmptyRefProbe />);

    expect(renderedSomething).toBe(true);
    expect(probeRef.current).toBeNull();
  });
});
