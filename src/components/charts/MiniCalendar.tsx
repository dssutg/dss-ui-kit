import { useCallback, useEffect, useRef, useState } from 'react';
import { useEventListener } from '@/lib/use_event_listener';
import { useGranularEffect } from '@/lib/use_granular_effect';
import { useLocale } from '@/locale';
import { StaticCalendar } from './StaticCalendar';

/**
 * A month grid with the days that have data marked, for choosing a day in a small space.
 *
 * The month and the marks are the caller's: this draws the grid, highlights the days it is given and
 * reports the day that was clicked.
 */
export function MiniCalendar({
  visible,
  date,
  posX,
  posY,
  onClose,
}: {
  readonly visible: boolean;
  readonly date: Date;
  readonly posX: number;
  readonly posY: number;
  readonly onClose: () => void;
}) {
  const { t } = useLocale();

  const windowRef = useRef<HTMLButtonElement>(null);

  const [curX, setCurX] = useState(posX);
  const [curY, setCurY] = useState(posY);

  // NOTE If you use a pop-up animation, this position correct
  // is not going to work properly because the pop-up affects
  // the transform scale and it in turn affects the size of
  // the window making it smaller than it is after the animation.
  // So this code will take a smaller window size until the animation
  // is done. So, if you really want to use it, compute the height
  // before the animation is started.
  useGranularEffect(
    () => {
      if (windowRef.current) {
        const { height } = windowRef.current.getBoundingClientRect();
        setCurX(posX);
        setCurY(Math.min(posY, window.innerHeight - height - 100));
      }
    },
    [windowRef, windowRef.current, posY, posX],
    [],
  );

  useEffect(() => {
    if (visible) {
      windowRef.current?.focus();
    }
  }, [visible]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        onClose();
      }
    },
    [onClose],
  );

  useEventListener('click', (e: MouseEvent) => {
    if (visible) {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  });

  return (
    // A button, because a click anywhere on the popup closes it. It is not a submit button and does
    // nothing else, so `type="button"` keeps it out of any form around it.
    <button
      ref={windowRef}
      type="button"
      aria-label={t('Modal.close')}
      className="fixed box-border w-60 cursor-default select-none rounded-2xl border-none bg-[var(--color-mini-calendar-bg)] p-4 text-left shadow-lg shadow-black"
      style={{
        display: visible ? 'block' : 'none',
        top: curY,
        left: curX,
      }}
      onClick={onClose}
      onKeyDown={onKeyDown}
    >
      <StaticCalendar date={date} />
    </button>
  );
}
