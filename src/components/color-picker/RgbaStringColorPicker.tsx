import {
  AlphaColorPicker,
  type ColorModel,
  type ColorPickerBaseProperties,
  equalColorString,
  hsvaToRgbaString,
  rgbaStringToHsva,
} from './color_picker_internal';

const colorModelRgbaStringColorPicker: ColorModel<string> = {
  defaultColor: 'rgba(0, 0, 0, 1)',
  toHsva: rgbaStringToHsva,
  fromHsva: hsvaToRgbaString,
  equal: equalColorString,
};

export function RgbaStringColorPicker(properties: Partial<ColorPickerBaseProperties<string>>) {
  return <AlphaColorPicker {...properties} colorModel={colorModelRgbaStringColorPicker} />;
}
