import type { HslaColor, HsvaColor, ObjectColor, RgbaColor } from './color_picker_types';

/**
 * Colour conversions for the picker family: the equality checks a {@link ColorModel} needs and the
 * parsers and formatters between every notation and HSVA.
 *
 * HSVA is the model the pickers draw in, so every function here converts to or from it rather than
 * pairing the notations with each other — a family of notations is covered by one converter each,
 * not one per pair. The string parsers are regular expressions and are deliberately forgiving: a
 * value the pattern does not recognise parses, without throwing, to opaque black, which keeps a
 * malformed keystroke from taking a picker down mid-drag.
 */

/**
 * Whether two colours written as objects are the same colour, compared channel by channel.
 *
 * Iteration is over the first object's keys, so the two arguments have to be written in the same
 * notation — the types enforce that, and an extra key on the second would be ignored rather than
 * counted. The picker uses it over two HSVA values, the same notation by construction.
 */
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

/**
 * Whether two colour strings are the same text, ignoring whitespace.
 *
 * Literal rather than colour-aware — `#ff0000` and `rgb(255, 0, 0)` are different strings — because
 * it backs the string pickers, whose colours arrive as text and re-render through their model on
 * every change, so two renders of one colour cannot disagree by anything but spacing.
 */
export function equalColorString(first: string, second: string): boolean {
  return first.replace(/\s/g, '') === second.replace(/\s/g, '');
}

/**
 * Whether two hexadecimal strings name the same colour, whatever form each is written in.
 *
 * A textual comparison would say that `#FFF` and `ffffff` differ, so unequal strings are parsed and
 * compared as channels, which also makes case and the `#` itself irrelevant. Alpha counts as part of
 * the colour, so `#ff0000` and `#ff000080` stay unequal.
 */
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

/**
 * Parses a hexadecimal string into HSVA, accepting the 3, 4, 6 and 8 digit forms with or without the
 * `#`, and an opaque alpha for any form that does not carry one.
 */
export function hexToHsva(hex: string): HsvaColor {
  return rgbaToHsva(hexToRgba(hex));
}

/** Parses a hexadecimal string into RGBA; {@link hexToHsva} documents the accepted forms. */
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

/**
 * Parses a CSS `hsl(...)` or `hsla(...)` string into HSVA, accepting comma and space syntax, the
 * angle units in {@link angleUnits} and the alpha as 0-1 or as a percentage.
 *
 * An unrecognised string parses to opaque black rather than failing: the string pickers hand it a
 * caller's text verbatim, and rejecting it would throw from inside a render.
 */
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

/**
 * Converts an HSLA colour to HSVA, keeping the hue and the alpha and moving the shading from the
 * lightness axis to the value axis.
 */
export function hslaToHsva({ h, s, l, a }: HslaColor): HsvaColor {
  s *= (l < 50 ? l : 100 - l) / 100;

  return {
    h,
    s: s > 0 ? ((2 * s) / (l + s)) * 100 : 0,
    v: l + s,
    a,
  };
}

/** Formats an HSVA colour as a `#rrggbb` string, dropping the alpha: this hex form has no room for it. */
export function hsvaToHex(hsva: HsvaColor): string {
  return rgbaToHex(hsvaToRgba(hsva));
}

/**
 * Converts an HSVA colour to HSLA, keeping the hue and the alpha and moving the shading from the
 * value axis to the lightness axis.
 *
 * Each channel is rounded to an integer or, for the alpha, to two decimal places. A caller who
 * writes the result back into a picker will not get the colour they started with back unchanged;
 * the round trip is one digit deep rather than exact.
 */
export function hsvaToHsla({ h, s, v, a }: HsvaColor): HslaColor {
  const hh = ((200 - s) * v) / 100;

  return {
    h: round(h),
    s: round(hh > 0 && hh < 200 ? ((s * v) / 100 / (hh <= 100 ? hh : 200 - hh)) * 100 : 0),
    l: round(hh / 2),
    a: round(a, 2),
  };
}

/**
 * Formats an HSVA colour as a CSS `hsl(...)` string, without the alpha: it backs the controls, which
 * paint every bar and pointer at full saturation and so have no alpha to lose.
 */
export function hsvaToHslString(hsva: HsvaColor): string {
  const { h, s, l } = hsvaToHsla(hsva);

  return `hsl(${h}, ${s}%, ${l}%)`;
}

/** Formats an HSVA colour as a CSS `hsla(...)` string, the notation the alpha gradient is painted in. */
export function hsvaToHslaString(hsva: HsvaColor): string {
  const { h, s, l, a } = hsvaToHsla(hsva);

  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

/**
 * Converts an HSVA colour to RGBA: sRGB channels scaled to 0-255 and rounded to an integer, alpha
 * kept to two decimal places.
 */
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

/** Formats an HSVA colour as a CSS `rgba(...)` string. */
export function hsvaToRgbaString(hsva: HsvaColor): string {
  const { r, g, b, a } = hsvaToRgba(hsva);

  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Parses a CSS `rgb(...)` or `rgba(...)` string into HSVA.
 *
 * Channels are accepted as 0-255 or as percentages, and the alpha as 0-1 or as a percentage. The
 * notation the CSS grammar makes optional — the `a` in `rgba`, commas against spaces — the pattern
 * tolerates, and an unrecognised string parses to opaque black like every parser here.
 */
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

/**
 * Converts an RGBA colour to HSVA, returning the saturation and the value in percent and the hue in
 * degrees rounded to an integer.
 *
 * A grey — any colour whose channels are equal — has no hue by construction, and `delta` then reads
 * zero, so the hue comes out as 0 rather than as an undefined value.
 */
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

/**
 * Rounds to `digits` decimal places in base 10.
 *
 * Exported because the controls need the same rounding the conversions apply: an aria value or a
 * rendered pointer position that disagreed by a fraction with the colour it describes would drift
 * as a picker is dragged.
 */
export const round = (number: number, digits = 0, base = 10 ** digits): number => {
  return Math.round(base * number) / base;
};
