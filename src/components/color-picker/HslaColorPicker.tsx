import {
  AlphaColorPicker,
  type ColorModel,
  type ColorPickerBaseProperties,
  equalColorObjects,
  type HslaColor,
  hslaToHsva,
  hsvaToHsla,
} from './color_picker';

const colorModelHslaColorPicker: ColorModel<HslaColor> = {
  defaultColor: { h: 0, s: 0, l: 0, a: 1 },
  toHsva: hslaToHsva,
  fromHsva: hsvaToHsla,
  equal: equalColorObjects,
};

/**
 * A {@link ColorPicker} over an {@link HslaColor} object.
 *
 * For a caller whose colour is a structured HSLA value rather than text; the object is edited in
 * place and reported as a new one.
 */
export function HslaColorPicker(
  properties: Partial<ColorPickerBaseProperties<HslaColor>>,
): React.JSX.Element {
  return <AlphaColorPicker {...properties} colorModel={colorModelHslaColorPicker} />;
}
