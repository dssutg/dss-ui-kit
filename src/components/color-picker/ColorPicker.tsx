import { type JSX, useRef } from 'react';
import { formatClassName, Hue, Saturation, useColorManipulation } from './color_picker_controls';
import type { AnyColor, ColorModel, ColorPickerBaseProperties } from './color_picker_types';

/**
 * What {@link ColorPicker} takes.
 *
 * `colorModel` says how the colour is written — hex, RGBA, HSLA — and is what makes this component
 * usable over a colour in any of them. Everything else is a styling prop; the behaviour of the
 * controls does not change.
 */
export interface ColorPickerProperties<T extends AnyColor>
  extends Partial<ColorPickerBaseProperties<T>> {
  readonly colorModel: ColorModel<T>;
}

/**
 * A saturation field and a hue bar, for a colour with no transparency.
 *
 * Use {@link AlphaColorPicker} where the alpha channel is part of the value: a picker that dropped
 * alpha on change would report a colour the caller cannot represent.
 */
export function ColorPicker<T extends AnyColor>({
  className,
  colorModel,
  color = colorModel.defaultColor,
  onChange,
  ...rest
}: ColorPickerProperties<T>): JSX.Element {
  const nodeRef = useRef<HTMLDivElement>(null);

  const [hsva, updateHsva] = useColorManipulation<T>(colorModel, color, onChange);

  const nodeClassName = formatClassName(['color-picker-cn', className]);

  return (
    <div {...rest} ref={nodeRef} className={nodeClassName}>
      <Saturation hsva={hsva} onChange={updateHsva} />
      <Hue hue={hsva.h} onChange={updateHsva} className="color-picker-cn__last-control" />
    </div>
  );
}
