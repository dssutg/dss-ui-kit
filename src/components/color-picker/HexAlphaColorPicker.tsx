import type { JSX } from 'react';
import {
  AlphaColorPicker,
  type ColorModel,
  type ColorPickerBaseProperties,
  equalHex,
  hexToHsva,
  hsvaToHex,
} from './color_picker_internal';

const colorModelHexAlphaColorPicker: ColorModel<string> = {
  defaultColor: '0001',
  toHsva: hexToHsva,
  fromHsva: hsvaToHex,
  equal: equalHex,
};

export function HexAlphaColorPicker(
  properties: Partial<ColorPickerBaseProperties<string>>,
): JSX.Element {
  return <AlphaColorPicker {...properties} colorModel={colorModelHexAlphaColorPicker} />;
}
