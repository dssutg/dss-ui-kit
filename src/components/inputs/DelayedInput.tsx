import { useEffect, useRef, useState } from 'react';

/**
 * A text input that reports a value only when it stops changing.
 *
 * The point is a text field over something expensive: a filter that re-renders a table, a search that
 * hits an index. It keeps its own copy and calls `onChange` after the value has settled, and it
 * reports intermediate values on blur and on Enter so that a form can be submitted without waiting.
 * `getFilteredValue` is how the caller says what a valid value is; without it every keystroke is
 * reported once typing stops.
 */
export function DelayedInput({
  value,
  onChange,
  onBlur,
  spellCheck = true,
  className,
  style,
  getFilteredValue,
  changeOnEnterKey = false,
  autoFocus = false,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onBlur?: () => void;
  readonly spellCheck?: boolean | undefined;
  readonly className?: string | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly getFilteredValue?: (value: string) => string;
  readonly changeOnEnterKey?: boolean | undefined;
  readonly autoFocus?: boolean | undefined;
}): React.JSX.Element {
  const [hotValue, setHotValue] = useState(value);

  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => setHotValue(value), [value]);

  return (
    <input
      ref={ref}
      type="text"
      value={hotValue}
      spellcheck={spellCheck}
      onChange={(e) => {
        const { value } = e.currentTarget;

        if (getFilteredValue) {
          setHotValue(getFilteredValue(value));
        } else {
          setHotValue(value);
        }
      }}
      onBlur={() => {
        onChange(hotValue);
        onBlur?.();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && changeOnEnterKey) {
          ref.current?.blur();
        }
      }}
      className={className}
      style={style}
      autoFocus={autoFocus}
    />
  );
}
