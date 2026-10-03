import type { JSX } from 'react';

import {
  AlphaColorPicker,
  type ColorModel,
  type ColorPickerBaseProperties,
  equalColorString,
  hslaStringToHsva,
  hsvaToHslaString,
} from './color_picker';

const colorModelHslaStringColorPicker: ColorModel<string> = {
  defaultColor: 'hsla(0, 0%, 0%, 1)',
  toHsva: hslaStringToHsva,
  fromHsva: hsvaToHslaString,
  equal: equalColorString,
};

/**
 * An {@link AlphaColorPicker} over a CSS `hsla(...)` string.
 *
 * For a caller whose colours are already CSS text. The string is parsed and re-rendered by the colour
 * model, so a colour with an unusual but valid notation is normalised on the first change.
 */
export function HslaStringColorPicker(
  properties: Partial<ColorPickerBaseProperties<string>>,
): JSX.Element {
  return <AlphaColorPicker {...properties} colorModel={colorModelHslaStringColorPicker} />;
}
