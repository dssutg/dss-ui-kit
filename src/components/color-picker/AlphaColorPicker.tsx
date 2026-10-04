import { type JSX, useRef } from 'react';
import { cn } from '@/util/cn';
import { clamp } from '@/util/math';
import {
  Hue,
  Interactive,
  Pointer,
  Saturation,
  useColorManipulation,
} from './color_picker_controls';
import { hsvaToHslaString, round } from './color_picker_conversion';
import type {
  AnyColor,
  ColorModel,
  ColorPickerBaseProperties,
  HsvaColor,
  Interaction,
} from './color_picker_types';

/**
 * What {@link AlphaColorPicker} takes. The same as {@link ColorPicker}, over a colour that has an
 * alpha channel.
 */
export interface AlphaColorPickerProperties<T extends AnyColor>
  extends Partial<ColorPickerBaseProperties<T>> {
  readonly colorModel: ColorModel<T>;
}

/**
 * A saturation field with hue, alpha and brightness bars.
 *
 * {@link ColorPicker} plus the two bars that a colour with transparency needs, in the order they are
 * read: pick the colour, then how much of it.
 */
export function AlphaColorPicker<T extends AnyColor>({
  className,
  colorModel,
  color = colorModel.defaultColor,
  onChange,
  ...rest
}: AlphaColorPickerProperties<T>): JSX.Element {
  const nodeRef = useRef<HTMLDivElement>(null);

  const [hsva, updateHsva] = useColorManipulation<T>(colorModel, color, onChange);

  const nodeClassName = cn('color-picker-cn', className);

  return (
    <div {...rest} ref={nodeRef} className={nodeClassName}>
      <Saturation hsva={hsva} onChange={updateHsva} />
      <Hue hue={hsva.h} onChange={updateHsva} />
      <Alpha hsva={hsva} onChange={updateHsva} className="color-picker-cn__last-control" />
    </div>
  );
}

interface AlphaProperties {
  readonly className?: string | undefined;
  readonly hsva: HsvaColor;
  readonly onChange: (newAlpha: { a: number }) => void;
}

function Alpha({ className, hsva, onChange }: AlphaProperties): JSX.Element {
  const handleMove = (interaction: Interaction) => {
    onChange({ a: interaction.left });
  };

  const handleKey = (offset: Interaction) => {
    // Alpha always fit into [0, 1] range
    onChange({ a: clamp(hsva.a + offset.left, 0, 1) });
  };

  // We use `Object.assign` instead of the spread operator
  // to prevent adding the polyfill (about 150 bytes gzipped)
  const colorFrom = hsvaToHslaString({ ...hsva, a: 0 });
  const colorTo = hsvaToHslaString({ ...hsva, a: 1 });

  const gradientStyle = {
    backgroundImage: `linear-gradient(90deg, ${colorFrom}, ${colorTo})`,
  };

  const nodeClassName = cn('color-picker-cn__alpha', className);
  const ariaValue = round(hsva.a * 100);

  return (
    <div className={nodeClassName}>
      <div className="color-picker-cn__alpha-gradient" style={gradientStyle} />
      <Interactive
        onMove={handleMove}
        onKey={handleKey}
        aria-label="Alpha"
        aria-valuetext={`${ariaValue}%`}
        ariaValueNow={ariaValue}
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <Pointer
          className="color-picker-cn__alpha-pointer"
          left={hsva.a}
          color={hsvaToHslaString(hsva)}
        />
      </Interactive>
    </div>
  );
}
