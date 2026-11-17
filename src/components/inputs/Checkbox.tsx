// SPDX-License-Identifier: MIT
// The checkbox the forms of the library use.

import { useId } from 'react';
import { Icon } from '@/components/display/Icon';
import { cn } from '@/util/cn';

/**
 * A checkbox with a label that is part of the control.
 *
 * The label is wired to the input with a generated id rather than wrapped around it, so clicking the
 * text toggles the box while the DOM stays flat — a wrapping label cannot hold a control the caller
 * puts inside it. `label` is optional: an unlabelled checkbox is a caller decision, not a default,
 * and one that takes the label anyway names itself with `ariaLabel`, which reaches the input.
 */
export function Checkbox({
  checked,
  onChange,
  label,
  className,
  style,
  labelStyle,
  disabled,
  ariaLabel,
}: {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly label?: React.ReactNode | undefined;
  readonly className?: string | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly labelStyle?: React.CSSProperties | undefined;
  readonly disabled?: boolean | undefined;
  readonly ariaLabel?: string | undefined;
}): React.JSX.Element {
  const id = useId();

  return (
    <div className={cn('flex items-center select-none text-tpl', className)} style={style}>
      <input
        id={id}
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.currentTarget.checked)}
        disabled={disabled}
        aria-label={ariaLabel}
      />
      {/* The input is `sr-only`, so the visible control is the label and the box it holds: the
          taken-away state is shown there, or a disabled checkbox would look live to an operator. */}
      <label
        htmlFor={id}
        className={cn(
          'flex items-center w-full',
          disabled ? 'cursor-default opacity-50' : 'cursor-pointer',
        )}
      >
        <div
          className={cn(
            'transition-background flex size-5 cursor-pointer items-center justify-center rounded border-2 text-base duration-200 shrink-0',
            checked ? 'border-bok bg-bok' : 'border-bin',
          )}
        >
          {checked && (
            <Icon
              name="check"
              style={{
                fill: 'var(--color-bokt)',
                width: '0.75rem',
                height: '0.75rem',
              }}
            />
          )}
        </div>
        {label !== undefined && label !== null && label !== false && label !== '' && (
          <span className="ml-2" style={labelStyle}>
            {label}
          </span>
        )}
      </label>
    </div>
  );
}
