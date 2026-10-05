import { useRef, useState } from 'react';
import { cn } from '@/util/cn';
import { useGranularEffect } from '@/util/hooks/use_granular_effect';
import { uuidv4 } from '@/util/uuid';

/**
 * A circular ripple expanding from the centre, used by {@link Button} for its pressed state.
 *
 * Purely visual: it is `aria-hidden`, and a caller who needs the pressed state announced needs a real
 * `aria-pressed`, which is the button's business and not this component's.
 *
 * Ensure that the component that uses this one has position 'relative' or non-static one. Also, make
 * sure that the component's overflow is `hidden`. Otherwise, the ripple effect goes beyond the component
 * instead of staying inside of it.
 */
export function Ripple({
  color = 'rgba(128, 128, 255, 0.7)',
  duration = 600,
  className,
}: {
  readonly color?: string | undefined;
  readonly duration?: number | undefined;
  readonly className?: string | undefined;
}): false | React.JSX.Element {
  const wrapperRef = useRef<HTMLSpanElement>(null);

  interface RippleInstance {
    id: string;
    top: number;
    left: number;
    diameter: number;
  }

  const [ripples, setRipples] = useState<RippleInstance[]>([]);

  useGranularEffect(
    () => {
      if (!wrapperRef.current) {
        return undefined;
      }

      function onClick(e: MouseEvent) {
        const button = e.currentTarget as HTMLButtonElement;

        if (button === null) {
          return;
        }

        const rect = button.getBoundingClientRect();

        const diameter = Math.max(button.clientWidth, button.clientHeight);
        const radius = diameter / 2;
        const id = uuidv4();

        const circleCenterX = e.clientX - rect.left;
        const circleCenterY = e.clientY - rect.top;

        const left = circleCenterX - radius;
        const top = circleCenterY - radius;

        setRipples((ripples) => [...ripples, { id, top, left, diameter }]);

        // It lasts a bit less than the CSS animation to avoid glitches
        const rippleLifeTime = duration - 100;

        setTimeout(() => {
          setRipples((ripples) => ripples.filter((ripple) => ripple.id !== id));
        }, rippleLifeTime);
      }

      const { parentElement } = wrapperRef.current;

      if (!parentElement) {
        return undefined;
      }

      parentElement.addEventListener('click', onClick);

      return () => parentElement.removeEventListener('click', onClick);
    },
    [wrapperRef, wrapperRef.current, color, duration],
    [],
  );

  return (
    color !== '' && (
      <span
        ref={wrapperRef}
        className={cn('pointer-events-none absolute left-0 top-0', className)}
        aria-hidden="true"
      >
        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            className="animate-ripple pointer-events-none absolute rounded-full duration-[var(--ripple-duration)]"
            aria-hidden="true"
            style={
              {
                '--ripple-duration': `${duration}ms`,
                width: ripple.diameter,
                height: ripple.diameter,
                left: ripple.left,
                top: ripple.top,
                backgroundColor: color,
              } as React.CSSProperties
            }
          />
        ))}
      </span>
    )
  );
}
