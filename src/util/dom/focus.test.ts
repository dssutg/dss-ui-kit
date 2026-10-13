/**
 * `hasUserFocusedInput` answers whether keyboard shortcuts should be suppressed because the user is
 * typing, so the suite pins exactly which focused elements count (real `INPUT`/`TEXTAREA`, nothing
 * else) and what happens when the document reports no focused element at all — the state a real
 * browser can be in and a jsdom session normally cannot, so `activeElement` is overridden for one
 * read and restored.
 *
 * `onBackdropClick` decides from the target's bounding rect rather than the event's own target, so
 * the tests stub only `getBoundingClientRect` and drive a real `MouseEvent`, asserting whether the
 * callback fired and whether the event was stopped.
 */
// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { hasUserFocusedInput, onBackdropClick } from './focus';

afterEach(() => {
  vi.restoreAllMocks();
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  document.body.innerHTML = '';
});

/** An attached element of the given tag with focus moved onto it. */
function focused(tag: string): HTMLElement {
  const element = document.createElement(tag);
  document.body.appendChild(element);
  element.focus();

  return element;
}

describe('hasUserFocusedInput', () => {
  test('recognises a focused input and textarea', () => {
    expect(focused('input')).toBeInstanceOf(HTMLInputElement);
    expect(hasUserFocusedInput()).toBe(true);

    focused('textarea');
    expect(hasUserFocusedInput()).toBe(true);
  });

  test('answers no for every other kind of focused element', () => {
    expect(hasUserFocusedInput()).toBe(false);

    focused('select');
    expect(hasUserFocusedInput()).toBe(false);

    focused('span');
    expect(hasUserFocusedInput()).toBe(false);
  });

  test('answers no when the document reports no focused element', () => {
    const original = Object.getOwnPropertyDescriptor(document, 'activeElement');
    Object.defineProperty(document, 'activeElement', { value: null, configurable: true });

    try {
      expect(hasUserFocusedInput()).toBe(false);
    } finally {
      if (original) {
        Object.defineProperty(document, 'activeElement', original);
      } else {
        Reflect.deleteProperty(document, 'activeElement');
      }
    }
  });
});

/** A click event at the given viewport position, with `stopPropagation` observable. */
function clickAt(x: number, y: number): MouseEvent {
  const clickEvent = new MouseEvent('click', {
    clientX: x,
    clientY: y,
    bubbles: true,
    cancelable: true,
  });
  vi.spyOn(clickEvent, 'stopPropagation');

  return clickEvent;
}

/** A target panel whose bounding rect is the box 10,10 → 60,60. */
function panel(): HTMLElement {
  const element = document.createElement('div');
  document.body.appendChild(element);
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 10, 50, 50));

  return element;
}

describe('onBackdropClick', () => {
  test('fires the callback when the click landed outside the target rect', () => {
    const onClick = vi.fn(() => {});
    const clickEvent = clickAt(5, 15);

    onBackdropClick(panel(), clickEvent, onClick);

    expect(onClick).toHaveBeenCalledOnce();
  });

  test('does not fire when the click landed inside the rect, border included', () => {
    const onClick = vi.fn(() => {});
    for (const point of [
      [15, 15],
      [10, 10],
      [60, 60],
    ]) {
      onBackdropClick(panel(), clickAt(point[0] ?? 0, point[1] ?? 0), onClick);
    }

    expect(onClick).not.toHaveBeenCalled();
  });

  test('tolerates a target that is already gone from the document', () => {
    const onClick = vi.fn(() => {});
    const clickEvent = clickAt(5, 15);

    onBackdropClick(null, clickEvent, onClick);

    expect(onClick).not.toHaveBeenCalled();
  });

  test('stops the event when asked and by default', () => {
    const insideClick = clickAt(15, 15);
    onBackdropClick(panel(), insideClick, () => {});
    expect(insideClick.stopPropagation).toHaveBeenCalledTimes(1);

    const outsideClick = clickAt(5, 15);
    onBackdropClick(panel(), outsideClick, () => {});
    expect(outsideClick.stopPropagation).toHaveBeenCalledTimes(1);
  });

  test('passes the event through when stopPropagation is off', () => {
    const onClick = vi.fn(() => {});
    const clickEvent = clickAt(5, 15);

    onBackdropClick(panel(), clickEvent, onClick, { stopPropagation: false });

    expect(onClick).toHaveBeenCalledOnce();
    expect(clickEvent.stopPropagation).toHaveBeenCalledTimes(0);
  });
});
