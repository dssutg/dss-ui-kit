import { createPortal, useRef, useState } from 'react';
import { cn } from '@/util/cn';
import { useGranularEffect } from '@/util/hooks/use_granular_effect';

/**
 * How a tooltip is coloured, which is all this type decides.
 *
 * `bad` and `good` are the outcomes an operator reads after an action; `regular` and `normal` are
 * neutral and exist so a caller can keep one call site and vary the outcome.
 */
export type FeedbackTooltipType = 'regular' | 'bad' | 'normal' | 'good';

const feedbackTooltipColorPairClasses: Readonly<Record<FeedbackTooltipType, string>> = {
  regular: 'text-tpl bg-bpd',
  bad: 'text-bdat bg-bda',
  normal: 'text-bnot bg-bno',
  good: 'text-bokt bg-bok',
};

// Feedback tooltip that temporarily slides down
/**
 * A tooltip anchored to a trigger element, shown for as long as `visible` is true.
 *
 * Rendered through a portal onto `document.body` and positioned by measuring the trigger, because a
 * tooltip inside a transformed ancestor is positioned against that ancestor's box rather than the
 * viewport — which is what a tooltip inside a scaled modal needs. The portal is why the trigger is a
 * prop and not a wrapper: this component does not own the control the tooltip belongs to.
 */
export function FeedbackTooltip({
  type = 'regular',
  visible,
  duration = 1000,
  title,
  trigger,
  children,
}: {
  readonly type?: FeedbackTooltipType | undefined;
  readonly visible: boolean;
  readonly duration?: number | undefined;
  readonly title?: string | undefined;
  readonly trigger?: HTMLElement | null | undefined;
  readonly children?: React.ReactNode | undefined;
}) {
  const [isVisible, setIsVisible] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);

  const colorPairClass = feedbackTooltipColorPairClasses[type];

  function fixPos(
    trigger: HTMLElement | null | undefined,
    container: HTMLElement | null | undefined,
  ) {
    if (!trigger || !container) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const height = parseInt(window.getComputedStyle(container).height, 10) || 0;
    const triggerRect = trigger.getBoundingClientRect();

    container.style.left = `${Math.min(triggerRect.left, window.innerWidth - rect.width)}px`;
    container.style.top = `${Math.min(triggerRect.bottom, window.innerHeight - height)}px`;
  }

  useGranularEffect(
    () => {
      if (!visible) {
        setIsVisible(false);
        return undefined;
      }

      fixPos(trigger, wrapperRef.current);
      setIsVisible(true);

      const timer = setTimeout(() => setIsVisible(false), duration);

      return () => clearTimeout(timer);
    },
    [visible, duration, trigger],
    [fixPos],
  );

  // Portals help to avoid incorrect positioning because of transforms like scale or translate
  // that affect top and left CSS properties to be not relative viewport.
  // This problem often happens in modal windows.
  return createPortal(
    <div
      ref={wrapperRef}
      className={cn(
        'fixed origin-top transform overflow-visible rounded-bl-lg rounded-br-lg px-4 py-2 shadow-lg shadow-black transition-[transform] duration-300',
        isVisible ? 'scale-y-1' : 'scale-y-0',
        colorPairClass,
      )}
      aria-hidden={!isVisible}
    >
      {title}
      {children}
    </div>,
    document.body,
  );
}

/**
 * Re-shows a tooltip the caller is already controlling with a boolean.
 *
 * Sets the state false and back on the next tick, so an element that has been open stays mounted and
 * the animation replays. Takes the state setter rather than the element because the caller owns the
 * state; this is the sequencing, not the decision.
 */
export function showFeedbackTooltip(changeState: React.Dispatch<React.SetStateAction<boolean>>) {
  changeState(false);
  setTimeout(() => changeState(true), 0);
}
