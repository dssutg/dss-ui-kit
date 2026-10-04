import { IconButton } from '@/components/buttons/IconButton';
import { clamp } from '@/util/math';
import { DecimalIntegerInput } from './DecimalIntegerInput';

/**
 * What {@link TimePartInput} takes: one part of a time, and the value above which it wraps.
 *
 * There is no `min` prop because it is always zero; a time part that could start below zero is not a
 * time part.
 */
export interface TimePartInputProps {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly max: number;
}

/**
 * One part of a time — an hour, a minute, a second — as a number with increment arrows.
 *
 * Wraps at `max` rather than clamping: an hour typed as `24` becomes `0`, which is what an operator
 * incrementing past the end expects, and the arrows stop at `max` so the value cannot be typed out of
 * range. Used by {@link HourMinuteTimeInput} and {@link HourMinuteSecondTimeInput}, and exported for a
 * caller assembling another time input.
 */
export function TimePartInput({ value, onChange, max }: TimePartInputProps): React.JSX.Element {
  const min = 0;

  return (
    <div className="flex flex-col items-center">
      <IconButton
        icon="triangleDown"
        iconClassName="size-3 fill-tpd rotate-180"
        className="rounded-full p-1"
        rippleColor="var(--color-ripple-icon-button)"
        onClick={() => onChange(clamp(value + 1, min, max))}
        inactive={value === max}
      />
      <DecimalIntegerInput
        value={value}
        minValue={min}
        maxValue={max}
        onChange={(value) => onChange(value ?? min)}
        shouldResetEmptyInput
        inputStyle={{ width: '3rem' }}
      />
      <IconButton
        icon="triangleDown"
        iconClassName="size-3 fill-tpd"
        className="rounded-full p-1"
        rippleColor="var(--color-ripple-icon-button)"
        onClick={() => onChange(clamp(value - 1, min, max))}
        inactive={value === min}
      />
    </div>
  );
}
