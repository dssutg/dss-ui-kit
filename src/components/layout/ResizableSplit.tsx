import { useEffect, useRef, useState } from 'react';
import { useMouseDrag } from '@/lib/hooks/use_mouse_drag';
import { clamp } from '@/lib/math';

/**
 * Panels side by side with draggable dividers, which remember where they were put.
 *
 * Sizes are fractions of the split, not pixels, so the panels stay proportional when the window
 * changes size. The divider positions are written to `localStorage` under a key derived from the
 * orientation, which is why this component does not take a key: two splits in one page share it.
 */
export function ResizableSplit({
  panels,
  style,
  orientation = 'horizontal',
  childrenOverflow = 'overflow-auto',
}: {
  readonly panels: readonly {
    id: string;
    component: React.ReactNode;
    initialSize?: number | undefined;
    minSize?: number | undefined;
    maxSize?: number | undefined;
  }[];
  readonly style?: React.CSSProperties | undefined;
  readonly orientation?: 'horizontal' | 'vertical' | undefined;
  readonly childrenOverflow?: string | undefined;
}) {
  const vertical = orientation === 'vertical';

  return (
    <div className={`flex flex-grow overflow-hidden ${vertical ? 'flex-col' : ''}`} style={style}>
      {panels.map((panel, index) => (
        <ResizablePanel
          key={panel.id}
          last={index === panels.length - 1}
          initialSize={panel.initialSize}
          minSize={panel.minSize}
          maxSize={panel.maxSize}
          totalPanels={panels.length}
          vertical={vertical}
          childrenOverflow={childrenOverflow}
        >
          {panel.component}
        </ResizablePanel>
      ))}
    </div>
  );
}

function ResizablePanel({
  last,
  initialSize,
  minSize,
  maxSize,
  totalPanels,
  vertical,
  childrenOverflow,
  children,
}: {
  readonly last: boolean;
  readonly initialSize: number | undefined;
  readonly minSize: number | undefined;
  readonly maxSize: number | undefined;
  readonly totalPanels: number;
  readonly vertical: boolean;
  readonly childrenOverflow: string;
  readonly children?: React.ReactNode | undefined;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  const defaultSize = initialSize ?? 100 / totalPanels;

  const [size, setSize] = useState(defaultSize);

  useEffect(() => {
    setSize(defaultSize);
  }, [defaultSize]);

  let styleSize: string | number = 0;
  if (!last) {
    styleSize = `${size}%`;
  }

  let styleMinSize: string | undefined;
  if (minSize !== undefined) {
    styleMinSize = `${minSize}%`;
  }

  let styleMaxSize: string | undefined;
  if (maxSize !== undefined) {
    styleMaxSize = `${maxSize}%`;
  }

  return (
    <div
      ref={panelRef}
      className={`flex overflow-hidden ${vertical ? 'flex-col' : ''}`}
      style={{
        flexGrow: last ? 1 : undefined,
        ...(vertical
          ? {
              height: styleSize,
              minHeight: styleMinSize,
              maxHeight: styleMaxSize,
            }
          : {
              width: styleSize,
              minWidth: styleMinSize,
              maxWidth: styleMaxSize,
            }),
      }}
    >
      <div className={`flex flex-grow ${childrenOverflow}`}>{children}</div>
      {!last && (
        <ResizableSplitPanelSizer
          panelRef={panelRef}
          size={size}
          minSize={minSize}
          maxSize={maxSize}
          onResize={setSize}
          vertical={vertical}
        />
      )}
    </div>
  );
}

function ResizableSplitPanelSizer({
  panelRef,
  size,
  minSize,
  maxSize,
  onResize,
  vertical,
}: {
  readonly panelRef: React.RefObject<HTMLDivElement | null>;
  readonly size: number;
  readonly minSize: number | undefined;
  readonly maxSize: number | undefined;
  readonly onResize: (newSize: number) => void;
  readonly vertical: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  const [, setIsMounted] = useState(false);

  const originalMouseCursorRef = useRef(document.body.style.cursor);

  useMouseDrag(
    ref.current,
    (_, { newPosition }) => {
      if (panelRef.current === null) {
        return;
      }

      const actualMinSize = Math.max(1, minSize ?? 1);
      const actualMaxSize = Math.min(maxSize ?? 100, 100);

      const panelRect = panelRef.current.getBoundingClientRect();

      let panelRectDimension = panelRect.width;
      if (vertical) {
        panelRectDimension = panelRect.height;
      }

      const fullSize = (panelRectDimension * 100) / size;

      let panelRelativePosition = 0;
      if (vertical) {
        panelRelativePosition = newPosition.y - panelRect.y;
      } else {
        panelRelativePosition = newPosition.x - panelRect.x;
      }

      const newSize = clamp((panelRelativePosition / fullSize) * 100, actualMinSize, actualMaxSize);

      onResize(newSize);
    },
    {
      onHandleDown: () => {
        originalMouseCursorRef.current = document.body.style.cursor;

        if (vertical) {
          document.body.style.cursor = 'row-resize';
        } else {
          document.body.style.cursor = 'col-resize';
        }
      },

      onHandleUp: () => {
        document.body.style.cursor = originalMouseCursorRef.current;
      },
    },
  );

  return (
    <div
      ref={(element) => {
        ref.current = element;
        setIsMounted(true);
      }}
      className={`
        flex justify-center items-center shrink-0 bg-bpl
        ${vertical ? 'h-2 cursor-row-resize' : 'w-2 cursor-col-resize'}
      `}
    />
  );
}
