/**
 * The DOM helpers mix two kinds of contract: `debounce` is plain event-coalescing logic the
 * resizers and search inputs sit on, while `sanitizeHTMLString`, `escapeHTMLValue` and `html` are
 * the rendering path that keeps untrusted values from becoming markup. A failure in either half
 * breaks components outside this directory, which is why it is pinned here.
 */
// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  areDOMRectsEqual,
  DOMRectContainsPoint,
  debounce,
  escapeHTMLValue,
  html,
  sanitizeHTMLString,
} from './';

/**
 * The quiet period restarts on every call, so a burst never produces more than the last call — the
 * behaviour the resizers actually need.
 */
describe('debounce', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('delays the call until the quiet period has passed', () => {
    vi.useFakeTimers();
    const calls: number[] = [];
    const debounced = debounce((...args: readonly unknown[]) => calls.push(Number(args[0])), 100);

    debounced(null, 1);
    expect(calls).toEqual([]);

    vi.advanceTimersByTime(100);
    expect(calls).toEqual([1]);
  });

  test('collapses a burst of calls into the last one', () => {
    vi.useFakeTimers();
    const calls: number[] = [];
    const debounced = debounce((...args: readonly unknown[]) => calls.push(Number(args[0])), 100);

    debounced(null, 1);
    vi.advanceTimersByTime(50);
    debounced(null, 2);
    vi.advanceTimersByTime(50);
    debounced(null, 3);
    vi.advanceTimersByTime(100);

    expect(calls).toEqual([3]);
  });

  test('restarts the quiet period on every call', () => {
    vi.useFakeTimers();
    const calls: number[] = [];
    const debounced = debounce(() => calls.push(1), 100);

    debounced(null);
    vi.advanceTimersByTime(99);
    debounced(null);
    vi.advanceTimersByTime(99);

    expect(calls).toEqual([]);
  });
});

/**
 * The escape helpers are the library's defence against untrusted text becoming markup: every
 * character that could start a tag, attribute or entity is written as an entity, and the `html`
 * template interpolates through the same escaping so a caller cannot forget it.
 */
describe('sanitizeHTMLString', () => {
  test('escapes every character that could start markup', () => {
    expect(sanitizeHTMLString(`<a href="x">&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;',
    );
  });

  test('leaves plain text alone', () => {
    expect(sanitizeHTMLString('plain text')).toBe('plain text');
  });
});

describe('escapeHTMLValue', () => {
  test('sanitises a string', () => {
    expect(escapeHTMLValue('<b>')).toBe('&lt;b&gt;');
  });

  test('stringifies and sanitises a number', () => {
    expect(escapeHTMLValue(1.5)).toBe('1.5');
  });

  test('reads null and undefined as empty', () => {
    expect(escapeHTMLValue(null)).toBe('');
    expect(escapeHTMLValue(undefined)).toBe('');
  });

  test('reads true as true and false as nothing', () => {
    expect(escapeHTMLValue(true)).toBe('true');
    expect(escapeHTMLValue(false)).toBe('');
  });

  test('serialises an object and sanitises the JSON', () => {
    expect(escapeHTMLValue({ key: '<v>' })).toBe('{&quot;key&quot;:&quot;&lt;v&gt;&quot;}');
  });

  test('reads an empty array as nothing', () => {
    expect(escapeHTMLValue([])).toBe('');
  });
});

describe('html', () => {
  test('interpolates escaped values into the template', () => {
    const user = '<script>';

    expect(html`<p>${user}</p>`).toBe('<p>&lt;script&gt;</p>');
  });

  test('leaves the static parts of the template alone', () => {
    expect(html`<p>static</p>`).toBe('<p>static</p>');
  });
});

/** Edge-inclusive containment, because a hit on the border is still on the element. */
describe('DOMRectContainsPoint', () => {
  const rect = { left: 10, right: 20, top: 10, bottom: 20 } as DOMRect;

  test('accepts a point inside the rectangle, edges included', () => {
    expect(DOMRectContainsPoint(rect, 15, 15)).toBe(true);
    expect(DOMRectContainsPoint(rect, 10, 10)).toBe(true);
    expect(DOMRectContainsPoint(rect, 20, 20)).toBe(true);
  });

  test('rejects a point outside the rectangle', () => {
    expect(DOMRectContainsPoint(rect, 5, 15)).toBe(false);
    expect(DOMRectContainsPoint(rect, 25, 15)).toBe(false);
    expect(DOMRectContainsPoint(rect, 15, 5)).toBe(false);
    expect(DOMRectContainsPoint(rect, 15, 25)).toBe(false);
  });
});

/**
 * Rectangle equality is what resize callbacks use to ignore no-op resizes, so it must accept the
 * same object and reject any differing bound.
 */
describe('areDOMRectsEqual', () => {
  const rect = (left: number, width: number) =>
    ({
      left,
      top: 0,
      right: left + width,
      bottom: 10,
      width,
      height: 10,
    }) as DOMRect;

  test('accepts the same object', () => {
    const one = rect(0, 10);

    expect(areDOMRectsEqual(one, one)).toBe(true);
  });

  test('accepts two rectangles with the same bounds', () => {
    expect(areDOMRectsEqual(rect(0, 10), rect(0, 10))).toBe(true);
  });

  test('rejects rectangles that differ in any bound', () => {
    expect(areDOMRectsEqual(rect(0, 10), rect(1, 10))).toBe(false);
    expect(areDOMRectsEqual(rect(0, 10), rect(0, 11))).toBe(false);
  });
});
