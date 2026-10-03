import { useLocale } from '@/locale';

/** How far an arrow key moves a column edge, in pixels. */
const KEYBOARD_RESIZE_STEP = 8;

export function ColumnResizer({
  style,
  onResize,
  onResizeDone,
  width,
  minWidth,
}: {
  readonly style?: React.CSSProperties | undefined;
  readonly onResize?: (movementX: number) => void;
  readonly onResizeDone?: () => void;
  /** The column's current width. A focusable separator has to report its value. */
  readonly width: number;
  readonly minWidth?: number | string | undefined;
}) {
  const { t } = useLocale();

  // `role="separator"` is what a draggable divider between two panes is. The arrow keys step it by
  // 8 pixels, which is the same amount a single `movementX` step usually amounts to, so a keyboard
  // user gets the same control a mouse gets rather than none.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
      return;
    }

    e.preventDefault();

    onResize?.(e.key === 'ArrowLeft' ? -KEYBOARD_RESIZE_STEP : KEYBOARD_RESIZE_STEP);
    onResizeDone?.();
  };

  // An `<hr>`, because a separator is what a rule between two things is, and it takes the same
  // `separator` role with the same value attributes. Its own borders and margins are reset: this one
  // is a control, not a divider between paragraphs.
  return (
    <hr
      aria-orientation="vertical"
      aria-label={t('SortableTable.resizeColumn')}
      aria-valuenow={width}
      aria-valuemin={typeof minWidth === 'number' ? minWidth : 0}
      aria-valuemax={Number.MAX_SAFE_INTEGER}
      tabIndex={0}
      className="absolute right-0 top-0 m-0 h-full w-2 cursor-col-resize select-none border-none"
      onKeyDown={handleKeyDown}
      onMouseDown={(e) => {
        const originalMouseCursor = document.body.style.cursor;

        document.body.style.cursor = 'col-resize';

        // Prevent text selection
        e.preventDefault();

        function handleMouseMove(e: MouseEvent) {
          onResize?.(e.movementX);
        }

        function handleMouseUp() {
          document.body.style.cursor = originalMouseCursor;
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
          onResizeDone?.();
        }

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      }}
      onClick={(e) => {
        // Prevent event bubbling
        e.stopPropagation();
        onResize?.(0);
      }}
      style={style}
    />
  );
}
