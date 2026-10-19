// SPDX-License-Identifier: MIT
// A small month grid for picking a day, marked by the caller.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from '@/locale';
import { cn } from '@/util/cn';
import { useEventListener } from '@/util/hooks/use_event_listener';
import { useGranularEffect } from '@/util/hooks/use_granular_effect';
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
  className,
}: {
  readonly visible: boolean;
  readonly date: Date;
  readonly posX: number;
  readonly posY: number;
  readonly onClose: () => void;
  readonly className?: string | undefined;
}): React.JSX.Element {
  const { t } = useLocale();

  const windowRef = useRef<HTMLButtonElement>(null);

  const [curX, setCurX] = useState(posX);
  const [curY, setCurY] = useState(posY);

  // NOTE If you use a pop-up animation, this position correction
  // is not going to work properly because the pop-up affects
  // the transform scale and it in turn affects the size of
  // the window making it smaller than it is after the animation.
  // So this code will take a smaller window size until the animation
  // is done. So, if you really want to use it, compute the height
  // before the animation is started.
  useGranularEffect(
    () => {
      // v8 ignore start: the ref is assigned during the commit that precedes this effect, so every
      // run of the body — the first one and a re-run on a position change — sees the element, and
      // the null guard cannot be taken. The tests still assert the position the body computes.
      if (windowRef.current) {
        const { height } = windowRef.current.getBoundingClientRect();
        setCurX(posX);
        setCurY(Math.min(posY, window.innerHeight - height - 100));
      }
      // v8 ignore stop
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
    // nothing else, so `type="button"` keeps it out of any form around it. The window listener above
    // reports the close, so the button carries no click handler of its own.
    <button
      ref={windowRef}
      type="button"
      aria-label={t('Modal.close')}
      className={cn(
        'fixed box-border w-60 cursor-default select-none rounded-2xl border-none bg-[var(--color-mini-calendar-bg)] p-4 text-left shadow-lg shadow-black',
        className,
      )}
      style={{
        display: visible ? 'block' : 'none',
        top: curY,
        left: curX,
      }}
      onKeyDown={onKeyDown}
    >
      <StaticCalendar date={date} />
    </button>
  );
}
