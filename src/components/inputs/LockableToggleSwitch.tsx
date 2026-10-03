import { useState } from 'react';
import { FeedbackTooltip, showFeedbackTooltip } from '@/components/overlays/FeedbackTooltip';
import { ToggleSwitch } from './ToggleSwitch';

/**
 * A {@link ToggleSwitch} that can be locked, with the lock state held inside it.
 *
 * The lock is the difference from a plain switch, and it is why this is not just a prop on
 * {@link ToggleSwitch}: while locked, the switch refuses to change and clicking the padlock shows a
 * tooltip saying so. The caller learns which it is from the prop it set, and the lock itself is not
 * lifted — a lock that could be locked and unlocked remotely is not a lock.
 */
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
