import { Icon, type IconName } from '@/components/display/Icon';
import { Ripple } from '@/components/feedback/Ripple';
import { cn } from '@/util/cn';

/**
 * The button's role, which is what decides its colours.
 *
 * `regular` and `dangerous` are filled, `discouraging` and `discouragingText` are the quieter
 * variants, and `text`/`textLink`/`inactive` are for panels where a button is an action and not the
 * subject. The type is a design decision rather than an intent: a caller wanting a red button asks
 * for `dangerous`, and the library decides what that looks like in each theme.
 */
export type ButtonType =
  | 'regular'
  | 'dangerous'
  | 'encouraging'
  | 'discouraging'
  | 'inactive'
  | 'text'
  | 'textLink'
  | 'discouragingText';

const buttonTypeClasses: Readonly<Record<ButtonType, string>> = {
  regular: 'bg-bbp text-tpl px-8 py-1',
  dangerous: 'bg-bda text-bdat px-8 py-1',
  encouraging: 'bg-bok text-bokt px-8 py-1',
  discouraging: 'bg-transparent text-tpl border-2 border-tpl hover:bg-bse px-8 py-1',
  inactive: 'bg-bin text-tpl px-8 py-1',
  text: 'text-tpl hover:bg-bse px-2 py-1',
  textLink: 'text-tli hover:underline px-2 py-1',
  discouragingText: 'text-tpd hover:bg-bse px-2 py-1',
};

const buttonIconColors: Readonly<Record<ButtonType, string>> = {
  regular: 'var(--color-tpl)',
  dangerous: 'var(--color-bdat)',
  encouraging: 'var(--color-bokt)',
  discouraging: 'var(--color-tpl)',
  inactive: 'var(--color-tpl)',
  text: 'var(--color-tpl)',
  textLink: 'var(--color-tli)',
  discouragingText: 'var(--color-tpd)',
};

/**
 * A button with an optional leading icon.
 *
 * Renders a real `<button>`, so the browser's own focus and keyboard handling apply, and
 * `htmlButtonType` is the only way its type is set — `<button>` defaults to `submit` in a
 * form, which is almost never what a button in a panel wants.
 *
 * It does not manage a pressed state: a button that toggles is {@link ToggleButton}, and one that
 * submits a form is this with `htmlButtonType="submit"`.
 *
 * It also takes exactly the props below and forwards none of the rest. That is a deliberate limit
 * rather than an oversight: a `className` or `style` forwarded onto the element would override the
 * colours its `type` chose, which is the one thing this component exists to decide. A caller that
 * needs `disabled` or an `aria-*` attribute does not reach for this button.
 */
export function Button({
  type = 'regular',
  htmlButtonType = 'button',
  icon,
  title,
  style,
  buttonRef,
  onClick,
  children,
}: {
  readonly type?: ButtonType | undefined;
  readonly htmlButtonType?: 'button' | 'submit' | 'reset' | undefined;
  readonly icon?: IconName | undefined;
  readonly title?: string | undefined;
  readonly style?: React.CSSProperties | undefined;
  buttonRef?: React.Ref<HTMLButtonElement> | undefined;
  readonly onClick?: React.MouseEventHandler<HTMLButtonElement> | undefined;
  readonly children?: React.ReactNode | undefined;
}) {
  return (
    <button
      ref={buttonRef ?? null}
      type={htmlButtonType}
      className={cn(
        'relative flex shrink-0 select-none items-center justify-center overflow-hidden rounded-lg hover:brightness-150',
        type === 'inactive' && 'pointer-events-none',
        buttonTypeClasses[type],
      )}
      style={style}
      onClick={onClick}
    >
      <Ripple color="var(--color-ripple-button)" />
      {icon !== undefined && (
        <Icon
          name={icon}
          style={{
            marginRight: '0.5rem',
            width: '1rem',
            height: '1rem',
            fill: buttonIconColors[type],
          }}
        />
      )}
      <div className="max-w-full overflow-x-hidden text-ellipsis">{title}</div>
      {children}
    </button>
  );
}
