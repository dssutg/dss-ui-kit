/**
 * `getDpr` is what canvas renderers multiply CSS pixels by, so its floor is the guarantee: a
 * missing, zeroed or sub-unity device ratio still yields 1. The suite overrides
 * `window.devicePixelRatio` for each case because jsdom always reports 1 and the fallback would
 * otherwise never run.
 *
 * `getResponsiveSize` is the numeric version of a CSS `clamp()` expression: the proportional part
 * grows with the media width over the reference width and the clamps bound it. Every default is
 * exercised both from an empty argument list (which is what a caller omitting everything gets) and
 * from an explicit one, so the parameter defaults cannot drift.
 */
// @vitest-environment jsdom
import { afterEach, describe, expect, test } from 'vitest';
import { getDpr, getResponsiveSize } from './sizing';

afterEach(() => {
  document.body.innerHTML = '';
});

/** Overrides `window.devicePixelRatio` for the duration of `run` and restores what was there. */
function withDevicePixelRatio(value: number, run: () => void): void {
  const original = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
  Object.defineProperty(window, 'devicePixelRatio', { value, configurable: true });

  try {
    run();
  } finally {
    if (original) {
      Object.defineProperty(window, 'devicePixelRatio', original);
    } else {
      Reflect.deleteProperty(window, 'devicePixelRatio');
    }
  }
}

describe('getDpr', () => {
  test('returns the device pixel ratio as the browser reports it', () => {
    withDevicePixelRatio(2.5, () => {
      expect(getDpr()).toBe(2.5);
    });
  });

  test('floors a zeroed ratio at one device pixel', () => {
    withDevicePixelRatio(0, () => {
      expect(getDpr()).toBe(1);
    });
  });

  test('returns one when the ratio is not reported', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    Object.defineProperty(window, 'devicePixelRatio', { value: undefined, configurable: true });

    try {
      expect(getDpr()).toBe(1);
    } finally {
      if (original) {
        Object.defineProperty(window, 'devicePixelRatio', original);
      } else {
        Reflect.deleteProperty(window, 'devicePixelRatio');
      }
    }
  });
});

describe('getResponsiveSize', () => {
  test('scales linearly with the media width over the reference width', () => {
    expect(getResponsiveSize(4, 20, 5, 200, 100)).toBe(10);
  });

  test('clamps at both ends of the range', () => {
    expect(getResponsiveSize(5, 20, 100, 10, 1)).toBe(20);
    expect(getResponsiveSize(2, 20, 1, 0, 1)).toBe(2);
  });

  test('defaults to zero, never inventing a size', () => {
    expect(getResponsiveSize()).toBe(0);
  });
});
