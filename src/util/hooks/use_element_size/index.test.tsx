// SPDX-License-Identifier: MIT
/**
 * `useElementSize` measures an element at mount and again on every resize, from a `ResizeObserver`.
 * The size starts at zero — nothing has been measured before the first effect — and the observer's
 * `contentRect` is what updates it afterwards. The suite replaces the observer with a controllable
 * double because jsdom has no layout to measure, and holds the parts of the contract that are not
 * the happy path: the mount creates one observer rather than one per render, an element that arrives
 * later is measured on the commit that brings it, a swap of the element re-measures and lets the
 * observer of the element it left behind go, and an element that goes away takes its observer with
 * it.
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

    // One observer, not one per render: the element was measured by the effect that observed it,
    // and nothing re-ran that effect afterwards.
    expect(RecordingResizeObserver.instances).toHaveLength(1);
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
    const firstObserver = RecordingResizeObserver.instances[0];

    // The next element measures differently, so a size carried over from the first would not pass
    // for a measurement of the second.
    measureElementsAs(200, 50);

    await view.update(<SizeProbe elementKey="two" />);

    const secondElement = view.find('[data-testid="measured"]');

    expect(secondElement).not.toBe(firstElement);

    // The commit that swapped the element is the one the hook moved with it: the ref is read after
    // the commit, so the new element is measured without a render of the caller's own to follow.
    expect(view.textContent()).toBe('200 50');

    const observers = RecordingResizeObserver.instances;
    const liveObserver = observers[1];

    expect(observers).toHaveLength(2);
    expect(liveObserver?.observed).toEqual([secondElement]);
    expect(firstObserver?.disconnected).toBe(true);

    // A further render with the same element leaves the observer where it is.
    await view.update(<SizeProbe elementKey="two" />);

    expect(RecordingResizeObserver.instances).toHaveLength(2);

    await act(() => {
      liveObserver?.deliver([entryWith(new DOMRect(0, 0, 7, 9))]);
    });

    expect(view.textContent()).toBe('7 9');
  });

  test('measures nothing while the ref has no element, and starts when it arrives', async () => {
    measureElementsAs(321, 654);

    const view = await render(<OptionalElementProbe attachElement={false} />);

    expect(view.textContent()).toBe('0 0');
    expect(RecordingResizeObserver.instances).toHaveLength(0);

    await view.update(<OptionalElementProbe attachElement={true} />);

    // The commit that attached the element is the one the hook picked it up on.
    expect(view.textContent()).toBe('321 654');
    expect(RecordingResizeObserver.instances).toHaveLength(1);
    expect(RecordingResizeObserver.instances[0]?.observed).toEqual([
      view.find('[data-testid="measured"]'),
    ]);

    // A further render of the same element does not re-observe it.
    await view.update(<OptionalElementProbe attachElement={true} />);

    expect(view.textContent()).toBe('321 654');
    expect(RecordingResizeObserver.instances).toHaveLength(1);
  });

  test('disconnects the observer when the element goes away, and keeps the last size', async () => {
    measureElementsAs(300, 120);

    const view = await render(<OptionalElementProbe attachElement={true} />);

    const observer = RecordingResizeObserver.instances[0];

    expect(observer?.observed).toEqual([view.find('[data-testid="measured"]')]);

    await view.update(<OptionalElementProbe attachElement={false} />);

    // The node is gone, so its observer is let go rather than left watching a detached element.
    expect(RecordingResizeObserver.instances).toHaveLength(1);
    expect(observer?.disconnected).toBe(true);

    // The size the element last had is what a caller still holds; the next element re-measures it.
    expect(view.textContent()).toBe('300 120');
  });

  test('lets go of every observer it replaced, and keeps only the live one', async () => {
    measureElementsAs(300, 120);

    const view = await render(<SizeProbe elementKey="one" />);

    await view.update(<SizeProbe elementKey="two" />);
    await view.update(<SizeProbe elementKey="one" />);
    await view.update(<SizeProbe elementKey="two" />);

    // One observer per element the hook has followed — the mount's and one per swap — and no
    // observer for a render that left the element where it was.
    expect(RecordingResizeObserver.instances).toHaveLength(4);

    const liveObserver = RecordingResizeObserver.instances[3];

    expect(liveObserver?.observed).toEqual([view.find('[data-testid="measured"]')]);
    expect(liveObserver?.disconnected).toBe(false);

    // Every observer whose element the hook left behind has been let go of — without the cleanup
    // each replaced observer would stay attached to the element it was dropped from.
    for (const replaced of RecordingResizeObserver.instances.slice(0, 3)) {
      expect(replaced.disconnected).toBe(true);
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
