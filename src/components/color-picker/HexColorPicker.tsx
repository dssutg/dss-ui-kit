import type { JSX } from 'react';
import {
  type ColorModel,
  ColorPicker,
  type ColorPickerBaseProperties,
  equalHex,
  hexToHsva,
  hsvaToHex,
} from './color_picker';

const colorModelHexColorPicker: ColorModel<string> = {
  defaultColor: '000',
  toHsva: hexToHsva,
  fromHsva: ({ h, s, v }) => hsvaToHex({ h, s, v, a: 1 }),
  equal: equalHex,
};

/**
 * A {@link ColorPicker} over a hexadecimal string, reporting the colour in the same form.
 *
 * Alpha is dropped: a six-digit colour cannot carry transparency, and a picker that reported `#rrggbbaa`
 * for a six-digit input would be changing the value the caller gave it.
 */
export function HexColorPicker(
  properties: Partial<ColorPickerBaseProperties<string>>,
): JSX.Element {
  return <ColorPicker {...properties} colorModel={colorModelHexColorPicker} />;
}
