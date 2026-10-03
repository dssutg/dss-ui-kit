import { clamp, lerp } from './math';

export interface HslaColor {
  h: number;
  s: number;
  l: number;
  a: number;
}

export function cssColorTo6DigitHex(color: string) {
  // Create a temporary DOM element to use the browser's parsing
  const temporaryElement = document.createElement('div');

  temporaryElement.style.color = color;
  document.body.appendChild(temporaryElement);

  // Get the computed color value
  const computedColor = getComputedStyle(temporaryElement).color;

  temporaryElement.remove();

  // Parse the RGB value
  const rgbValues = computedColor.match(/\d+/g);

  if (!rgbValues) {
    return null;
  }

  // Convert to hex
  const hex = rgbValues
    .map((value) => {
      const hex = parseInt(value, 10).toString(16).padStart(2, '0');

      return hex;
    })
    .join('');

  return `#${hex}`;
}

/**
 * The value of a CSS custom property as the browser currently resolves it.
 *
 * Read from the computed style of an element rather than from the stylesheet, because a custom property
 * is only known once a theme has set it on something. Returns an empty string for a property that is
 * not set, which is what a caller gets when no theme is active.
 */
export function getCSSVariableValue(variableName: string): string {
  const styles = getComputedStyle(document.body);

  return styles.getPropertyValue(`--${variableName}`).trim();
}

export function parseHexColor(hexColor: string): {
  r: number;
  g: number;
  b: number;
} {
  const shortHandDigitCount = 3;
  const fullFormDigitCount = 6;

  function expandColor(hexDigits: string) {
    if (hexDigits.length === fullFormDigitCount) {
      return hexDigits;
    }

    return hexDigits
      .split('')
      .map((char) => `${char}${char}`)
      .join('');
  }

  // Remove the hash at the start if it's there
  const hexDigits = hexColor.replace(/^#/, '');

  // Check if the hex color is valid
  if (hexDigits.length !== shortHandDigitCount && hexDigits.length !== fullFormDigitCount) {
    throw new Error('Invalid hex color format');
  }

  // If it's a shorthand (3 digits), expand it to 6 digits
  const sixDigitColor = expandColor(hexDigits);

  // Parse the red, green, and blue components
  const r = parseInt(sixDigitColor.slice(0, 0 + 2), 16);
  const g = parseInt(sixDigitColor.slice(2, 2 + 2), 16);
  const b = parseInt(sixDigitColor.slice(4, 4 + 2), 16);

  return { r, g, b };
}

export function getHslaColorString(color: HslaColor) {
  const { h, s, l, a } = color;

  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

/**
 * A colour as four channels, each from 0 to 255 with alpha from 0 to 1.
 *
 * 32-bit rather than a float triple because that is what the GPU wants and what a canvas context reads
 * back, so nothing has to be converted on the way to a buffer.
 */
export interface RGBA32 {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

export function lerpRgba32(a: Readonly<RGBA32>, b: Readonly<RGBA32>, progress: number): RGBA32 {
  const t = clamp(progress, 0, 1);

  const red = lerp(a.red, b.red, t);
  const green = lerp(a.green, b.green, t);
  const blue = lerp(a.blue, b.blue, t);
  const alpha = lerp(a.alpha, b.alpha, t);

  return { red, green, blue, alpha };
}

/** One stop of a gradient: a position from 0 to 1 and the colour there. */
export type RGBA32BreakPoint = [number, RGBA32];

export function findBreakPointRange(breakPoints: readonly RGBA32BreakPoint[], position: number) {
  const clampedPosition = clamp(position, 0, 1);

  for (let i = 0; i < breakPoints.length - 1; i++) {
    const start = breakPoints[i];
    const end = breakPoints[i + 1];

    // The loop bound already excludes the last index, so this cannot happen. It is here because the
    // compiler cannot see that `i` is in range, and an assertion would be a claim rather than a check.
    if (start === undefined || end === undefined) {
      break;
    }

    if (clampedPosition < start[0] || clampedPosition > end[0]) {
      continue;
    }

    return { start, end };
  }

  return null;
}

export function getColorBetweenBreakPoints(
  a: RGBA32BreakPoint,
  b: RGBA32BreakPoint,
  position: number,
) {
  const clampedPosition = clamp(position, 0, 1);

  const [start, startColor] = a;
  const [end, endColor] = b;

  const progress = (clampedPosition - start) / (end - start);

  return lerpRgba32(startColor, endColor, progress);
}

/**
 * A gradient over {@link RGBA32BreakPoint}s, evaluated at any position from 0 to 1.
 *
 * The stops are the caller's and are taken as given — sorted, or not — because the order a caller
 * writes them in is the order they meant; a gradient whose stops were silently sorted would draw
 * something other than what was written.
 */
export class Rgba32Gradient {
  private breakPoints: readonly RGBA32BreakPoint[];

  constructor(breakPoints: readonly RGBA32BreakPoint[]) {
    this.breakPoints = breakPoints;
  }

  getBreakPointColor(breakPointIndex: number): RGBA32 {
    const breakPoint = this.breakPoints[breakPointIndex];

    const defaultColor: RGBA32 = { red: 0, green: 0, blue: 0, alpha: 0 };

    return breakPoint === undefined ? defaultColor : breakPoint[1];
  }

  getColor(position: number): RGBA32 {
    const breakPointRange = findBreakPointRange(this.breakPoints, position);

    if (breakPointRange === null) {
      return this.getBreakPointColor(0);
    }

    const { start, end } = breakPointRange;

    return getColorBetweenBreakPoints(start, end, position);
  }
}

const DEFAULT_COLOR = '#000000';

export function darkenColor(color: string, percent: number) {
  // Parsed RGB
  const match = color.match(/^\s*#([\dA-Fa-f]{2})([\dA-Fa-f]{2})([\dA-Fa-f]{2})\s*$/);

  if (match === null) {
    return DEFAULT_COLOR;
  }

  const [red, green, blue] = match.slice(1).map((sequence) => parseInt(sequence, 16));

  if (red === undefined || green === undefined || blue === undefined) {
    return DEFAULT_COLOR;
  }

  // New RGB
  const newR = (red * (100 - percent)) / 100;
  const newG = (green * (100 - percent)) / 100;
  const newB = (blue * (100 - percent)) / 100;

  // Clamped RGB
  const clampedR = Math.round(Math.min(newR, 255));
  const clampedG = Math.round(Math.min(newG, 255));
  const clampedB = Math.round(Math.min(newB, 255));

  // String RGB
  const stringR = clampedR.toString(16).padStart(2, '0');
  const stringG = clampedG.toString(16).padStart(2, '0');
  const stringB = clampedB.toString(16).padStart(2, '0');

  return `#${stringR}${stringG}${stringB}`;
}

/** A position in a scale and the hex colour that applies from it upwards. */
export type HexColorBreakPoint = readonly [position: number, color: string];

/**
 * The colour for a value, chosen from breakpoints already ordered by position.
 *
 * The value picks the last breakpoint at or below it, and interpolating blends that one towards the
 * next. The blend weight is deliberately not clamped, so the scale is one continuous ramp: a value
 * below the first breakpoint is still partway along it rather than held at its endpoint, and only
 * extrapolating far enough to run a channel out of range settles on the endpoint colour. Above the
 * last breakpoint there is no next breakpoint to blend towards, so the value holds that colour.
 *
 * Returns an empty string when there are no breakpoints at all. A caller asked for a colour it was
 * never given has nothing to draw, and saying so by producing no colour beats throwing part way
 * through a paint — this is reached from a canvas draw, where an exception leaves nothing on screen.
 */
export function getColorFromBreakPoints(
  breakPoints: readonly HexColorBreakPoint[],
  value: number,
  interpolate: boolean,
): string {
  const firstBreakPoint = breakPoints[0];

  if (firstBreakPoint === undefined) {
    return '';
  }

  let index = 0;

  for (let i = breakPoints.length - 1; i >= 0; i--) {
    const breakPoint = breakPoints[i];

    if (breakPoint !== undefined && value >= breakPoint[0]) {
      index = i;
      break;
    }
  }

  // Both indexes come from the array's own bounds, so these fallbacks cannot be reached for a list
  // that got past the empty check above. They are spelled out because the compiler cannot see that,
  // and an assertion would trade a question for a claim.
  const below = breakPoints[index] ?? firstBreakPoint;

  if (!interpolate) {
    const { r, g, b } = parseHexColor(below[1]);

    return `rgb(${r} ${g} ${b})`;
  }

  const nextIndex = Math.min(index + 1, breakPoints.length - 1);
  const above = breakPoints[nextIndex] ?? below;

  const [belowPosition, belowColor] = below;
  const [abovePosition, aboveColor] = above;

  const rgbBelow = parseHexColor(belowColor);
  const rgbAbove = parseHexColor(aboveColor);

  const range = Math.abs(abovePosition - belowPosition);
  const weight = range === 0 ? 0 : (value - belowPosition) / range;

  // Clamped per channel rather than across the weight, and truncated because a canvas `fillStyle`
  // ignores the fraction and `rgb(127.5 255 0)` is not a colour a renderer is required to accept.
  const channel = (from: number, to: number) => Math.trunc(clamp(lerp(from, to, weight), 0, 255));

  return `rgb(${channel(rgbBelow.r, rgbAbove.r)} ${channel(rgbBelow.g, rgbAbove.g)} ${channel(rgbBelow.b, rgbAbove.b)})`;
}
