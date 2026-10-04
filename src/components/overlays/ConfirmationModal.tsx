import { useCallback, useRef } from 'react';
import { Button } from '@/components/buttons/Button';
import { Modal } from '@/components/overlays/Modal';
import { useLocale } from '@/locale';
import { useGranularEffect } from '@/util/hooks/use_granular_effect';

/**
 * A dialog that asks a question and reports the answer.
 *
 * Both answers are the caller's: `onConfirm` and `onCancel` are separate callbacks rather than one
 * `onAnswer(confirmed: boolean)`, because the two lead somewhere different and a caller reading its own
 * code should not have to match on a boolean to see which.
 *
 * Anything that dismisses the dialog without answering it — the backdrop, the close button, Escape —
 * is a cancel, because a question that treats "I am not answering" as "yes" is not a question. A
 * caller that must not be dismissible passes `onCancel` that does nothing and watches for it; nothing
 * here prevents the dismissal itself, because a dialog a keyboard user cannot leave is worse than one
 * whose question was ignored.
 *
 * The answer is latched: a double click, or a click that lands while the dialog is animating out,
 * reports once. The caller closes the dialog in its own callback, and the animation that follows takes
 * long enough for a second click to arrive.
 */
export function ConfirmationModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: {
  readonly open: boolean;
  readonly title: string;
  /** The consequence being confirmed, for a question a title alone does not put plainly. */
  readonly message?: string | undefined;
  readonly confirmLabel?: string | undefined;
  readonly cancelLabel?: string | undefined;
  /** Whether the confirmed action destroys something. Decides the confirm button's colours. */
  readonly destructive?: boolean | undefined;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}): React.JSX.Element {
  const { t } = useLocale();

  const answeredRef = useRef(false);

  useGranularEffect(
    () => {
      answeredRef.current = false;
    },
    [open],
    [],
  );

  const answer = useCallback(
    (confirmed: boolean) => {
      if (answeredRef.current) {
        return;
      }

      answeredRef.current = true;

      if (confirmed) {
        onConfirm();
      } else {
        onCancel();
      }
    },
    [onConfirm, onCancel],
  );

  return (
    <Modal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          answer(false);
        }
      }}
      title={title}
      innerStyle={{ width: 'auto', minWidth: '20rem' }}
    >
      {message !== undefined && <div className="text-tpl px-2 pb-2 text-center">{message}</div>}
      <div className="flex gap-4">
        <Button
          type={destructive ? 'dangerous' : 'regular'}
          title={confirmLabel ?? t('ConfirmationModal.confirm')}
          style={{ flexGrow: 1 }}
          onClick={() => {
            answer(true);
          }}
        />
        <Button
          title={cancelLabel ?? t('ConfirmationModal.cancel')}
          style={{ flexGrow: 1 }}
          onClick={() => {
            answer(false);
          }}
        />
      </div>
    </Modal>
  );
}
