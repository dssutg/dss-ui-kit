import { useEffect, useRef, useState } from 'react';

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
}) {
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
