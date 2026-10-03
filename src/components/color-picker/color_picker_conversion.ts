import type { HslaColor, HsvaColor, ObjectColor, RgbaColor } from './color_picker_types';

export function equalColorObjects(first: ObjectColor, second: ObjectColor): boolean {
  if (first === second) {
    return true;
  }

  for (const property in first) {
    // The following allows for a type-safe calling of this function (first & second have to be HSL, HSV, or RGB)
    // with type-unsafe iterating over object keys. TS does not allow this without an index (`[key: string]: number`)
    // on an object to define how iteration is normally done. To ensure extra keys are not allowed on our types,
    // we must cast our object to unknown (as RGB demands `r` be a key, while `Record<string, x>` does not care if
    // there is or not), and then as a type TS can iterate over.
    if (
      (first as unknown as Record<string, number>)[property] !==
      (second as unknown as Record<string, number>)[property]
    ) {
      return false;
    }
  }

  return true;
}

export function equalColorString(first: string, second: string): boolean {
  return first.replace(/\s/g, '') === second.replace(/\s/g, '');
}

export function equalHex(first: string, second: string): boolean {
  if (first.toLowerCase() === second.toLowerCase()) {
    return true;
  }

  // To compare colors like `#FFF` and `ffffff` we convert them into RGB objects
  return equalColorObjects(hexToRgba(first), hexToRgba(second));
}

// Valid CSS <angle> units.
// https://developer.mozilla.org/en-US/docs/Web/CSS/angle
const angleUnits: Record<string, number> = {
  grad: 360 / 400,
  turn: 360,
  rad: 360 / (Math.PI * 2),
};

export function hexToHsva(hex: string): HsvaColor {
  return rgbaToHsva(hexToRgba(hex));
}

function hexToRgba(hex: string): RgbaColor {
  const digits = hex.startsWith('#') ? hex.slice(1) : hex;

  if (digits.length < 6) {
    // Shorthand: `#abc` is `#aabbcc`, so each digit is doubled before it is read. A shorter string
    // than that is not a colour at all, and `charAt` reports the absence as an empty string, which
    // `parseInt` turns into 0 rather than into a crash.
    const doubled = (index: number) => {
      const digit = digits.charAt(index);

      return parseInt(digit + digit, 16);
    };

    return {
      r: doubled(0),
      g: doubled(1),
      b: doubled(2),
      a: digits.length === 4 ? round(doubled(3) / 255, 2) : 1,
    };
  }

  return {
    r: parseInt(digits.slice(0, 2), 16),
    g: parseInt(digits.slice(2, 4), 16),
    b: parseInt(digits.slice(4, 6), 16),
    a: digits.length === 8 ? round(parseInt(digits.slice(6, 8), 16) / 255, 2) : 1,
  };
}

function parseHue(value: string, unit?: string): number {
  return Number(value) * (angleUnits[unit ?? 'deg'] || 1);
}

export function hslaStringToHsva(hslString: string): HsvaColor {
  const matcher =
    /hsla?\(?\s*(-?\d*\.?\d+)(deg|rad|grad|turn)?[\s,]+(-?\d*\.?\d+)%?[\s,]+(-?\d*\.?\d+)%?,?\s*[\s/]*(-?\d*\.?\d+)?(%)?\s*\)?/i;
  const match = matcher.exec(hslString);

  if (!match) {
    return { h: 0, s: 0, v: 0, a: 1 };
  }

  return hslaToHsva({
    h: parseHue(match[1] ?? '0', match[2]),
    s: Number(match[3]),
    l: Number(match[4]),
    a: match[5] === undefined ? 1 : Number(match[5]) / (match[6] ? 100 : 1),
  });
}

export function hslaToHsva({ h, s, l, a }: HslaColor): HsvaColor {
  s *= (l < 50 ? l : 100 - l) / 100;

  return {
    h,
    s: s > 0 ? ((2 * s) / (l + s)) * 100 : 0,
    v: l + s,
    a,
  };
}

export function hsvaToHex(hsva: HsvaColor): string {
  return rgbaToHex(hsvaToRgba(hsva));
}

export function hsvaToHsla({ h, s, v, a }: HsvaColor): HslaColor {
  const hh = ((200 - s) * v) / 100;

  return {
    h: round(h),
    s: round(hh > 0 && hh < 200 ? ((s * v) / 100 / (hh <= 100 ? hh : 200 - hh)) * 100 : 0),
    l: round(hh / 2),
    a: round(a, 2),
  };
}

export function hsvaToHslString(hsva: HsvaColor): string {
  const { h, s, l } = hsvaToHsla(hsva);

  return `hsl(${h}, ${s}%, ${l}%)`;
}

export function hsvaToHslaString(hsva: HsvaColor): string {
  const { h, s, l, a } = hsvaToHsla(hsva);

  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

export function hsvaToRgba({ h, s, v, a }: HsvaColor): RgbaColor {
  h = (h / 360) * 6;
  s = s / 100;
  v = v / 100;

  const hh = Math.floor(h);
  const b = v * (1 - s);
  const c = v * (1 - (h - hh) * s);
  const d = v * (1 - (1 - h + hh) * s);
  // Six sectors, one per 60 degrees of hue, and each channel takes its value from the sector's own
  // column. The sector is wrapped into range because a hue of 360 or -30 is the same colour as one
  // inside the circle, and picking a sector outside the table would have no value to read.
  const sector = ((hh % 6) + 6) % 6;

  const channel = (values: readonly number[]) => round((values[sector] ?? 0) * 255);

  return {
    r: channel([v, c, b, b, d, v]),
    g: channel([d, v, v, c, b, b]),
    b: channel([b, b, d, v, v, c]),
    a: round(a, 2),
  };
}

export function hsvaToRgbaString(hsva: HsvaColor): string {
  const { r, g, b, a } = hsvaToRgba(hsva);

  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function rgbaStringToHsva(rgbaString: string): HsvaColor {
  const matcher =
    /rgba?\(?\s*(-?\d*\.?\d+)(%)?[\s,]+(-?\d*\.?\d+)(%)?[\s,]+(-?\d*\.?\d+)(%)?,?\s*[\s/]*(-?\d*\.?\d+)?(%)?\s*\)?/i;
  const match = matcher.exec(rgbaString);

  if (!match) {
    return { h: 0, s: 0, v: 0, a: 1 };
  }

  return rgbaToHsva({
    r: Number(match[1]) / (match[2] ? 100 / 255 : 1),
    g: Number(match[3]) / (match[4] ? 100 / 255 : 1),
    b: Number(match[5]) / (match[6] ? 100 / 255 : 1),
    a: match[7] === undefined ? 1 : Number(match[7]) / (match[8] ? 100 : 1),
  });
}

function format(number: number) {
  const hex = number.toString(16);

  return hex.length < 2 ? `0${hex}` : hex;
}

function rgbaToHex({ r, g, b, a }: RgbaColor): string {
  const alphaHex = a < 1 ? format(round(a * 255)) : '';

  return `#${format(r)}${format(g)}${format(b)}${alphaHex}`;
}

export function rgbaToHsva({ r, g, b, a }: RgbaColor): HsvaColor {
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);

  // Which of the six hue sectors the colour falls in, named after the channel that is largest.
  let sector = 0;
  if (delta !== 0) {
    if (max === r) {
      sector = (g - b) / delta;
    } else if (max === g) {
      sector = 2 + (b - r) / delta;
    } else {
      sector = 4 + (r - g) / delta;
    }
  }
  const hh = sector;

  return {
    h: round(60 * (hh < 0 ? hh + 6 : hh)),
    s: round(max ? (delta / max) * 100 : 0),
    v: round((max / 255) * 100),
    a,
  };
}

export const round = (number: number, digits = 0, base = 10 ** digits): number => {
  return Math.round(base * number) / base;
};
