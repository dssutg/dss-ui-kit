import type { JSX } from 'react';
import {
  AlphaColorPicker,
  type ColorModel,
  type ColorPickerBaseProperties,
  equalHex,
  hexToHsva,
  hsvaToHex,
} from './color_picker';

const colorModelHexAlphaColorPicker: ColorModel<string> = {
  defaultColor: '0001',
  toHsva: hexToHsva,
  fromHsva: hsvaToHex,
  equal: equalHex,
};

/**
 * An {@link AlphaColorPicker} over a hexadecimal string with alpha.
 *
 * The colour is reported as the hexadecimal string the caller passed in, so this is the picker to use
 * where a colour is stored as text — in a stylesheet, a payload or a form.
 */
export function HexAlphaColorPicker(
  properties: Partial<ColorPickerBaseProperties<string>>,
): JSX.Element {
  return <AlphaColorPicker {...properties} colorModel={colorModelHexAlphaColorPicker} />;
}
