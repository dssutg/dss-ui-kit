import { type JSX, useCallback, useEffect, useState } from 'react';
import { useEventCallback } from './color_picker_controls';
import type { ColorInputBaseProperties } from './color_picker_types';

/**
 * What {@link ColorInput} takes: the behaviour of the text field, as functions.
 *
 * It is the machinery underneath the hex and RGB fields, so every decision about what counts as a
 * valid colour — and about what the caller is handed on change — is passed in rather than decided
 * here. `escape` and `validate` are required because a field that accepted any text would be a text
 * field; `format` and `process` are what the caller uses to write the colour back the way their own
 * code holds it.
 */
export interface ColorInputProperties extends ColorInputBaseProperties {
  /** Blocks typing invalid characters and limits string length */
  readonly escape: (value: string) => string;

  /** Checks that value is valid color string */
  readonly validate: (value: string) => boolean;

  /** Processes value before displaying it in the input */
  readonly format?: ((value: string) => string) | undefined;

  /** Processes value before sending it in `onChange` */
  readonly process?: ((value: string) => string) | undefined;
}

/**
 * A text field for a colour, which keeps its own text and reports a value only when it is valid.
 *
 * An invalid value is shown and outlined rather than rejected: a colour field that refuses a
 * keystroke cannot be typed into, and an operator cannot see what they mistyped. The colour is only
 * reported once it parses.
 */
export function ColorInput(properties: ColorInputProperties): JSX.Element {
  const {
    color = '',
    onChange,
    onBlur,
    escape: escapeLocal,
    validate,
    format,
    process,
    ...rest
  } = properties;
  const [value, setValue] = useState(() => escapeLocal(color));
  const onChangeCallback = useEventCallback<string>(onChange);
  const onBlurCallback = useEventCallback<React.FocusEvent<HTMLInputElement>>(onBlur);

  // Trigger `onChange` handler only if the input value is a valid color
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = escapeLocal(e.currentTarget.value);

      setValue(inputValue);
      if (validate(inputValue)) {
        onChangeCallback(process ? process(inputValue) : inputValue);
      }
    },
    [escapeLocal, process, validate, onChangeCallback],
  );

  // Take the color from props if the last typed color (in local state) is not valid
  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      if (!validate(e.currentTarget.value)) {
        setValue(escapeLocal(color));
      }
      onBlurCallback(e);
    },
    [color, escapeLocal, validate, onBlurCallback],
  );

  // Update the local state when `color` property value is changed
  useEffect(() => {
    setValue(escapeLocal(color));
  }, [color, escapeLocal]);

  return (
    <input
      {...rest}
      value={format ? format(value) : value}
      spellcheck={false} // The element should not be checked for spelling errors
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}
