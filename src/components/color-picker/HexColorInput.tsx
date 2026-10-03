import { type JSX, useCallback } from 'react';
import { ColorInput, type ColorInputBaseProperties } from './color_picker_internal';

export interface HexColorInputProperties extends ColorInputBaseProperties {
  /** Enables `#` prefix displaying */
  readonly prefixed?: boolean | undefined;

  /** Allows `#rgba` and `#rrggbbaa` color formats */
  readonly alpha?: boolean | undefined;
}

/** Adds "#" symbol to the beginning of the string */
const prefixHexColorInput = (value: string) => `#${value}`;

export function HexColorInput(properties: HexColorInputProperties): JSX.Element {
  const { prefixed, alpha, ...rest } = properties;

  /** Escapes all non-hexadecimal characters including "#" */
  const escapeLocal = useCallback(
    (value: string) => value.replace(/([^\da-f]+)/gi, '').slice(0, Math.max(0, alpha ? 8 : 6)),
    [alpha],
  );

  /** Validates hexadecimal strings */
  const validate = useCallback((value: string) => validHex(value, alpha), [alpha]);

  return (
    <ColorInput
      {...rest}
      escape={escapeLocal}
      format={prefixed ? prefixHexColorInput : undefined}
      process={prefixHexColorInput}
      validate={validate}
    />
  );
}

function validHex(value: string, alpha?: boolean): boolean {
  const match = /^#?([\da-f]{3,8})$/i.exec(value);
  // No match means no capture, which is the same as a length no format accepts.
  const length = match?.[1]?.length ?? 0;

  return (
    // '#rgb' format
    length === 3 ||
    // '#rrggbb' format
    length === 6 ||
    // '#rgba' format
    (Boolean(alpha) && length === 4) ||
    // '#rrggbbaa' format
    (Boolean(alpha) && length === 8)
  );
}
