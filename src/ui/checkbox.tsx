import { useId, useState } from 'react';
import { FeedbackTooltip, showFeedbackTooltip } from './feedback_tooltip';
import { Icon } from './icon';

export function Checkbox({
  checked,
  onChange,
  label,
  style,
  labelStyle,
}: {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly label?: React.ReactNode | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly labelStyle?: React.CSSProperties | undefined;
}) {
  const id = useId();

  return (
    <div className="flex items-center select-none text-tpl" style={style}>
      <input
        id={id}
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
      <label htmlFor={id} className="flex items-center cursor-pointer w-full">
        <div
          className={`
            transition-background flex size-5 cursor-pointer items-center justify-center rounded border-2 text-base duration-200 shrink-0
            ${checked ? 'border-bok bg-bok' : 'border-bin'}
          `}
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

export function LockableToggleSwitch({
  label,
  enabled,
  onChange,
  gap,
  shouldLabelGrow,
  rightSide,
  locked = false,
  lockReasonTitle,
  title,
  style,
}: {
  readonly label: string;
  readonly enabled: boolean;
  readonly onChange: () => void;
  readonly gap?: string | undefined;
  readonly shouldLabelGrow?: boolean | undefined;
  readonly rightSide?: boolean | undefined;
  readonly locked?: boolean | undefined;
  readonly lockReasonTitle?: string | undefined;
  readonly title?: string | undefined;
  readonly style?: React.CSSProperties | undefined;
}) {
  const [feedbackVisible, setFeedbackVisible] = useState(false);

  // Only positioning for the tooltip. The locked click used to be handled here, which meant a div
  // intercepted the mouse while the keyboard had no way to reach it at all; it is on the control now.
  return (
    <div className="relative" style={style}>
      <ToggleSwitch
        label={label}
        enabled={enabled}
        onChange={onChange}
        shouldLabelGrow={shouldLabelGrow}
        rightSide={rightSide}
        locked={locked}
        title={title}
        onLockedClick={() => {
          showFeedbackTooltip(setFeedbackVisible);
        }}
        style={{ gap }}
      />
      <FeedbackTooltip
        type="bad"
        visible={lockReasonTitle !== undefined && lockReasonTitle !== '' ? feedbackVisible : false}
        title={lockReasonTitle}
      />
    </div>
  );
}

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
      className={`
        text-tpl overflow-x-hidden text-ellipsis
        ${!locked ? 'cursor-pointer' : ''}
        ${shouldLabelGrow ? 'flex-grow' : ''}
      `}
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
      className={`
        flex select-none items-center gap-4 border-none bg-transparent p-0 text-left
        [-webkit-tap-highlight-color:transparent]
        ${locked ? 'brightness-75' : 'cursor-pointer'}
      `}
      style={style}
    >
      {rightSide && labelComponent}
      <span
        aria-hidden="true"
        className={`
          relative flex h-6 w-10 shrink-0 items-center rounded-full
          ${enabled ? enabledBgClassName : 'bg-[#e6e6e6]'}
        `}
        style={barStyle}
      >
        <span
          className={`
            absolute left-1 top-1 size-4 rounded-full bg-white shadow-lg shadow-black transition
            ${enabled ? 'translate-x-full' : ''}
          `}
        />
      </span>
      {!rightSide && labelComponent}
    </button>
  );
}
