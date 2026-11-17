// SPDX-License-Identifier: MIT
// The library's multiline text field: a plain <textarea> with the field styling.

import { cn } from '@/util/cn';
import type { DataAttributes } from '@/util/dom';
import type { CSSStyleWithCustomProperties } from '@/util/style';

/**
 * Which directions the field can be resized in, as the browser's own `resize` property spells them.
 */
export type TextAreaResize = 'none' | 'both' | 'horizontal' | 'vertical';

/** The Tailwind utility for each {@link TextAreaResize}, so the prop decides one class. */
const resizeClasses: Readonly<Record<TextAreaResize, string>> = {
  none: 'resize-none',
  both: 'resize',
  horizontal: 'resize-x',
  vertical: 'resize-y',
};

/**
 * What a {@link TextArea} takes.
 *
 * It is the plain multiline counterpart of `TextInput`: a bare `<textarea>` with the design system's
 * focus and placeholder styling, and nothing structured on top of it. `resize` is the browser's own
 * `resize` property rather than a layout guess, because the handle is what the user grabs and a
 * component that fakes it would have to reimplement the drag.
 */
export interface TextAreaProps extends DataAttributes {
  readonly value?: string | undefined;
  readonly placeholder?: string | undefined;
  /** The number of text rows the field shows before it scrolls. */
  readonly rows?: number | undefined;
  /** The browser's own `disabled`: a disabled field is not editable and not focusable. */
  readonly disabled?: boolean | undefined;
  readonly spellCheck?: boolean | undefined;
  readonly resize?: TextAreaResize | undefined;
  readonly textColor?: string | undefined;
  readonly placeholderColor?: string | undefined;
  textAreaRef?: React.Ref<HTMLTextAreaElement> | undefined;
  readonly onChange?: React.ChangeEventHandler<HTMLTextAreaElement> | undefined;
  /** Called with the text after every edit, the way `TextInput` reports it. */
  readonly onChangeText?: (value: string) => void;
  readonly onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement> | undefined;
  readonly onKeyUp?: React.KeyboardEventHandler<HTMLTextAreaElement> | undefined;
  readonly onFocus?: React.FocusEventHandler<HTMLTextAreaElement> | undefined;
  readonly onBlur?: React.FocusEventHandler<HTMLTextAreaElement> | undefined;
  readonly className?: string | undefined;
  readonly style?: React.CSSProperties | undefined;
}

/**
 * A plain multiline text field.
 *
 * Like `TextInput`, it is deliberately not a controlled component in the React sense: `value` is what
 * the caller knows and `onChangeText` is what it wants to hear about, so a keystroke is not dropped
 * while the caller's value catches up. `onChange` still fires with the DOM event for a caller that
 * wants the event itself.
 */
export function TextArea({
  value = '',
  placeholder,
  rows = 4,
  disabled = false,
  spellCheck,
  resize = 'vertical',
  textColor = 'var(--color-tpl)',
  placeholderColor = 'var(--color-placeholder)',
  textAreaRef = null,
  onChange,
  onChangeText,
  onKeyDown,
  onKeyUp,
  onFocus,
  onBlur,
  className,
  style,
  ...dataProps
}: TextAreaProps): React.JSX.Element {
  const fieldStyle: CSSStyleWithCustomProperties = {
    '--placeholder-color': placeholderColor,
    color: textColor,
    ...style,
  };

  return (
    <textarea
      ref={textAreaRef}
      value={value}
      rows={rows}
      placeholder={placeholder}
      disabled={disabled}
      spellcheck={spellCheck}
      onChange={(e) => {
        onChangeText?.(e.currentTarget.value);
        onChange?.(e);
      }}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onFocus={onFocus}
      onBlur={onBlur}
      className={cn(
        'm-0 box-border w-full rounded-lg text-base outline-none placeholder:text-[var(--placeholder-color)] bg-bin',
        disabled && 'pointer-events-none opacity-50',
        resizeClasses[resize],
        className,
      )}
      style={fieldStyle}
      {...dataProps}
    />
  );
}
