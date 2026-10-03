import {
  AlphaColorPicker,
  type ColorModel,
  type ColorPickerBaseProperties,
  equalColorObjects,
  hsvaToRgba,
  type RgbaColor,
  rgbaToHsva,
} from './color_picker';

const colorModelRgbaColorPicker: ColorModel<RgbaColor> = {
  defaultColor: { r: 0, g: 0, b: 0, a: 1 },
  toHsva: rgbaToHsva,
  fromHsva: hsvaToRgba,
  equal: equalColorObjects,
};

export function RgbaColorPicker(properties: Partial<ColorPickerBaseProperties<RgbaColor>>) {
  return <AlphaColorPicker {...properties} colorModel={colorModelRgbaColorPicker} />;
}
