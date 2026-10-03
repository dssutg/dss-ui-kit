import { useCallback, useRef, useState } from 'react';
import { Icon } from '@/components/display/Icon';
import { Ripple } from '@/components/feedback/Ripple';
import { FeedbackTooltip, showFeedbackTooltip } from '@/components/overlays/FeedbackTooltip';
import { copyToClipboard } from '@/lib/dom';
import { useLocale } from '@/locale';

export function CopyToClipboardButton({
  contentToCopy = '',
  className,
  style,
  buttonStyle,
  iconStyle,
  title,
}: {
  readonly contentToCopy: string | (() => string);
  readonly className?: string | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly buttonStyle?: React.CSSProperties | undefined;
  readonly iconStyle?: React.CSSProperties | undefined;
  readonly title?: string | undefined;
}) {
  const { t } = useLocale();

  const triggerRef = useRef<HTMLButtonElement>(null);

  const [feedbackShown, setFeedbackShown] = useState(false);

  const onClick = useCallback(() => {
    if (typeof contentToCopy === 'function') {
      copyToClipboard(contentToCopy());
    } else {
      copyToClipboard(contentToCopy);
    }
    showFeedbackTooltip(setFeedbackShown);
  }, [contentToCopy]);

  // Only the positioning wrapper. It carried `role="button"` and `tabIndex={0}`, which put a second
  // button inside a button in the accessibility tree and a focus stop in the tab order that Enter
  // and Space did nothing on. The button below is the control.
  return (
    <div className={`relative ${className}`} style={style}>
      <button
        ref={triggerRef}
        type="button"
        title={title ?? t('actions.copyToClipboard')}
        onClick={onClick}
        className="relative cursor-pointer overflow-hidden rounded-full border-none bg-transparent p-1 hover:brightness-150"
        style={buttonStyle}
      >
        <Ripple color="var(--color-ripple-button)" />
        <Icon
          name="copy"
          style={{
            fill: 'var(--color-tpd)',
            width: '1rem',
            height: '1rem',
            ...iconStyle,
          }}
        />
      </button>
      <FeedbackTooltip
        title={t('actions.copied')}
        type="good"
        visible={feedbackShown}
        trigger={triggerRef.current}
      />
    </div>
  );
}
