// SPDX-License-Identifier: MIT
// A square button carrying one icon and its accessible label.

import type { MouseEventHandler } from 'react';
import { Icon, type IconName } from '@/components/display/Icon';
import { Ripple } from '@/components/feedback/Ripple';
import { cn } from '@/util/cn';
import type { DataAttributes } from '@/util/dom';

/**
 * A square button showing one icon and nothing else.
 *
 * `ariaLabel` exists because the accessible name of an icon button cannot come from the icon: the
 * SVG is `aria-hidden`, so without a label the button is announced as an empty button. `title` is
 * the tooltip, which is a visual affordance and is not what a screen reader reads.
 *
 * It falls back to `title` for the accessible name. The fallback is stated here because the tooltip
 * is the only name a caller has when there is one icon and one purpose, and an `aria-label=""` is
 * worse than no attribute at all: it names the button as empty rather than leaving it unnamed.
 *
 * `disabled` is the browser's own, on the `<button>` itself, which is what makes it different from
 * `inactive`: a disabled button is not clickable and not focusable, while `inactive` only takes the
 * handlers away and keeps the button in the layout and the tab order.
 *
 * `draggable` turns the native drag source on: a `<button>` is not draggable by default, so a button
 * that starts a drag — a row handle, a movable toolbar button — asks for it here.
 *
 * `data-*` attributes are forwarded onto the `<button>` rather than dropped, so a caller can mark a
 * button for its own tests or scripts.
 */
export function IconButton({
  icon,
  style,
  iconStyle,
  rippleColor = '',
  title = '',
  ariaLabel,
  className,
  iconClassName,
  bgClassName,
  inactive = false,
  invisible = false,
  disabled = false,
  draggable = false,
  onClick,
  onDblClick,
  buttonRef,
  children,
  ...dataProps
}: {
  readonly icon: IconName;
  readonly rippleColor?: string | undefined;
  readonly title?: string | undefined;
  readonly ariaLabel?: string | undefined;
  readonly className?: string | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly iconClassName?: string | undefined;
  readonly bgClassName?: string | undefined;
  readonly iconStyle?: React.CSSProperties | undefined;
  readonly inactive?: boolean | undefined;
  readonly invisible?: boolean | undefined;
  readonly disabled?: boolean | undefined;
  readonly draggable?: boolean | undefined;
  readonly onClick?: MouseEventHandler<HTMLButtonElement> | undefined;
  readonly onDblClick?: MouseEventHandler<HTMLButtonElement> | undefined;
  buttonRef?: React.Ref<HTMLButtonElement> | undefined;
  readonly children?: React.ReactNode | undefined;
} & DataAttributes): React.JSX.Element {
  return (
    <button
      ref={buttonRef ?? null}
      tabIndex={0}
      type="button"
      title={title}
      aria-label={ariaLabel ?? title}
      disabled={disabled}
      draggable={draggable}
      onClick={inactive || disabled ? undefined : onClick}
      onDblClick={inactive || disabled ? undefined : onDblClick}
      className={cn(
        'relative box-border flex aspect-square shrink-0 select-none items-center justify-center overflow-hidden border-none',
        inactive || invisible ? 'cursor-default' : 'hover:brightness-150',
        disabled && 'pointer-events-none opacity-50',
        bgClassName ?? 'bg-transparent',
        className,
      )}
      style={style}
      {...dataProps}
    >
      {rippleColor !== '' && !inactive && !invisible && !disabled && <Ripple color={rippleColor} />}
      <Icon name={icon} style={iconStyle} className={iconClassName} invisible={invisible} />
      {children}
    </button>
  );
}
