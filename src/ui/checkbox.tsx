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
  readonly label?: React.ReactNode;
  readonly style?: React.CSSProperties;
  readonly labelStyle?: React.CSSProperties;
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
  readonly gap?: string;
  readonly shouldLabelGrow?: boolean;
  readonly rightSide?: boolean;
  readonly locked?: boolean;
  readonly lockReasonTitle?: string;
  readonly title?: string;
  readonly style?: React.CSSProperties;
}) {
  const [feedbackVisible, setFeedbackVisible] = useState(false);

  return (
    <div
      className="relative"
      style={style}
      onClick={() => {
        if (locked) {
          showFeedbackTooltip(setFeedbackVisible);
        }
      }}
    >
      <ToggleSwitch
        label={label}
        enabled={enabled}
        onChange={onChange}
        shouldLabelGrow={shouldLabelGrow}
        rightSide={rightSide}
        locked={locked}
        title={title}
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
  style,
  labelStyle,
  barStyle,
  enabledBgClassName = 'bg-[#4bd763]',
}: {
  readonly label?: React.ReactNode;
  readonly enabled: boolean;
  readonly onChange?: () => void;
  readonly rightSide?: boolean;
  readonly shouldLabelGrow?: boolean;
  readonly locked?: boolean;
  readonly title?: string;
  readonly style?: React.CSSProperties;
  readonly labelStyle?: React.CSSProperties;
  readonly barStyle?: React.CSSProperties;
  readonly enabledBgClassName?: string;
}) {
  const labelComponent = label !== undefined &&
    label !== null &&
    label !== false &&
    label !== '' && (
      <label
        className={`
          text-tpl overflow-x-hidden text-ellipsis
          ${!locked ? 'cursor-pointer' : ''}
          ${shouldLabelGrow ? 'flex-grow' : ''}
        `}
        style={labelStyle}
      >
        {label}
      </label>
    );

  return (
    <div
      tabIndex={0}
      onClick={locked ? undefined : onChange}
      title={title}
      className={`
        flex select-none items-center gap-4 [-webkit-tap-highlight-color:transparent]
        ${locked ? 'brightness-75' : 'cursor-pointer'}
      `}
      style={style}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!locked) {
            onChange?.();
          }
        }
      }}
    >
      {rightSide && labelComponent}
      <div
        className={`
          relative flex h-6 w-10 shrink-0 items-center rounded-full
          ${enabled ? enabledBgClassName : 'bg-[#e6e6e6]'}
        `}
        style={barStyle}
      >
        <div
          className={`
            absolute left-1 top-1 size-4 rounded-full bg-white shadow-lg shadow-black transition
            ${enabled ? 'translate-x-full' : ''}
          `}
        />
      </div>
      {!rightSide && labelComponent}
    </div>
  );
}
