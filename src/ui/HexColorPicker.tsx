import type { JSX } from 'react';
import {
  type ColorModel,
  ColorPicker,
  type ColorPickerBaseProperties,
  equalHex,
  hexToHsva,
  hsvaToHex,
} from '@/ui/color_picker_internal';

const colorModelHexColorPicker: ColorModel<string> = {
  defaultColor: '000',
  toHsva: hexToHsva,
  fromHsva: ({ h, s, v }) => hsvaToHex({ h, s, v, a: 1 }),
  equal: equalHex,
};

export function HexColorPicker(
  properties: Partial<ColorPickerBaseProperties<string>>,
): JSX.Element {
  return <ColorPicker {...properties} colorModel={colorModelHexColorPicker} />;
}
