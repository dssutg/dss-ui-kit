/** A colour as red, green and blue channels, each 0-255. */
export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

/** An {@link RgbColor} with an alpha from 0 to 1. */
export interface RgbaColor extends RgbColor {
  a: number;
}

/** A colour as hue in degrees, with saturation and lightness in percent. */
export interface HslColor {
  h: number;
  s: number;
  l: number;
}

/** An {@link HslColor} with an alpha from 0 to 1. */
export interface HslaColor extends HslColor {
  a: number;
}

/**
 * A colour as hue in degrees, with saturation and value in percent.
 *
 * HSV rather than HSL because it is the model a colour field is drawn in: brightness is one of the two
 * axes of the saturation control, which is what makes dragging it feel like changing the colour.
 */
export interface HsvColor {
  h: number;
  s: number;
  v: number;
}

/** An {@link HsvColor} with an alpha from 0 to 1. */
export interface HsvaColor extends HsvColor {
  a: number;
}

/** Any of the colour shapes above, without the string forms. */
export type ObjectColor = RgbColor | HslColor | HsvColor | RgbaColor | HslaColor | HsvaColor;

/**
 * A colour as one of the shapes or as a string.
 *
 * The string form is deliberately wide: any notation a caller might already hold, parsed by the
 * {@link ColorModel} that goes with it. This is what lets a picker be written once and used over
 * whatever a caller's colour happens to be.
 */
export type AnyColor = string | ObjectColor;

/**
 * How one colour notation is written and compared.
 *
 * The four operations the pickers need and nothing else: a default, a way in from the caller's
 * notation, a way out to it, and equality. Equality is separate because comparing strings would say
 * that `#ff0000` and `rgb(255,0,0)` differ when they are the same colour -- and the picker uses
 * equality to decide whether a change is the caller's or its own coming back.
 */
export interface ColorModel<T extends AnyColor> {
  defaultColor: T;
  toHsva: (defaultColor: T) => HsvaColor;
  fromHsva: (hsva: HsvaColor) => T;
  equal: (first: T, second: T) => boolean;
}

export type ColorPickerHTMLAttributes = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'color' | 'onChange' | 'onChangeCapture'
>;

/**
 * What every picker in this family takes: the colour, and what to call with a new one.
 *
 * The HTML attributes of a `<div>` minus the ones whose names would collide with a colour -- a
 * picker's `color` is the colour, not a CSS attribute -- plus every styling prop, which are forwarded
 * to the element the picker draws into.
 */
export interface ColorPickerBaseProperties<T extends AnyColor> extends ColorPickerHTMLAttributes {
  color: T;
  onChange: (newColor: T) => void;
}

export type ColorInputHTMLAttributes = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value'
>;

export interface ColorInputBaseProperties extends ColorInputHTMLAttributes {
  color?: string | undefined;
  onChange?: (newColor: string) => void;
}

export interface Interaction {
  left: number;
  top: number;
}
