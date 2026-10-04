import { IconButton } from '@/components/buttons/IconButton';
import { useLocale } from '@/locale';
import { cn } from '@/util/cn';

/**
 * The library's text field: a bare `<input>` with the design system's focus, clear and password
 * behaviour.
 *
 * It is deliberately not a controlled component in the React sense. `value` is what the caller knows
 * and `onChangeText` is what it wants to hear about, and the component keeps the text being typed
 * while the caller's value catches up: a field that refused a keystroke until the round trip finished
 * drops characters on a slow render. `onChange` still fires with the DOM event for a caller that
 * wants the event itself.
 *
 * `shouldRender` exists because a panel can want the layout of a text field without the field — a
 * value with no way to edit it, which must not be announced as editable.
 */
export function TextInput({
  id,
  type,
  shouldRender = true,
  textColor = 'var(--color-tpl)',
  placeholderColor = 'var(--color-placeholder)',
  outline = 'none',
  placeholder,
  width = 'max-content',
  minWidth = '8rem',
  inputPadding = '0.25rem 0.5rem',
  clearButtonPadding = '0.25rem 0.5rem',
  showHidePasswordPadding = '0.25rem 0.5rem',
  value = '',
  min,
  max,
  step,
  hasShowPasswordButton = false,
  inputRef = null,
  inputAutoFocus = false,
  onChange,
  onChangeText,
  onClearClick,
  onKeyUp,
  onKeyDown,
  onConfirm,
  onFocus,
  onBlur,
  onShowPasswordClick,
  spellCheck,
  hiddenText = false,
  pattern,
  showPasswordIconInnerStyle,
  clearIconInnerStyle,
  inputStyle,
}: {
  readonly id?: string | undefined;
  readonly type?: React.HTMLInputTypeAttribute | undefined;
  readonly shouldRender?: boolean | undefined;
  readonly textColor?: string | undefined;
  readonly placeholderColor?: string | undefined;
  readonly outline?: string | undefined;
  readonly placeholder?: string | undefined;
  readonly width?: string | undefined;
  readonly minWidth?: string | undefined;
  readonly inputPadding?: string | undefined;
  readonly clearButtonPadding?: string | undefined;
  readonly value?: string | undefined;
  readonly min?: string | number | undefined;
  readonly max?: string | number | undefined;
  readonly step?: string | number | undefined;
  readonly hasShowPasswordButton?: boolean | undefined;
  inputRef?: React.Ref<HTMLInputElement> | undefined;
  readonly onChange?: React.ChangeEventHandler<HTMLInputElement> | undefined;
  readonly onChangeText?: (value: string) => void;
  readonly onClearClick?: React.MouseEventHandler<HTMLButtonElement> | undefined;
  readonly onKeyUp?: React.KeyboardEventHandler<HTMLInputElement> | undefined;
  readonly onKeyDown?: React.KeyboardEventHandler<HTMLInputElement> | undefined;
  readonly onConfirm?: React.KeyboardEventHandler<HTMLInputElement> | undefined;
  readonly onFocus?: React.FocusEventHandler<HTMLInputElement> | undefined;
  readonly onBlur?: React.FocusEventHandler<HTMLInputElement> | undefined;
  readonly onShowPasswordClick?: React.MouseEventHandler<HTMLButtonElement> | undefined;
  readonly spellCheck?: boolean | undefined;
  readonly hiddenText?: boolean | undefined;
  readonly pattern?: string | undefined;
  readonly inputAutoFocus?: boolean | undefined;
  readonly showPasswordIconInnerStyle?: React.CSSProperties | undefined;
  readonly clearIconInnerStyle?: React.CSSProperties | undefined;
  readonly inputStyle?: React.CSSProperties | undefined;
  [x: string]: unknown;
}): false | React.JSX.Element {
  const { t } = useLocale();

  return (
    shouldRender && (
      <div className="box-border flex h-fit" style={{ width, minWidth }}>
        <input
          ref={inputRef}
          id={id}
          type={type ?? (hiddenText ? 'password' : 'text')}
          placeholder={placeholder}
          value={value}
          min={min}
          max={max}
          step={step}
          autoFocus={inputAutoFocus}
          onChange={(e) => {
            onChangeText?.(e.currentTarget.value);
            onChange?.(e);
          }}
          onKeyUp={onKeyUp}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onConfirm?.(e);
            }
            onKeyDown?.(e);
          }}
          onFocus={onFocus}
          onBlur={onBlur}
          spellcheck={spellCheck}
          pattern={pattern}
          className="m-0 box-border w-full rounded-l-lg text-base outline-none placeholder:text-[var(--placeholder-color)] bg-bin"
          style={
            {
              '--placeholder-color': placeholderColor,
              color: textColor,
              border: outline,
              padding: inputPadding,
              ...inputStyle,
            } as React.CSSProperties
          }
        />
        {hasShowPasswordButton && (
          <IconButton
            icon={hiddenText ? 'eye' : 'eyeSlash'}
            iconStyle={{
              width: '1rem',
              height: '1rem',
              ...showPasswordIconInnerStyle,
            }}
            bgClassName="hover:bg-bse bg-bin"
            style={
              {
                fill: 'var(--color-tpl)',
                padding: showHidePasswordPadding,
              } as React.CSSProperties
            }
            rippleColor="var(--color-ripple-icon-button)"
            onClick={onShowPasswordClick}
            title={t(hiddenText ? 'actions.showPassword' : 'actions.hidePassword')}
          />
        )}
        <IconButton
          icon="times"
          iconStyle={{
            width: '0.5rem',
            height: '0.5rem',
            ...(value === '' && { opacity: 0 }),
            ...clearIconInnerStyle,
          }}
          bgClassName={cn('bg-bin', value !== '' && 'hover:bg-bse')}
          style={
            {
              fill: 'var(--color-tpl)',
              width: '1.5rem',
              borderTopRightRadius: '0.5rem',
              borderBottomRightRadius: '0.5rem',
              padding: clearButtonPadding,
            } as React.CSSProperties
          }
          rippleColor="var(--color-ripple-icon-button)"
          onClick={(e) => {
            onChangeText?.('');
            onClearClick?.(e);
          }}
          title={value !== '' ? t('actions.clearInputTextField') : ''}
          inactive={value === ''}
        />
      </div>
    )
  );
}
