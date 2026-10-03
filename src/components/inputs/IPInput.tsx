import { useCallback } from 'react';
import { ipv4Regex } from '@/lib/ipv4';
import { clamp } from '@/lib/math';
import { TextInput } from './TextInput';

/**
 * A text input that only accepts an IPv4 address.
 *
 * The value is a string, not four octets, and is reported incomplete while it is being typed: `1.2.`
 * is a valid intermediate state and rejecting it would make the field impossible to type into. The
 * address is validated by {@link ipv4Regex} rather than resolved, because whether the host is
 * reachable is not the field's business.
 */
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
