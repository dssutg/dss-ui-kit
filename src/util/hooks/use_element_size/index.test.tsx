// SPDX-License-Identifier: MIT
/**
 * `useElementSize` measures an element at mount and again on every resize, from a `ResizeObserver`.
 * The size starts at zero — nothing has been measured before the first effect — and the observer's
 * `contentRect` is what updates it afterwards. The suite replaces the observer with a controllable
 * double because jsdom has no layout to measure, and holds the parts of the contract that are not
 * the happy path: a ref that was still null measured nothing until a render happens after the
 * element arrives, and a swap of the element re-measures.
 */
// @vitest-environment jsdom

import { useRef } from 'react';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { render } from '@/util/testing/render';
import { useElementSize } from './';

/**
 * The stubbed measurement `setup.ts` installs, captured so an override can be put back exactly.
 * jsdom reports every element at the same fixed size unless a test replaces this.
 */
const stubbedGetBoundingClientRect = window.Element.prototype.getBoundingClientRect;

/** A `ResizeObserver` the test controls: it records what it observes and delivers only when told. */
class RecordingResizeObserver implements ResizeObserver {
  /** Every instance created by the running test, in creation order. */
  static readonly instances: RecordingResizeObserver[] = [];

  private readonly callback: ResizeObserverCallback;

  readonly observed: Element[] = [];

  /** Whether the source has disconnected this observer, recorded for the teardown tests. */
  disconnected = false;

  constructor(callback: ResizeObserverCallback) {
    RecordingResizeObserver.instances.push(this);
    this.callback = callback;
  }

  observe(target: Element): void {
    this.observed.push(target);
  }

  unobserve(): void {
    // The source never calls this, and the double holds no targets.
  }

  disconnect(): void {
    this.disconnected = true;
  }

  /** Delivers the entries to the observer's callback, the way a real observer reports resize. */
  deliver(entries: readonly ResizeObserverEntry[]): void {
    this.callback([...entries], this);
  }
}

/** An observer entry carrying only the content rect the hook reads. */
function entryWith(rect: DOMRect): ResizeObserverEntry {
  return { contentRect: rect } as ResizeObserverEntry;
}

/** Overrides the element measurement jsdom cannot do, with a rect of the test's choosing. */
function measureElementsAs(width: number, height: number): void {
  window.Element.prototype.getBoundingClientRect = () => new DOMRect(0, 0, width, height);
}

/**
 * A probe whose element is replaced when `elementKey` changes, which is how a caller's element is
 * swapped and the hook's effect re-runs. The size is rendered into the DOM so tests assert what a
 * caller would draw at.
 */
function SizeProbe({ elementKey }: { readonly elementKey: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const size = useElementSize(ref);

  return (
    <div>
      <div key={elementKey} ref={ref} data-testid="measured" />
      <div data-testid="view">{`${size.width} ${size.height}`}</div>
    </div>
  );
}

/**
 * A probe whose element is absent while the hook is mounted — the case a caller hits when the thing
 * it measures appears later.
 */
function OptionalElementProbe({ attachElement }: { readonly attachElement: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const size = useElementSize(ref);

  return (
    <div>
      {attachElement ? <div ref={ref} data-testid="measured" /> : null}
      <div data-testid="view">{`${size.width} ${size.height}`}</div>
    </div>
  );
}

describe('useElementSize', () => {
  beforeEach(() => {
    RecordingResizeObserver.instances.length = 0;
    vi.stubGlobal('ResizeObserver', RecordingResizeObserver);
  });

  afterEach(() => {
    window.Element.prototype.getBoundingClientRect = stubbedGetBoundingClientRect;
    vi.unstubAllGlobals();
  });

  test('reads the element size at mount, without waiting for a resize', async () => {
    const view = await render(<SizeProbe elementKey="one" />);

    // jsdom's stubbed element size is what the mount's own read answers.
    expect(view.textContent()).toBe('1024 768');
    expect(RecordingResizeObserver.instances[0]?.observed).toEqual([
      view.find('[data-testid="measured"]'),
    ]);
  });

  test('updates from the content rect the observer reports', async () => {
    measureElementsAs(300, 120);

    const view = await render(<SizeProbe elementKey="one" />);

    const observer = RecordingResizeObserver.instances[0];

    expect(view.textContent()).toBe('300 120');

    // A resize reports a content rect, which is the size a canvas is drawn at.
    await act(() => {
      observer?.deliver([entryWith(new DOMRect(0, 0, 410, 210))]);
    });

    expect(view.textContent()).toBe('410 210');

    // An invocation with no entries changes nothing, and only the first entry of a batch is read.
    await act(() => {
      observer?.deliver([]);
    });

    expect(view.textContent()).toBe('410 210');

    await act(() => {
      observer?.deliver([
        entryWith(new DOMRect(0, 0, 50, 50)),
        entryWith(new DOMRect(0, 0, 999, 999)),
      ]);
    });

    expect(view.textContent()).toBe('50 50');
  });

  test('measures again when the element is swapped for another', async () => {
    measureElementsAs(300, 120);

    const view = await render(<SizeProbe elementKey="one" />);

    const firstElement = view.find('[data-testid="measured"]');

    // The swap itself changes nothing yet: the hook's effect reads the ref on the render that
    // follows the one where the element changed, which is the turn after this update.
    await view.update(<SizeProbe elementKey="two" />);

    const secondElement = view.find('[data-testid="measured"]');

    expect(secondElement).not.toBe(firstElement);
    expect(view.textContent()).toBe('300 120');

    await view.update(<SizeProbe elementKey="two" />);

    // Now the ref points at the new element, and it is measured and observed in its turn.
    expect(view.textContent()).toBe('300 120');

    const observers = RecordingResizeObserver.instances;
    const latestObserver = observers[observers.length - 1];

    expect(latestObserver?.observed).toEqual([secondElement]);

    await act(() => {
      latestObserver?.deliver([entryWith(new DOMRect(0, 0, 7, 9))]);
    });

    expect(view.textContent()).toBe('7 9');
  });

  test('measures nothing while the ref has no element, and starts on the render after it arrives', async () => {
    measureElementsAs(321, 654);

    const view = await render(<OptionalElementProbe attachElement={false} />);

    expect(view.textContent()).toBe('0 0');
    expect(RecordingResizeObserver.instances).toHaveLength(0);

    await view.update(<OptionalElementProbe attachElement={true} />);

    // The element arrived in this commit; the effect re-runs on the render that follows it, once the
    // ref points somewhere.
    expect(view.textContent()).toBe('0 0');
    expect(RecordingResizeObserver.instances).toHaveLength(0);

    await view.update(<OptionalElementProbe attachElement={true} />);

    expect(RecordingResizeObserver.instances).toHaveLength(1);
    expect(view.textContent()).toBe('321 654');
    expect(RecordingResizeObserver.instances[0]?.observed).toEqual([
      view.find('[data-testid="measured"]'),
    ]);
  });

  test('lets go of every observer it replaced, and keeps only the live one', async () => {
    measureElementsAs(300, 120);

    const view = await render(<SizeProbe elementKey="one" />);

    const observers = RecordingResizeObserver.instances;

    // The mount itself replaces its first effect run — the one that measured before the ref
    // settled — so the first observer is already history by the time of the first update.
    expect(observers.length).toBeGreaterThanOrEqual(1);

    await view.update(<SizeProbe elementKey="two" />);
    await view.update(<SizeProbe elementKey="two" />);

    const liveObserver = observers[observers.length - 1];

    // The swap moved the ref to a new element, and the render that follows it measures and
    // observes that element afresh.
    expect(liveObserver?.observed).toEqual([view.find('[data-testid="measured"]')]);

    // Every observer whose element is no longer the one observed has been let go of — without the
    // cleanup each replaced observer would stay attached to the element it was dropped from.
    const replaced = observers.slice(0, -1);

    expect(replaced.length).toBeGreaterThan(0);

    for (const observer of replaced) {
      expect(observer.disconnected).toBe(true);
    }
  });

  test('disconnects the observer when the component unmounts', async () => {
    measureElementsAs(300, 120);

    const view = await render(<SizeProbe elementKey="one" />);

    const observer = RecordingResizeObserver.instances[0];

    view.unmount();

    // The double answers only when told, and delivery finds a listener whose component is gone.
    expect(observer?.disconnected).toBe(true);
    expect(() => {
      observer?.deliver([entryWith(new DOMRect(0, 0, 1, 1))]);
    }).not.toThrow();
  });
});
