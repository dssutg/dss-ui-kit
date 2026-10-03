import { useCallback } from 'react';
import { ipv4Regex } from '@/lib/ipv4';
import { clamp } from '@/lib/math';
import { TextInput } from './TextInput';

export function IPInput({
  value,
  onChange,
  width,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly width?: string | undefined;
}) {
  const onChangeText = useCallback(
    (text: string) => {
      onChange(
        text
          .replace(/[^\d.]+/g, '')
          .replace(/^0+/g, '0')
          .replace(/^\.+/g, '')
          .replace(/\.\.\.+/g, '..') // but allow double period for editing
          .split('.')
          .slice(0, 4)
          .map((octet) => {
            if (octet === '') {
              return '';
            }
            return clamp(Number(octet) || 0, 0, 255);
          })
          .join('.'),
      );
    },
    [onChange],
  );

  let outline = '1px solid var(--color-tda)';
  if (ipv4Regex.test(value)) {
    outline = '1px solid rgba(0, 0, 0, 0)';
  }

  return <TextInput value={value} onChangeText={onChangeText} width={width} outline={outline} />;
}
