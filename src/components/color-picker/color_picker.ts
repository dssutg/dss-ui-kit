/**
 * The colour picker family in one import site: the two pickers every other one is built from, the
 * text field for a colour, and the conversions and shared types.
 *
 * The pickers over a specific notation — hex, `hsla()`, `rgba()` — are the base pickers over a
 * written-out {@link ColorModel}, and everything they need they take from here rather than from
 * their siblings one by one. Colour state inside the family is HSVa whatever notation a caller
 * holds: every model converts on the way in and back on the way out, which is why the conversion
 * helpers are part of the same barrel as the components they serve.
 */

export {
  AlphaColorPicker,
  type AlphaColorPickerProperties,
} from './AlphaColorPicker';
export { ColorInput, type ColorInputProperties } from './ColorInput';
export { ColorPicker, type ColorPickerProperties } from './ColorPicker';
export {
  equalColorObjects,
  equalColorString,
  equalHex,
  hexToHsva,
  hslaStringToHsva,
  hslaToHsva,
  hsvaToHex,
  hsvaToHsla,
  hsvaToHslaString,
  hsvaToRgba,
  hsvaToRgbaString,
  rgbaStringToHsva,
  rgbaToHsva,
} from './color_picker_conversion';
export type {
  AnyColor,
  ColorInputBaseProperties,
  ColorInputHTMLAttributes,
  ColorModel,
  ColorPickerBaseProperties,
  ColorPickerHTMLAttributes,
  HslaColor,
  HslColor,
  HsvaColor,
  HsvColor,
  ObjectColor,
  RgbaColor,
  RgbColor,
} from './color_picker_types';
