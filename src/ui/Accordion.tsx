import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useScrollbarWidth } from '@/lib/use_scrollbar_width';
import { Icon } from '@/ui/Icon';
import { Ripple } from '@/ui/Ripple';

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
}) {
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
          className={`relative flex flex-grow items-center cursor-pointer overflow-hidden p-2 ${triggerClassName}`}
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
            className={`
              fill-tpd ml-auto size-4 shrink-0
              ${(flippedIcon && !expanded) || (!flippedIcon && expanded) ? 'rotate-180' : ''}
            `}
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

export function useAccordion(
  expanded: boolean,
  mode: 'vertical' | 'horizontal' = 'vertical',
  fixedSize: number | undefined = undefined,
) {
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
