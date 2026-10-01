import { useCallback } from 'react';
import { TextInput } from '@/ui/TextInput';

export function FloatInput({
  value,
  onChange,
  width,
  min,
  max,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly width?: string | undefined;
  readonly min?: number | undefined;
  readonly max?: number | undefined;
}) {
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
      outline={valid ? '1px solid rgba(0, 0, 0, 0)' : '1px solid var(--color-tda)'}
    />
  );
}
