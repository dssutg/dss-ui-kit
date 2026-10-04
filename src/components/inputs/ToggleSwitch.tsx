import { cn } from '@/util/cn';

/**
 * A switch with a label, a bar and a knob, which is not what a checkbox looks like.
 *
 * `locked` shows a padlock and refuses to change, which is different from `disabled` in the only way
 * that matters to an operator: a disabled switch is not there, and a locked one is there and explains
 * itself through `onLockedClick`.
 */
export function ToggleSwitch({
  label = '',
  enabled = false,
  onChange,
  rightSide = true,
  shouldLabelGrow = false,
  locked = false,
  title,
  onLockedClick,
  style,
  labelStyle,
  barStyle,
  enabledBgClassName = 'bg-[#4bd763]',
}: {
  readonly label?: React.ReactNode | undefined;
  readonly enabled: boolean;
  readonly onChange?: () => void;
  readonly rightSide?: boolean | undefined;
  readonly shouldLabelGrow?: boolean | undefined;
  readonly locked?: boolean | undefined;
  readonly title?: string | undefined;
  readonly onLockedClick?: (() => void) | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly labelStyle?: React.CSSProperties | undefined;
  readonly barStyle?: React.CSSProperties | undefined;
  readonly enabledBgClassName?: string | undefined;
}) {
  // The label is rendered inside the button rather than beside it in a `<label>`. A `<label>` needs a
  // form control to point at, and there is none: the control is the switch itself, so its accessible
  // name has to be its own content.
  const hasLabel = label !== undefined && label !== null && label !== false && label !== '';

  const labelComponent = hasLabel && (
    <span
      className={cn(
        'text-tpl overflow-x-hidden text-ellipsis',
        !locked && 'cursor-pointer',
        shouldLabelGrow && 'flex-grow',
      )}
      style={labelStyle}
    >
      {label}
    </span>
  );

  // A real `<button>` carries the click, the Enter and Space handling and the tab stop, so none of
  // them is hand-written here. `role="switch"` with `aria-checked` is what makes it a switch and not
  // a checkbox, which is the distinction a screen reader announces.
  //
  // `aria-disabled` rather than `disabled`: a `disabled` button cannot be focused, so a locked switch
  // would drop out of the tab order and nothing could explain why it is locked. This one stays
  // focusable and reports the reason instead.
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-disabled={locked}
      onClick={() => {
        if (locked) {
          onLockedClick?.();
          return;
        }

        onChange?.();
      }}
      title={title}
      className={cn(
        'flex select-none items-center gap-4 border-none bg-transparent p-0 text-left',
        '[-webkit-tap-highlight-color:transparent]',
        locked ? 'brightness-75' : 'cursor-pointer',
      )}
      style={style}
    >
      {rightSide && labelComponent}
      <span
        aria-hidden="true"
        className={cn(
          'relative flex h-6 w-10 shrink-0 items-center rounded-full',
          enabled ? enabledBgClassName : 'bg-[#e6e6e6]',
        )}
        style={barStyle}
      >
        <span
          className={cn(
            'absolute left-1 top-1 size-4 rounded-full bg-white shadow-lg shadow-black transition',
            enabled && 'translate-x-full',
          )}
        />
      </span>
      {!rightSide && labelComponent}
    </button>
  );
}
