import { describe, expect, it } from 'vitest';
import { getColorFromBreakPoints } from './color';

/**
 * `getColorFromBreakPoints` turns a number an instrument reported into the one thing on a ring an
 * operator reads without a label, so the rules are pinned here rather than left to be seen on a
 * canvas: which breakpoint wins at a boundary, what a value off either end of the scale does, and
 * what happens when there is no scale at all.
 */

const GREEN: [number, string] = [0, '#00ff00'];
const YELLOW: [number, string] = [50, '#ffff00'];
const RED: [number, string] = [100, '#ff0000'];

describe('getColorFromBreakPoints', () => {
  it('picks the colour of the last breakpoint at or below the value', () => {
    const breakPoints = [GREEN, YELLOW, RED];

    expect(getColorFromBreakPoints(breakPoints, 0, false)).toBe('rgb(0 255 0)');
    expect(getColorFromBreakPoints(breakPoints, 49, false)).toBe('rgb(0 255 0)');
    expect(getColorFromBreakPoints(breakPoints, 50, false)).toBe('rgb(255 255 0)');
    expect(getColorFromBreakPoints(breakPoints, 99, false)).toBe('rgb(255 255 0)');
    expect(getColorFromBreakPoints(breakPoints, 100, false)).toBe('rgb(255 0 0)');
  });

  it('picks the first colour for a value below the first breakpoint', () => {
    expect(getColorFromBreakPoints([YELLOW, RED], 10, false)).toBe('rgb(255 255 0)');
  });

  it('picks the last colour for a value above the last breakpoint', () => {
    expect(getColorFromBreakPoints([GREEN, YELLOW], 500, false)).toBe('rgb(255 255 0)');
  });

  it('blends towards the next breakpoint when interpolating', () => {
    // Halfway from green to yellow.
    expect(getColorFromBreakPoints([GREEN, YELLOW], 25, true)).toBe('rgb(127 255 0)');
  });

  it('ramps on below the first breakpoint instead of holding its colour', () => {
    // The scale is one continuous ramp, so a value under the first breakpoint is still partway along
    // it: 10 of 50 is a fifth of the way from green to yellow, not green. Only a value far enough
    // below runs the channel out and the clamp brings it back to the first colour.
    expect(getColorFromBreakPoints([GREEN, YELLOW], 10, true)).toBe('rgb(51 255 0)');
    expect(getColorFromBreakPoints([GREEN, YELLOW], -20, true)).toBe('rgb(0 255 0)');
  });

  it('holds the last colour above the last breakpoint, having no next one to blend towards', () => {
    expect(getColorFromBreakPoints([GREEN, YELLOW, RED], 500, true)).toBe('rgb(255 0 0)');
  });

  it('holds the only colour when there is a single breakpoint', () => {
    expect(getColorFromBreakPoints([RED], 40, true)).toBe('rgb(255 0 0)');
  });

  it('takes the last of two breakpoints sharing a position', () => {
    expect(getColorFromBreakPoints([GREEN, [0, '#ff0000']], 0, true)).toBe('rgb(255 0 0)');
    expect(getColorFromBreakPoints([GREEN, [0, '#ff0000']], 0, false)).toBe('rgb(255 0 0)');
  });

  it('resolves to no colour when there are no breakpoints', () => {
    expect(getColorFromBreakPoints([], 0, false)).toBe('');
    expect(getColorFromBreakPoints([], 50, true)).toBe('');
  });
});
