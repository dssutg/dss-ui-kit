// SPDX-License-Identifier: MIT
/**
 * `useDocumentScrollPercentage` reports how far through the document the reader is, from 0 to 100 —
 * read off the document element, clamped, and updated on every scroll. The suite drives real scroll
 * events, holds the percentage against known document dimensions, and covers the parts of the read
 * that exist for browsers jsdom does not model: a missing `window.scrollY` answered from the
 * document element, and a missing scroll position answered with zero.
 */
// @vitest-environment jsdom

import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, test } from 'vitest';
import { render } from '@/util/testing/render';
import { useDocumentScrollPercentage } from './';

function Probe() {
  const percentage = useDocumentScrollPercentage();

  return <div data-testid="view">{String(percentage)}</div>;
}

/** The overrides the running test installed on the window or on an element, to unwind afterwards. */
const restores: Array<() => void> = [];

/**
 * Overrides one numeric property with a getter for the test, restoring whatever was there before.
 * `undefined` and `null` values stand in for the missing measurements a browser can report.
 */
function overrideMeasurement(
  target: HTMLElement | Window,
  name: string,
  value: number | null | undefined,
): void {
  const previous: PropertyDescriptor | undefined = Object.getOwnPropertyDescriptor(target, name);

  Object.defineProperty(target, name, {
    configurable: true,
    get: () => value,
  });

  restores.push(() => {
    if (previous === undefined) {
      Reflect.deleteProperty(target, name);
    } else {
      Object.defineProperty(target, name, previous);
    }
  });
}

/** Sizes the document the hook reads, as a renderer with layout would. */
function setDocumentLayout(scrollHeight: number, clientHeight: number): void {
  overrideMeasurement(document.documentElement, 'scrollHeight', scrollHeight);
  overrideMeasurement(document.documentElement, 'clientHeight', clientHeight);
}

describe('useDocumentScrollPercentage', () => {
  afterEach(() => {
    for (const restore of restores.splice(0).reverse()) {
      restore();
    }
  });

  test('reports zero with nothing scrolled', async () => {
    setDocumentLayout(2000, 500);

    const view = await render(<Probe />);

    // jsdom answers `window.scrollY` with 0, so there is nothing scrolled and nothing to report.
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    expect(view.textContent()).toBe('0');
  });

  test('reports how far through the document the reader is', async () => {
    setDocumentLayout(2000, 500);

    const view = await render(<Probe />);

    // A scrollable range of 1500 pixels, 300 of it behind the reader: twenty percent of the page.
    overrideMeasurement(window, 'scrollY', 300);

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    expect(view.textContent()).toBe('20');

    // Past the range, the answer saturates at 100 rather than running away.
    overrideMeasurement(window, 'scrollY', 1600);

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    expect(view.textContent()).toBe('100');

    // Under the range — the bounce-back of a touch screen — the answer stays at 0.
    overrideMeasurement(window, 'scrollY', -100);

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    expect(view.textContent()).toBe('0');
  });

  test('falls back to the document element when the window reports no scroll position', async () => {
    setDocumentLayout(2000, 500);

    const view = await render(<Probe />);

    overrideMeasurement(window, 'scrollY', undefined);
    overrideMeasurement(document.documentElement, 'scrollTop', 37.5);

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    expect(view.textContent()).toBe('2.5');
  });

  test('answers zero when neither the window nor the document element has a scroll position', async () => {
    setDocumentLayout(2000, 500);

    const view = await render(<Probe />);

    overrideMeasurement(window, 'scrollY', undefined);
    overrideMeasurement(document.documentElement, 'scrollTop', null);

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    expect(view.textContent()).toBe('0');
  });
});
