import { type JSX, useCallback, useEffect, useState } from 'react';
import { useEventCallback } from './color_picker_controls';
import type { ColorInputBaseProperties } from './color_picker_types';

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
