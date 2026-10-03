import {
  AlphaColorPicker,
  type ColorModel,
  type ColorPickerBaseProperties,
  equalColorString,
  hsvaToRgbaString,
  rgbaStringToHsva,
} from './color_picker';

const colorModelRgbaStringColorPicker: ColorModel<string> = {
  defaultColor: 'rgba(0, 0, 0, 1)',
  toHsva: rgbaStringToHsva,
  fromHsva: hsvaToRgbaString,
  equal: equalColorString,
};

/**
 * An {@link AlphaColorPicker} over a CSS `rgba(...)` string.
 *
 * See {@link HslaStringColorPicker}: the same picker over the other CSS notation.
 */
export function RgbaStringColorPicker(properties: Partial<ColorPickerBaseProperties<string>>) {
  return <AlphaColorPicker {...properties} colorModel={colorModelRgbaStringColorPicker} />;
}
