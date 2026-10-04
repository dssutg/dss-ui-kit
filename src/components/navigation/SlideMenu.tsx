import { createPortal, useCallback } from 'react';
import { IconButton } from '@/components/buttons/IconButton';
import { useLocale } from '@/locale';
import { useDraggablePanel } from '@/util/hooks/use_draggable_panel';

/**
 * A button that opens a panel sliding in from the left edge of the viewport, over a backdrop.
 *
 * The panel holds whatever the caller puts in it — a menu, a form, a list — and is reached through a
 * drag as well as through the button: a drag starting on the panel or near the left edge follows the
 * pointer, and releasing the pointer past the halfway mark finishes opening and releasing it short
 * closes. The panel and the backdrop are portalled onto the body, because a panel positioned from the
 * left edge of the viewport is not in the flow of whatever the caller renders it beside.
 *
 * `open` is the caller's, because whether the panel is open is a fact about the application: it is
 * closed on a navigation, on a key press of the caller's choosing, and by the release of a drag, and
 * the component that opens the menu is rarely the one that has to close it. A drag also reports
 * through `onOpenChange`, and the panel is moved to the side it ended on before the caller's re-render
 * arrives, so a caller that renders late still sees a panel on the side it decided on.
 *
 * `topOffset` is the height of whatever sits above the panel — a bar the caller renders — so that the
 * panel covers the rest of the viewport rather than that bar. Nothing here assumes what is above it.
 *
 * `title` and `closeTitle` default to the names this ships, which name the button and the backdrop;
 * pass them only to name a menu of something specific.
 */
export function SlideMenu({
  open,
  onOpenChange,
  title,
  closeTitle,
  topOffset = '0px',
  width = '20rem',
  className,
  panelClassName,
  overlayClassName,
  children,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title?: string | undefined;
  readonly closeTitle?: string | undefined;
  /** A CSS length: how far down the viewport the panel starts. */
  readonly topOffset?: string | undefined;
  /** A CSS length: how wide the panel is. A drag is measured against this width, so it is read from the panel. */
  readonly width?: string | undefined;
  readonly className?: string | undefined;
  readonly panelClassName?: string | undefined;
  readonly overlayClassName?: string | undefined;
  readonly children?: React.ReactNode | undefined;
}) {
  const { t } = useLocale();

  const panelTitle = title ?? t('SlideMenu.open');
  const panelCloseTitle = closeTitle ?? t('SlideMenu.close');

  const { panelRef, overlayRef } = useDraggablePanel({
    visible: open,
    onVisibleChange: onOpenChange,
  });

  const close = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <>
      <IconButton
        icon={open ? 'times' : 'bars'}
        iconClassName="size-7 fill-tpd"
        className={`rounded-full p-2 ${className}`}
        title={open ? panelCloseTitle : panelTitle}
        rippleColor="var(--color-ripple-icon-button)"
        onClick={() => {
          onOpenChange(!open);
        }}
      />
      {createPortal(
        <>
          {/* A button, because clicking it does what clicking a button does and a keyboard user gets
              the same close. A backdrop a `div` closes is one only a mouse can reach. */}
          <button
            ref={overlayRef}
            type="button"
            aria-label={panelCloseTitle}
            className={`
              fixed left-0 h-screen w-screen cursor-default border-none bg-black p-0 transition-opacity
              ${open ? '' : 'pointer-events-none opacity-0'} ${overlayClassName}
            `}
            style={{ top: topOffset }}
            onClick={close}
          />
          <div
            ref={panelRef}
            className={`bg-bpd fixed left-0 max-w-full overflow-y-auto text-tpl shadow-lg ${panelClassName}`}
            style={{ top: topOffset, width: width, height: `calc(100vh - ${topOffset})` }}
          >
            {children}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
