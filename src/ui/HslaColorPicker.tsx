import {
  AlphaColorPicker,
  type ColorModel,
  type ColorPickerBaseProperties,
  equalColorObjects,
  type HslaColor,
  hslaToHsva,
  hsvaToHsla,
} from '@/ui/color_picker_internal';

const colorModelHslaColorPicker: ColorModel<HslaColor> = {
  defaultColor: { h: 0, s: 0, l: 0, a: 1 },
  toHsva: hslaToHsva,
  fromHsva: hsvaToHsla,
  equal: equalColorObjects,
};

export function HslaColorPicker(properties: Partial<ColorPickerBaseProperties<HslaColor>>) {
  return <AlphaColorPicker {...properties} colorModel={colorModelHslaColorPicker} />;
}
