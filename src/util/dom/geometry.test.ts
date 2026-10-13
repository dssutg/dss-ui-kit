/**
 * `inViewport` is the visibility check every "is this still on screen" caller — toasts, dropdowns,
 * validation messages — sits on, and its comparisons run against the visual viewport rather than
 * the page, which the suite pins with an element that is inside the document but scrolled out. The
 * fallbacks behind `??` are exercised by removing `window.innerHeight`/`innerWidth` for one
 * viewport read, since jsdom always provides both and the fallback would otherwise never run.
 *
 * `scrollToElement` asserts the `ScrollToOptions` it hands to `window.scrollTo`, whose offset
 * arithmetic is defined by the body's own top: stubbing both rects is what makes the
 * `elementRect.top - bodyRect.top - bias` shape observable.
 */
// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { inViewport, scrollToElement } from './geometry';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

/** Overrides one `window` property for the duration of `run` and restores what was there. */
function withWindowValue(
  key: 'innerHeight' | 'innerWidth',
  value: number | undefined,
  run: () => void,
): void {
  const original = Object.getOwnPropertyDescriptor(window, key);
  Object.defineProperty(window, key, { value, configurable: true });

  try {
    run();
  } finally {
    if (original) {
      Object.defineProperty(window, key, original);
    } else {
      Reflect.deleteProperty(window, key);
    }
  }
}

/** A detached document element whose `getBoundingClientRect` reports the given box. */
function elementAt(box: RectCoordinates): HTMLElement {
  const element = document.createElement('div');
  document.body.appendChild(element);
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(box.left, box.top, box.width, box.height),
  );

  return element;
}

/** What a rect position is built from; `DOMRect` derives `right`/`bottom` from these. */
interface RectCoordinates {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

describe('inViewport', () => {
  test('accepts an element fully inside the viewport, edges inclusive', () => {
    expect(inViewport(elementAt({ left: 0, top: 0, width: 1024, height: 768 }))).toBe(true);
  });

  test('rejects an element above the viewport', () => {
    expect(inViewport(elementAt({ left: 0, top: -20, width: 100, height: 100 }))).toBe(false);
  });

  test('rejects an element left of the viewport', () => {
    expect(inViewport(elementAt({ left: -20, top: 0, width: 100, height: 100 }))).toBe(false);
  });

  test('rejects an element whose bottom is below the fold', () => {
    expect(inViewport(elementAt({ left: 0, top: 700, width: 100, height: 200 }))).toBe(false);
  });

  test('rejects an element whose right edge is outside horizontally', () => {
    expect(inViewport(elementAt({ left: 1000, top: 0, width: 100, height: 100 }))).toBe(false);
  });

  test('falls back to the document element dimensions when the window ones are absent', () => {
    withWindowValue('innerHeight', undefined, () => {
      withWindowValue('innerWidth', undefined, () => {
        expect(inViewport(elementAt({ left: 0, top: 0, width: 1024, height: 768 }))).toBe(true);
        expect(inViewport(elementAt({ left: 0, top: 700, width: 100, height: 200 }))).toBe(false);
      });
    });
  });
});

describe('scrollToElement', () => {
  /**
   * The offset is `elementRect.top - bodyRect.top - bias`; stubbing both rects is what makes that
   * arithmetic observable, and the recording stub stands in for `window.scrollTo`, which jsdom
   * does not implement.
   */
  test('smooth', () => {
    const scrolls = scrolledFor(5, true);

    expect(scrolls[0]).toEqual({ top: 85, left: 0, behavior: 'smooth' });
  });

  test('instant', () => {
    const scrolls = scrolledFor(5, false);

    expect(scrolls[0]).toEqual({ top: 85, left: 0, behavior: 'instant' });
  });

  /** Scrolls one element with both rects stubbed, returning what `window.scrollTo` was told. */
  function scrolledFor(bias: number, smooth: boolean): unknown[] {
    const element = elementAt({ left: 0, top: 100, width: 50, height: 50 });
    vi.spyOn(document.body, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 10, 1200, 800));
    const calls: unknown[] = [];
    const original = Object.getOwnPropertyDescriptor(window, 'scrollTo');
    Object.defineProperty(window, 'scrollTo', {
      value: (options?: ScrollToOptions) => {
        if (options) {
          calls.push(options);
        }
      },
      configurable: true,
    });

    try {
      scrollToElement(element, bias, smooth);
    } finally {
      if (original) {
        Object.defineProperty(window, 'scrollTo', original);
      } else {
        Reflect.deleteProperty(window, 'scrollTo');
      }
    }

    return calls;
  }
});
