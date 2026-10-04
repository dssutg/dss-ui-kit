import { type RefObject, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@/components/display/Icon';
import { Ripple } from '@/components/feedback/Ripple';
import { cn } from '@/util/cn';
import { useScrollbarWidth } from '@/util/hooks/use_scrollbar_width';

/**
 * A titled section that expands and collapses, with the content height animated.
 *
 * `expanded` is the caller's, so an accordion can be open because a route says so rather than because
 * someone clicked it. `forceMount` defaults to true so the content exists in the DOM while collapsed
 * and can be measured and searched; pass `false` for a section holding something expensive.
 */
export function Accordion({
  expanded,
  onExpansionChange,
  flippedIcon = false,
  triggerTitle,
  style,
  triggerStyle,
  triggerClassName,
  fixedSize,
  children,
  beforeTriggerComponent,
  afterTriggerComponent,
  getContentStyle,
  forceMount = true,
}: {
  readonly expanded: boolean;
  readonly onExpansionChange: (expanded: boolean) => void;
  readonly flippedIcon?: boolean | undefined;
  readonly triggerTitle?: React.ReactNode | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly contentClassName?: string | undefined;
  readonly triggerClassName?: string | undefined;
  readonly triggerStyle?: React.CSSProperties | undefined;
  readonly fixedSize?: number | undefined;
  readonly children?: React.ReactNode | undefined;
  readonly beforeTriggerComponent?: React.ReactNode | undefined;
  readonly afterTriggerComponent?: React.ReactNode | undefined;
  readonly getContentStyle?: (expanded: boolean) => React.CSSProperties;
  readonly forceMount?: boolean | undefined;
}): React.JSX.Element {
  const id = useId();
  const { contentRef, contentStyle: defaultContentStyle } = useAccordion(
    expanded,
    'vertical',
    fixedSize,
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); // prevent scrolling when pressing space
        onExpansionChange(!expanded);
      }
    },
    [expanded, onExpansionChange],
  );

  return (
    <div className="flex flex-col gap-1" style={style}>
      <div className="flex w-full items-center">
        {beforeTriggerComponent}
        <button
          tabIndex={0}
          type="button"
          className={cn(
            'relative flex flex-grow items-center cursor-pointer overflow-hidden p-2',
            triggerClassName,
          )}
          style={triggerStyle}
          onClick={() => onExpansionChange(!expanded)}
          onKeyDown={handleKeyDown}
          aria-expanded={expanded}
          aria-controls={id}
        >
          <Ripple color="var(--color-ripple-button)" />
          {typeof triggerTitle === 'string' ? (
            <div className="truncate">{triggerTitle}</div>
          ) : (
            triggerTitle
          )}
          <Icon
            name="triangleDown"
            className={cn(
              'fill-tpd ml-auto size-4 shrink-0',
              ((flippedIcon && !expanded) || (!flippedIcon && expanded)) && 'rotate-180',
            )}
          />
        </button>
        {afterTriggerComponent}
      </div>
      {/* A <section> is what `role="region"` was standing in for, and it needs no role of its own.
          The trigger points at this element through `aria-controls`. */}
      <section
        id={id}
        ref={contentRef}
        className="flex flex-col"
        style={{
          ...defaultContentStyle,
          ...getContentStyle?.(expanded),
        }}
      >
        {(forceMount || expanded) && children}
      </section>
    </div>
  );
}

/**
 * The height an {@link Accordion} animates between: the measured content height, or `fixedSize`.
 *
 * Returns `'auto'` until the content has been measured, which is what makes the animation possible:
 * a section that animates to `height: auto` cannot be transitioned by the browser. A fixed size
 * skips the measurement, and that is the right trade for a section whose height the caller already
 * knows.
 */
export function useAccordion(
  expanded: boolean,
  mode: 'vertical' | 'horizontal' = 'vertical',
  fixedSize: number | undefined = undefined,
): {
  contentRef: RefObject<HTMLDivElement>;
  contentStyle: {
    [x: string]: string | number;
    opacity: number;
    overflow: string;
    transition: string;
  };
} {
  const contentRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<number | 'auto'>('auto');
  const scrollbarWidth = useScrollbarWidth();

  useEffect(() => {
    if (!expanded) {
      setSize(0);
      return;
    }
    if (fixedSize !== undefined) {
      setSize(fixedSize);
      return;
    }
    if (!contentRef.current) {
      return;
    }
    if (mode === 'vertical') {
      setSize(contentRef.current.scrollHeight + scrollbarWidth);
    } else {
      setSize(contentRef.current.scrollWidth + scrollbarWidth);
    }
  }, [expanded, mode, fixedSize, scrollbarWidth]);

  return {
    contentRef,
    contentStyle: {
      [mode === 'vertical' ? 'height' : 'width']: size,
      opacity: expanded ? 1 : 0,
      overflow: 'hidden',
      transition: `${mode === 'vertical' ? 'height' : 'width'} 0.3s ease-in-out, opacity 0.3s ease-in-out`,
    },
  };
}
