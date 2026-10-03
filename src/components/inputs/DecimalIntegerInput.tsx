import { useCallback } from 'react';
import { IconButton } from '@/components/buttons/IconButton';
import { useLocale } from '@/locale';
import { clamp } from '@/util/math';

/**
 * What a {@link DecimalIntegerInput} holds: an integer, or nothing while it is being typed.
 *
 * `undefined` is a real state and not a bug. An empty field is not zero, and a component that
 * reported zero for it would make a caller's `value === 0` check fire on a field nobody has filled in.
 */
export type DecimalIntegerInputValue = number | undefined;

/**
 * A number input for a decimal integer, which may be empty.
 *
 * Reports `undefined` while the field is empty and rejects a fractional value as it is typed rather
 * than rounding it: rounding silently turns 1.9 into 2 and the operator never sees what happened.
 */
export function DecimalIntegerInput({
  value,
  onChange,
  onClear,
  minValue = 0,
  maxValue = 2 ** 32 - 1,
  style,
  inputStyle,
  onInputBlur,
  onInputKeyDown,
  onInputWheel,
  shouldResetEmptyInput = false,
  inputRef = null,
  noAlteringValueWithArrowKeys = false,
  noAlteringValueWithMouseWheel = false,
  base = 10,
}: {
  readonly value: DecimalIntegerInputValue;
  readonly onChange: (value: DecimalIntegerInputValue) => void;
  readonly onClear?: (() => void) | undefined;
  readonly minValue?: number | undefined;
  readonly maxValue?: number | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly inputStyle?: React.CSSProperties | undefined;
  readonly onInputBlur?: React.FocusEventHandler<HTMLInputElement> | undefined;
  readonly onInputKeyDown?: (event: KeyboardEvent) => void;
  readonly onInputWheel?: (event: WheelEvent) => void;
  readonly shouldResetEmptyInput?: boolean | undefined;
  inputRef?: React.Ref<HTMLInputElement> | undefined;
  readonly noAlteringValueWithArrowKeys?: boolean | undefined;
  readonly noAlteringValueWithMouseWheel?: boolean | undefined;
  readonly base?: 10 | 16 | undefined;
}) {
  const { t } = useLocale();

  const maxDigits = maxValue.toString(base).length;

  const adjustValue = useCallback(
    (delta: number) => {
      onChange(clamp((value ?? minValue) + delta, minValue, maxValue));
    },
    [onChange, value, minValue, maxValue],
  );

  const handleKeyDownDefault = useCallback(
    (event: KeyboardEvent) => {
      if (noAlteringValueWithArrowKeys) {
        return;
      }

      const handlers: Readonly<Record<string, () => void>> = {
        ArrowUp: () => adjustValue(1),
        ArrowDown: () => adjustValue(-1),
      };

      const handler = handlers[event.key];

      if (!handler) {
        return;
      }

      event.preventDefault();
      handler();
    },
    [noAlteringValueWithArrowKeys, adjustValue],
  );

  const handleWheelDefault = useCallback(
    (event: WheelEvent) => {
      const element = event.currentTarget as HTMLInputElement;

      if (document.activeElement !== element) {
        return;
      }

      if (noAlteringValueWithMouseWheel) {
        return;
      }

      adjustValue(-Math.sign(event.deltaY));
    },
    [noAlteringValueWithMouseWheel, adjustValue],
  );

  const getTextValue = useCallback(
    (value: DecimalIntegerInputValue) => {
      if (value === undefined) {
        return '';
      }
      return value.toString(base).toUpperCase();
    },
    [base],
  );

  return (
    <div className="bg-bin flex rounded-lg pl-2 h-fit" style={style}>
      <input
        ref={inputRef}
        type="text"
        className="text-tpl placeholder-tpd flex-grow bg-transparent outline-none"
        style={inputStyle}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellcheck={false}
        value={getTextValue(value)}
        onChange={(e) => {
          let filterRegexp = /\D/g;
          if (base !== 10) {
            filterRegexp = /[^\dA-Fa-f]/g;
          }

          const digits = e.currentTarget.value
            .replace(filterRegexp, '')
            .replace(/^0+([^.])/, '$1')
            .slice(0, maxDigits);

          if (digits === '') {
            if (shouldResetEmptyInput) {
              onChange(minValue);
            } else {
              onChange(undefined);
            }
            return;
          }

          const enteredNumber = parseInt(digits, base);

          const value = clamp(enteredNumber, minValue, maxValue);

          onChange(value);
        }}
        onBlur={onInputBlur}
        onKeyDown={(e) => {
          handleKeyDownDefault(e);
          onInputKeyDown?.(e);
        }}
        onWheel={(e) => {
          handleWheelDefault(e);
          onInputWheel?.(e);
        }}
      />
      <IconButton
        icon="times"
        iconClassName={`
          fill-tpl size-2
          ${value === undefined ? 'opacity-0' : ''}
        `}
        className={`
          rounded-full p-2
          ${value !== undefined ? 'hover:bg-bse' : ''}
        `}
        rippleColor="var(--color-ripple-icon-button)"
        title={value !== undefined ? t('DecimalIntegerInput.clear') : ''}
        onClick={(e) => {
          e.stopPropagation();
          if (shouldResetEmptyInput || onClear === undefined) {
            onChange(minValue);
          } else {
            onClear();
          }
        }}
        inactive={value === undefined}
      />
    </div>
  );
}
