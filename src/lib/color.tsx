import { clamp, lerp } from '@/lib/math';

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
