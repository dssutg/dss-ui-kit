import type { JSX } from 'react';

import {
  AlphaColorPicker,
  type ColorModel,
  type ColorPickerBaseProperties,
  equalColorString,
  hslaStringToHsva,
  hsvaToHslaString,
} from './color_picker_internal';

const colorModelHslaStringColorPicker: ColorModel<string> = {
  defaultColor: 'hsla(0, 0%, 0%, 1)',
  toHsva: hslaStringToHsva,
  fromHsva: hsvaToHslaString,
  equal: equalColorString,
};

export function HslaStringColorPicker(
  properties: Partial<ColorPickerBaseProperties<string>>,
): JSX.Element {
  return <AlphaColorPicker {...properties} colorModel={colorModelHslaStringColorPicker} />;
}
