// @vitest-environment jsdom

/**
 * Tests for the colour utilities the colour picker is built on: hex parsing, CSS colour
 * normalisation, hsla output, channel interpolation, breakpoint lookup and gradients, darkening
 * and reading a CSS custom property. A failure here would mean the picker blends or resolves
 * colours wrongly, or fails to read the theme values it is meant to inspect.
 */
import { describe, expect, test } from 'vitest';
import {
  cssColorTo6DigitHex,
  darkenColor,
  findBreakPointRange,
  getColorBetweenBreakPoints,
  getCSSVariableValue,
  getHslaColorString,
  lerpRgba32,
  parseHexColor,
  type RGBA32,
  Rgba32Gradient,
} from './';

/** Hex text, in shorthand or full form, becomes the channel object; any other shape is rejected. */
describe('parseHexColor', () => {
  test('parses the six-digit form', () => {
    expect(parseHexColor('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseHexColor('00ff00')).toEqual({ r: 0, g: 255, b: 0 });
  });

  test('parses the three-digit shorthand', () => {
    expect(parseHexColor('#f00')).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseHexColor('123')).toEqual({ r: 17, g: 34, b: 51 });
  });

  test('rejects a form that is neither shorthand nor full', () => {
    expect(() => parseHexColor('#ff')).toThrow('Invalid hex color format');
    expect(() => parseHexColor('#fffffff')).toThrow('Invalid hex color format');
  });
});

/** Any colour CSS accepts is normalised to the six-digit hex form the picker works in. */
describe('cssColorTo6DigitHex', () => {
  test('normalises a colour name through the browser parser', () => {
    expect(cssColorTo6DigitHex('red')).toBe('#ff0000');
  });

  test('keeps a colour css already writes in six digits', () => {
    expect(cssColorTo6DigitHex('rgb(16, 32, 48)')).toBe('#102030');
  });
});

/** An hsla channel object serialises to the exact hsla() string CSS expects. */
describe('getHslaColorString', () => {
  test('writes the hsla notation', () => {
    expect(getHslaColorString({ h: 120, s: 50, l: 25, a: 0.5 })).toBe('hsla(120, 50%, 25%, 0.5)');
  });
});

/** Linear interpolation over RGBA channels, clamped to the endpoints of the [0, 1] range. */
describe('lerpRgba32', () => {
  const white: RGBA32 = { red: 255, green: 255, blue: 255, alpha: 1 };
  const black: RGBA32 = { red: 0, green: 0, blue: 0, alpha: 0 };

  test('blends every channel', () => {
    expect(lerpRgba32(white, black, 0.5)).toEqual({
      red: 127.5,
      green: 127.5,
      blue: 127.5,
      alpha: 0.5,
    });
  });

  test('holds at the endpoints and clamps beyond them', () => {
    expect(lerpRgba32(white, black, 0)).toEqual(white);
    expect(lerpRgba32(white, black, 1)).toEqual(black);
    expect(lerpRgba32(white, black, 2)).toEqual(black);
    expect(lerpRgba32(white, black, -1)).toEqual(white);
  });
});

/** The pair of stops a position lies between, after clamping; a short stop list answers null. */
describe('findBreakPointRange', () => {
  const breakPoints: [number, RGBA32][] = [
    [0, { red: 0, green: 0, blue: 0, alpha: 0 }],
    [0.5, { red: 128, green: 0, blue: 0, alpha: 1 }],
    [1, { red: 255, green: 0, blue: 0, alpha: 1 }],
  ];

  test('answers the pair of stops a position lies between', () => {
    expect(findBreakPointRange(breakPoints, 0.25)).toEqual({
      start: breakPoints[0],
      end: breakPoints[1],
    });
    expect(findBreakPointRange(breakPoints, 0.75)).toEqual({
      start: breakPoints[1],
      end: breakPoints[2],
    });
  });

  test('clamps the position before looking, so the ends resolve to the end pairs', () => {
    expect(findBreakPointRange(breakPoints, -1)).toEqual({
      start: breakPoints[0],
      end: breakPoints[1],
    });
    expect(findBreakPointRange(breakPoints, 2)).toEqual({
      start: breakPoints[1],
      end: breakPoints[2],
    });
  });

  test('answers null for fewer than two stops', () => {
    const first = breakPoints[0];

    if (first === undefined) {
      throw new Error('the list is a literal, so the first entry cannot be missing');
    }

    expect(findBreakPointRange([first], 0)).toBeNull();
  });
});

/** The colour a two-stop segment shows at a position, clamped to the stops at either end. */
describe('getColorBetweenBreakPoints', () => {
  const red: RGBA32 = { red: 255, green: 0, blue: 0, alpha: 1 };
  const blue: RGBA32 = { red: 0, green: 0, blue: 255, alpha: 1 };

  test('blends between the two stops by how far the position has come', () => {
    expect(getColorBetweenBreakPoints([0, red], [1, blue], 0.5)).toEqual({
      red: 127.5,
      green: 0,
      blue: 127.5,
      alpha: 1,
    });
  });

  test('clamps a position past the stops to the endpoint colours', () => {
    expect(getColorBetweenBreakPoints([0.25, red], [0.75, blue], 0)).toEqual(red);
    expect(getColorBetweenBreakPoints([0.25, red], [0.75, blue], 1)).toEqual(blue);
  });
});

/**
 * A gradient over an ordered stop list: positions inside it blend between neighbours, positions
 * outside it hold at the nearest stop, and a missing stop never crashes the getter.
 */
describe('Rgba32Gradient', () => {
  const black: RGBA32 = { red: 0, green: 0, blue: 0, alpha: 0 };
  const white: RGBA32 = { red: 255, green: 255, blue: 255, alpha: 1 };

  test('answers the colour of a position along the stops', () => {
    const gradient = new Rgba32Gradient([
      [0, black],
      [1, white],
    ]);

    expect(gradient.getColor(0.5)).toEqual({ red: 127.5, green: 127.5, blue: 127.5, alpha: 0.5 });
  });

  test('a position below the first stop answers the first stop, not black', () => {
    // The single-stop gradient has no range to blend over; the getter must not fall back to a
    // transparent black nobody wrote.
    const gradient = new Rgba32Gradient([[0.4, white]]);

    expect(gradient.getColor(0.2)).toBe(white);
    expect(gradient.getColor(0.8)).toBe(white);
  });

  test('an index past the stops answers a transparent black rather than failing', () => {
    const gradient = new Rgba32Gradient([[0.4, white]]);

    expect(gradient.getBreakPointColor(9)).toEqual({ red: 0, green: 0, blue: 0, alpha: 0 });
  });
});

/** Darkening never throws on input it cannot parse; it degrades to black instead. */
describe('darkenColor', () => {
  test('reduces each channel by the percentage', () => {
    expect(darkenColor('#ffffff', 0)).toBe('#ffffff');
    expect(darkenColor('#ffffff', 100)).toBe('#000000');
    expect(darkenColor('#ff0000', 50)).toBe('#800000');
  });

  test('answers black for a colour it cannot parse', () => {
    expect(darkenColor('not a hex colour', 50)).toBe('#000000');
    expect(darkenColor('#fff', 50)).toBe('#000000');
  });
});

/** A resolved custom property is read and trimmed; a property nothing sets answers empty. */
describe('getCSSVariableValue', () => {
  test('reads a custom property the document declares', () => {
    document.body.style.setProperty('--testing-variable', '  #123456  ');

    expect(getCSSVariableValue('testing-variable')).toBe('#123456');

    document.body.style.removeProperty('--testing-variable');
  });

  test('answers empty for a property nothing sets', () => {
    expect(getCSSVariableValue('never-declared-variable')).toBe('');
  });
});
