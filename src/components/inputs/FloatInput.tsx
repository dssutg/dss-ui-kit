import { useCallback } from 'react';
import { TextInput } from './TextInput';

/**
 * A decimal number field that reports text, not a number.
 *
 * The value is a string so a half-typed value — `-`, `1.` — reaches the caller instead of becoming
 * `NaN` on the way. `min` and `max` are what the browser's own spinner enforces; out-of-range text is
 * outlined rather than rejected, because an input that swallows a keystroke is worse than one that
 * shows red.
 */
export interface FloatInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly width?: string | undefined;
  readonly min?: number | undefined;
  readonly max?: number | undefined;
  readonly className?: string | undefined;
}

/** A decimal field for a value that may be half-typed. See {@link FloatInputProps}. */
export function FloatInput({
  value,
  onChange,
  width,
  min,
  max,
  className,
}: FloatInputProps): React.JSX.Element {
  const valueNum = Number(value);

  const valid =
    /^-?\d+(\.\d+)?$/.test(value) &&
    !Number.isNaN(valueNum) &&
    (min === undefined || valueNum >= min) &&
    (max === undefined || valueNum <= max);

  const onChangeText = useCallback(
    (text: string) => {
      onChange(
        text
          .replace(/[^\d.-]+/g, '')
          .replace(/--+/g, '-')
          .replace(/^00+/g, '0')
          .replace(/^\.+/g, '')
          .split('.')
          .slice(0, 2)
          .join('.'),
      );
    },
    [onChange],
  );

  return (
    <TextInput
      type="number"
      value={value}
      onChangeText={onChangeText}
      width={width}
      min={min}
      max={max}
      className={className}
      outline={valid ? '1px solid rgba(0, 0, 0, 0)' : '1px solid var(--color-tda)'}
    />
  );
}
