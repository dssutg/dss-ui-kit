import type { MouseEventHandler } from 'react';
import { Icon, type IconName } from '@/ui/Icon';
import { Ripple } from '@/ui/Ripple';

export function IconButton({
  icon,
  style,
  iconStyle,
  rippleColor = '',
  title = '',
  ariaLabel = '',
  className,
  iconClassName,
  bgClassName,
  inactive = false,
  invisible = false,
  onClick,
  onDblClick,
  buttonRef,
  children,
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
  readonly onClick?: MouseEventHandler<HTMLButtonElement> | undefined;
  readonly onDblClick?: MouseEventHandler<HTMLButtonElement> | undefined;
  buttonRef?: React.Ref<HTMLButtonElement> | undefined;
  readonly children?: React.ReactNode | undefined;
}) {
  return (
    <button
      ref={buttonRef ?? null}
      tabIndex={0}
      type="button"
      title={title}
      aria-label={ariaLabel ?? title}
      onClick={inactive ? undefined : onClick}
      onDblClick={inactive ? undefined : onDblClick}
      className={`
        relative box-border flex aspect-square shrink-0 select-none items-center justify-center overflow-hidden border-none
        ${inactive || invisible ? 'cursor-default' : 'hover:brightness-150'}
        ${bgClassName ?? 'bg-transparent'}
        ${className}
      `}
      style={style}
    >
      {rippleColor !== '' && !inactive && !invisible && <Ripple color={rippleColor} />}
      <Icon name={icon} style={iconStyle} className={iconClassName} invisible={invisible} />
      {children}
    </button>
  );
}
