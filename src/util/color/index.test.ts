// SPDX-License-Identifier: MIT
// Tests for the colour utilities the colour picker is built on.
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
  getColorFromBreakPoints,
  getCSSVariableValue,
  getHslaColorString,
  type HexColorBreakPoint,
  lerpRgba32,
  parseHexColor,
  type RGBA32,
  type RGBA32BreakPoint,
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

  test('answers null when the computed colour carries no digits', () => {
    // A keyword the parser cannot resolve computes through unchanged, so there are no rgb values
    // to convert; the function answers null rather than inventing a colour.
    expect(cssColorTo6DigitHex('revert')).toBeNull();
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

  test('answers null when a stop between two others is missing', () => {
    // A JS array can hold holes, which read as undefined, so the guard the bounds cannot reach for
    // a dense list is still reachable at runtime; the function stops rather than reading a hole.
    const first = breakPoints[0];
    const last = breakPoints[2];

    if (first === undefined || last === undefined) {
      throw new Error('the list is a literal, so these entries cannot be missing');
    }

    const sparse = new Array<RGBA32BreakPoint>(3);
    sparse[0] = first;
    sparse[2] = last;

    expect(findBreakPointRange(sparse, 0.25)).toBeNull();
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

/**
 * The hex colour scale is read from the top: the last breakpoint at or below the value is picked,
 * and blending runs the value up towards the next breakpoint without clamping to it, so the scale
 * is one ramp and only a channel pushed out of range settles at the end colour.
 */
describe('getColorFromBreakPoints', () => {
  const scaleStops: HexColorBreakPoint[] = [
    [0, '#000000'],
    [0.5, '#ff0000'],
    [1, '#0000ff'],
  ];

  test('answers an empty string when there are no breakpoints at all', () => {
    expect(getColorFromBreakPoints([], 0.5, true)).toBe('');
    expect(getColorFromBreakPoints([], 0.5, false)).toBe('');
  });

  test('holds the colour of the last breakpoint at or below the value', () => {
    expect(getColorFromBreakPoints(scaleStops, 0.6, false)).toBe('rgb(255 0 0)');
    expect(getColorFromBreakPoints(scaleStops, 0.2, false)).toBe('rgb(0 0 0)');
    expect(getColorFromBreakPoints(scaleStops, 2, false)).toBe('rgb(0 0 255)');
  });

  test('holds the first breakpoint colour for a value below it when not interpolating', () => {
    const lateStops: HexColorBreakPoint[] = [
      [0.5, '#ff0000'],
      [1, '#00ff00'],
    ];

    expect(getColorFromBreakPoints(lateStops, 0.2, false)).toBe('rgb(255 0 0)');
  });

  test('interpolates towards the next breakpoint and truncates the channels', () => {
    expect(getColorFromBreakPoints(scaleStops, 0.25, true)).toBe('rgb(127 0 0)');
    expect(getColorFromBreakPoints(scaleStops, 0.75, true)).toBe('rgb(127 0 127)');
  });

  test('does not clamp a value below the first breakpoint, so the ramp continues outwards', () => {
    const lateStops: [number, string][] = [
      [0.5, '#ff0000'],
      [1, '#00ff00'],
    ];

    // The weight goes negative: red is pushed past its channel ceiling and green below its floor,
    // and the endpoint colour is only reached by that per-channel clamp.
    expect(getColorFromBreakPoints(lateStops, 0.2, true)).toBe('rgb(255 0 0)');
  });

  test('holds the last colour above the top breakpoint, where no next colour exists', () => {
    expect(getColorFromBreakPoints(scaleStops, 2, true)).toBe('rgb(0 0 255)');
  });

  test('blends with a zero weight between two breakpoints at one position', () => {
    const doubled: HexColorBreakPoint[] = [
      [0.5, '#ff0000'],
      [0.5, '#0000ff'],
    ];

    // The scan reads from the top, so the later of two stops at one position is the one held,
    // and the zero range between them weights nothing in either direction.
    expect(getColorFromBreakPoints(doubled, 0.5, true)).toBe('rgb(0 0 255)');
  });

  test('falls back to the lower colour when the next breakpoint is a hole', () => {
    // Holes read as undefined at runtime, and the fallback the bounds cannot see is what answers;
    // the scale then blends nothing in and holds the lower colour.
    const sparse = new Array<HexColorBreakPoint>(3);
    const first = scaleStops[0];
    const last = scaleStops[2];

    if (first === undefined || last === undefined) {
      throw new Error('the stops are a literal, so their entries cannot be missing');
    }

    sparse[0] = first;
    sparse[2] = last;

    expect(getColorFromBreakPoints(sparse, 0.4, true)).toBe('rgb(0 0 0)');
  });
});

/** Darkening never throws on input it cannot parse; it degrades to black instead. */
describe('darkenColor', () => {
  test('reduces each channel by the percentage', () => {
    expect(darkenColor('#ffffff', 0)).toBe('#ffffff');
    expect(darkenColor('#ffffff', 100)).toBe('#000000');
    expect(darkenColor('#ff0000', 50)).toBe('#800000');
  });

  test('darkens a colour the caller wrote spaces around', () => {
    expect(darkenColor('  #408000  ', 50)).toBe('#204000');
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
