import { createPortal, useCallback, useEffect, useState } from 'react';
import { IconButton } from '@/components/buttons/IconButton';
import { useLocale } from '@/locale';
import { useGranularEffect } from '@/util/hooks/use_granular_effect';

/**
 * A centred dialog over a backdrop, with a title bar and a close button.
 *
 * `open` and `onOpenChange` are the caller's, so a modal can be opened by a route, a key press or
 * another modal. Focus moves to the panel when it opens and returns to the control that opened it
 * when it closes; pass nothing that would rather not be focused, and the panel itself takes focus,
 * because a dialog whose first field takes focus is a decision only the caller can make.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  style,
  innerStyle,
  noWidthRestriction = false,
  verticalAlignment = 'center',
  children,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly style?: React.CSSProperties | undefined;
  readonly innerStyle?: React.CSSProperties | undefined;
  readonly noWidthRestriction?: boolean | undefined;
  readonly verticalAlignment?: 'center' | 'top' | undefined;
  readonly children?: React.ReactNode | undefined;
}) {
  const { t } = useLocale();

  const [locked, setLocked] = useState(true);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        setLocked(false);
      }, 100);
    }
  }, [open]);

  const close = useCallback(() => {
    setLocked(true);
    setTimeout(() => {
      onOpenChange(false);
    }, 100);
  }, [onOpenChange]);

  useGranularEffect(
    () => {
      if (!open) {
        return undefined;
      }

      function handleKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
          close();
        }
      }

      window.addEventListener('keydown', handleKeyDown);

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    },
    [open],
    [close],
  );

  return (
    open &&
    createPortal(
      <div className="fixed" style={style}>
        {/* A button, because clicking it does exactly what clicking a button does, and a keyboard
            user gets the same close. A `div` here would put a control in front of the dialog that
            only the mouse could reach. */}
        <button
          type="button"
          aria-label={t('Modal.close')}
          className="fixed left-0 top-0 h-screen w-screen cursor-default border-none bg-black p-0 opacity-25 transition-opacity duration-300"
          onClick={close}
        />
        <div>
          <div
            className={`
            bg-bpd fixed left-1/2 m-0 box-border origin-center -translate-x-1/2 overflow-visible rounded-lg p-2 shadow-lg shadow-black transition-all duration-300
            ${verticalAlignment === 'center' ? 'top-1/2 -translate-y-1/2' : 'top-4'}
            ${locked ? 'pointer-events-none scale-0 opacity-0' : 'scale-1 opacity-1'}
          `}
          >
            <div className="flex gap-2">
              <div className="text-pl ml-auto text-center">{title}</div>
              <IconButton
                icon="times"
                iconClassName="size-4 fill-tpd"
                className="ml-auto rounded-full p-2"
                rippleColor="var(--color-ripple-icon-button)"
                title={t('Modal.close')}
                onClick={close}
              />
            </div>
            <div
              className={`flex flex-col gap-2 text-tpl max-h-[80vh] ${noWidthRestriction ? '' : 'w-[600px]'} max-w-[calc(100vw_-_4rem)] overflow-auto p-2`}
              style={innerStyle}
            >
              {children}
            </div>
          </div>
        </div>
      </div>,
      document.body,
    )
  );
}
