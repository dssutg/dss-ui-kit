import { type JSX, useCallback } from 'react';
import { ColorInput, type ColorInputBaseProperties } from './color_picker';

/**
 * What {@link HexColorInput} takes.
 *
 * `prefixed` is display only and `alpha` decides whether the value carries transparency, which also
 * decides how long the field is allowed to be.
 */
export interface HexColorInputProperties extends ColorInputBaseProperties {
  /** Enables `#` prefix displaying */
  readonly prefixed?: boolean | undefined;

  /** Allows `#rgba` and `#rrggbbaa` color formats */
  readonly alpha?: boolean | undefined;
}

/** Adds "#" symbol to the beginning of the string */
const prefixHexColorInput = (value: string) => `#${value}`;

/**
 * A text field for a hexadecimal colour, refusing anything that is not a hexadecimal digit.
 *
 * The `#` is display only: it is shown when `prefixed` is set and stripped again before the value is
 * reported, because a colour held as `#fff` and one held as `fff` are the same colour and only one of
 * them is what the caller's colour model expects.
 */
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
