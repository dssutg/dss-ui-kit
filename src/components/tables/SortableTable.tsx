import type { TargetedEvent } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Icon } from '@/components/display/Icon';
import { Ripple } from '@/components/feedback/Ripple';
import {
  useVirtualizedList,
  type VirtualizedListRowRendererProps,
} from '@/components/inputs/VirtualizedList';
import { useLocale } from '@/locale';
import { cn } from '@/util/cn';
import { useForceUpdate } from '@/util/hooks/use_force_update';
import { useTimeout } from '@/util/hooks/use_timeout';
import { ColumnResizer } from './ColumnResizer';
import { SortableTableRow } from './SortableTableRow';

/**
 * How two rows are ordered, in the sense of `Array.prototype.sort`.
 *
 * Written as the caller would write it against their own data: the row descriptor is what the
 * comparator receives, and comparing `a.data.name` is one line.
 */
export type SortableTableComparatorFunction<T> = (
  a: SortableTableRowDescriptor<T>,
  b: SortableTableRowDescriptor<T>,
) => number;

/**
 * One comparator per column id.
 *
 * A record rather than an array so a column cannot be given a comparator belonging to another column by
 * being in the wrong position, and so a column with no comparator is simply absent rather than
 * comparing everything as equal.
 */
export type SortableTableColumnComparatorTable<T, C extends string> = Readonly<
  Record<C, SortableTableComparatorFunction<T>>
>;

/**
 * One column of the header: its id, the title an operator reads, and how wide it is.
 *
 * `width` is the starting width rather than a fixed one — the column can be dragged afterwards — and
 * `minWidth` is what stops a drag from making the column unusable. `id` is the caller's own column
 * name, and is what the renderer and the comparators are keyed by.
 */
export type SortableTableHeaderColumn<C extends string> = Readonly<{
  id: C;
  title: string;
  width: number;
  minWidth?: number | undefined;
  style?: React.CSSProperties | undefined;
}>;

/**
 * A cell rendered ahead of time, for a caller building a column's contents by hand rather than with a
 * renderer.
 */
export type SortableTableCellDescriptor<C extends string> = Readonly<{
  columnId: C;
  component: React.ReactNode;
}>;

/**
 * One row: an id of the caller's choosing and the data behind it.
 *
 * `id` has to be stable across renders and unique, because it is what the table keys its rendered rows
 * by. `data` is opaque to the table, which never reads a field of it.
 */
export type SortableTableRowDescriptor<T> = Readonly<{
  id: string;
  data: T;
}>;

/**
 * What a cell renderer is given: the row, its index, the column, and the column's current width.
 *
 * `columnWidth` is there because a cell that has to fit inside it — a bar, a number, a progress
 * indicator — cannot be laid out without knowing how much room there is.
 */
export type SortableTableCellRendererContext<T, C extends string> = Readonly<{
  row: SortableTableRowDescriptor<T>;
  data: T;
  rowIndex: number;
  columnId: C;
  columnIndex: number;
  columnWidth: number;
}>;

/** Renders one cell. See {@link SortableTableCellRendererContext} for what it is told. */
export type SortableTableCellRenderer<T, C extends string> = (
  context: SortableTableCellRendererContext<T, C>,
) => React.ReactNode;

/**
 * One renderer per column id — the alternative to a single renderer with a switch over `columnId`.
 */
export type SortableTableColumnRenderMap<T, C extends string> = Readonly<
  Record<C, SortableTableCellRenderer<T, C>>
>;

/**
 * Everything a {@link SortableTable} draws: its columns, its rows, how high a row is, and how to
 * render and compare them.
 *
 * A single descriptor rather than a set of props, so the caller's table can be built by a function and
 * passed as one value — and so a row renderer is not re-created on every render of the panel above it.
 * `headerRowHeight` and `rowHeight` are required rather than guessed because the virtualization
 * arithmetic needs them: a row height this table guessed wrong would put every row after the first
 * one in the wrong place.
 */
export type SortableTableDescriptor<T, C extends string> = Readonly<{
  headerColumns: SortableTableHeaderColumn<C>[];
  rows: SortableTableRowDescriptor<T>[];
  headerRowHeight: number;
  rowHeight: number;
  cellRenderer: SortableTableCellRenderer<T, C>;
  columnComparators: SortableTableColumnComparatorTable<T, C>;
  onRowClick?: ({
    event,
    row,
    rowIndex,
  }: {
    event: MouseEvent;
    row: SortableTableRowDescriptor<T>;
    rowIndex: number;
  }) => void;
  getRowStyle?: ({
    row,
    rowIndex,
  }: {
    row: SortableTableRowDescriptor<T>;
    rowIndex: number;
  }) => React.CSSProperties;
}>;

/**
 * Builds a single cell renderer out of a per-column map, so a {@link SortableTable} can be given one
 * renderer instead of the map.
 *
 * A column with no entry in the map renders as nothing: a table that asked for a missing cell would
 * have to fail on every render of every row that reached it.
 */
export function makeSortableTableCellRenderer<T, C extends string>(
  columnMap: SortableTableColumnRenderMap<T, C>,
): SortableTableCellRenderer<T, C> {
  return (context: SortableTableCellRendererContext<T, C>) =>
    columnMap[context.columnId]?.(context);
}

/**
 * The `aria-sort` of one header cell: what a screen reader says when it reaches the column.
 *
 * It is on the header cell rather than on the sort indicator inside the header button
 * because that is where the specification puts it, and it is stated for every column rather
 * than only for the sorted one — `none` is the answer for a column that is not sorted, and an
 * absent attribute says nothing.
 */
function getHeaderSortState(
  columnId: string,
  currentSortColumnId: string | undefined,
  currentReversedSort: boolean,
): 'ascending' | 'descending' | 'none' {
  if (currentSortColumnId !== columnId) {
    return 'none';
  }

  return currentReversedSort ? 'descending' : 'ascending';
}

/**
 * A virtualized table with draggable column widths and sortable columns.
 *
 * It draws and orders what the descriptor holds, and it does not sort: `sortColumnId` and
 * `reversedSort` are the caller's, and the rows arrive in the order they are to be drawn in. Sorting
 * the caller's array for them would take a copy of every row on every click, and a table of records
 * the caller is already holding should not be sorted behind its back.
 *
 * The header is sticky and the rows are fixed height, which is what makes the row geometry exact; a
 * row that needs to wrap is not what this is for.
 */
export function SortableTable<T, C extends string>({
  descriptor,
  sortColumnId,
  reversedSort = false,
  className,
  style,
  rowStyle,
  tableRef,
  onScroll,
}: {
  readonly descriptor: Readonly<SortableTableDescriptor<T, C>>;
  readonly sortColumnId?: C | undefined;
  readonly reversedSort?: boolean | undefined;
  readonly rowListOverScanCount?: number | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly className?: string | undefined;
  readonly rowStyle?: React.CSSProperties | undefined;
  tableRef?: React.MutableRefObject<HTMLTableSectionElement | null> | undefined;
  /** Called when the table's own scrolling element is scrolled. */
  readonly onScroll?: ((event: TargetedEvent<HTMLDivElement, Event>) => void) | undefined;
}): React.JSX.Element {
  const { t } = useLocale();

  const [isResizing, setIsResizing] = useState(false);
  const [currentSortColumnId, setCurrentSortColumnId] = useState<string | undefined>(
    // A table with no columns has nothing to sort by, so the default is the first one if there is one.
    sortColumnId ?? descriptor.headerColumns[0]?.id,
  );
  const [currentReversedSort, setCurrentReversedSort] = useState(reversedSort);

  const [columnWidths, setColumnWidths] = useState<number[]>(() =>
    descriptor.headerColumns.map((column) => column.width),
  );

  const getColumnMinWidth = useCallback(
    (columnIndex: number) => {
      return descriptor.headerColumns[columnIndex]?.minWidth ?? 24;
    },
    [descriptor.headerColumns],
  );

  const getNewColumnWidth = useCallback(
    (columnWidth: number, columnIndex: number, movementX: number) => {
      return Math.max(getColumnMinWidth(columnIndex), columnWidth + movementX);
    },
    [getColumnMinWidth],
  );

  const resizeColumn = useCallback(
    (columnIndex: number, movementX: number) => {
      setColumnWidths((widths: number[]) => {
        const newWidths = [...widths];

        newWidths[columnIndex] = getNewColumnWidth(
          newWidths[columnIndex] ?? 0,
          columnIndex,
          movementX,
        );

        return newWidths;
      });
    },
    [getNewColumnWidth],
  );

  const { startIndex, endIndex, containerRef, getItemStyle } = useVirtualizedList({
    itemCount: descriptor.rows.length,
    itemSize: descriptor.rowHeight,
    overScanCount: 10,
    ref: tableRef,
  });

  const forceUpdate = useForceUpdate();

  // Make sure references get propagated to hooks
  useTimeout(forceUpdate, 0);

  const columnComparators = descriptor.columnComparators;

  const orderedColumnComparators = useMemo(() => {
    // The currently sorted column is hoisted to the front so its comparator wins; the rest keep the
    // order the descriptor gave them. Excluded by column id rather than by comparator identity,
    // because two columns are allowed to compare with the same function.
    //
    // The element type is named on `entries` because the comparator table is keyed by a generic
    // column id, and without it `Object.entries` cannot tell what it is iterating.
    const entries = Object.entries<SortableTableComparatorFunction<T>>(columnComparators);
    const current =
      currentSortColumnId === undefined
        ? undefined
        : entries.find(([columnId]) => columnId === currentSortColumnId);

    return [
      ...(current === undefined ? [] : [current[1]]),
      ...entries
        .filter(([columnId]) => columnId !== currentSortColumnId)
        .map(([, comparator]) => comparator),
    ];
  }, [columnComparators, currentSortColumnId]);

  const rows = descriptor.rows;

  const sortedRows = useMemo(() => {
    return rows.toSorted((a, b) => {
      for (const comparator of orderedColumnComparators) {
        const comparisonResult = comparator(a, b);

        if (comparisonResult !== 0) {
          if (currentReversedSort) {
            return -comparisonResult;
          }
          return comparisonResult;
        }
      }

      return 0;
    });
  }, [rows, orderedColumnComparators, currentReversedSort]);

  const rowRenderer = useCallback(
    ({ index, style }: VirtualizedListRowRendererProps) => {
      const row = sortedRows[index];

      if (!row) {
        return null;
      }

      return (
        <SortableTableRow
          key={row.id}
          descriptor={descriptor}
          columnWidths={columnWidths}
          row={row}
          rowIndex={index}
          style={{ ...style, ...rowStyle }}
        />
      );
    },
    [sortedRows, descriptor, columnWidths, rowStyle],
  );

  const totalRowListHeight = descriptor.rows.length * descriptor.rowHeight;

  return (
    <div
      ref={containerRef}
      className={cn('relative flex flex-col overflow-auto', className)}
      style={style}
      onScroll={onScroll}
    >
      {
        // CSS Hacks:
        //
        // - https://stackoverflow.com/questions/3215553/make-a-div-fill-an-entire-table-cell
        // - https://stackoverflow.com/questions/54044479/table-with-sticky-header-and-resizable-columns-without-using-jquery
        // - https://stackoverflow.com/questions/41882616/why-border-is-not-visible-with-position-sticky-when-background-color-exists
        //
        // height: 1px must be applied to <table> tag, not <tr>, <th>, <td> to make it work in both Chrome and Firefox
      }
      <table className="relative h-[1px]">
        {descriptor.rows.length > 0 ? (
          <tbody className="relative overflow-hidden" style={{ height: totalRowListHeight }}>
            {Array.from({ length: endIndex - startIndex + 1 }, (_, offset) => {
              const index = startIndex + offset;

              return rowRenderer({ index, style: getItemStyle(index) });
            })}
          </tbody>
        ) : (
          <tbody>
            <tr>
              <td className="text-tpd p-4" colSpan={descriptor.headerColumns.length}>
                {t('SortableTable.emptyList')}
              </td>
            </tr>
          </tbody>
        )}
        {
          // NOTE: <thead> is after <tbody> because <thead>'s z-index must be
          // greater than <tbody>'s z-index so that <thead> is rendered on top of
          // <tbody> when the user scrolls the table.
        }
        <thead>
          <tr className="relative">
            {descriptor.headerColumns.map((column, index) => (
              <th
                key={column.id}
                aria-sort={getHeaderSortState(column.id, currentSortColumnId, currentReversedSort)}
                className="border-tpl bg-bpd shadow-tpl sticky top-0 box-border select-none border-r-2 pb-1 font-normal shadow-[inset_0px_-2px_0px_0px] last:border-r-0"
                style={{
                  ...(index !== descriptor.headerColumns.length - 1
                    ? {
                        width: columnWidths[index],
                        minWidth: columnWidths[index],
                        maxWidth: columnWidths[index],
                        height: descriptor.headerRowHeight,
                      }
                    : {
                        minWidth: columnWidths[index],
                        width: '100%',
                        height: descriptor.headerRowHeight,
                      }),
                  ...column.style,
                }}
              >
                {/* A button, because clicking the header sorts by that column. Enter and Space sort
                    too, which they did not before. */}
                <button
                  type="button"
                  className="hover:bg-bse relative flex h-full w-full cursor-pointer items-center justify-center overflow-hidden border-none bg-transparent px-2 py-1"
                  onClick={() => {
                    if (isResizing) {
                      return;
                    }

                    if (currentSortColumnId === column.id) {
                      setCurrentReversedSort((reversed) => !reversed);

                      return;
                    }

                    setCurrentSortColumnId(column.id);
                    setCurrentReversedSort(false);
                  }}
                >
                  {!isResizing && <Ripple color="var(--color-ripple-button)" />}
                  <div className="flex w-full items-center gap-1">
                    <div className="flex-grow text-center">{column.title}</div>
                    <Icon
                      name="triangleDown"
                      style={{
                        fill: 'var(--color-tpd)',
                        width: '1rem',
                        height: '1rem',
                        flexShrink: 0,
                        ...(currentReversedSort && {
                          transform: 'rotate(180deg)',
                        }),
                        ...(currentSortColumnId !== column.id && {
                          opacity: 0,
                          pointerEvents: 'none',
                        }),
                      }}
                    />
                  </div>
                </button>
                {index !== descriptor.headerColumns.length - 1 && (
                  <>
                    <div
                      className="bg-tpl absolute top-0 h-full w-[5px]"
                      style={{ right: '-0.3rem' }}
                    />
                    <ColumnResizer
                      width={columnWidths[index] ?? 0}
                      minWidth={descriptor.headerColumns[index]?.minWidth}
                      onResize={(movementX) => {
                        const headerColumn = descriptor.headerColumns[index];

                        if (headerColumn === undefined) {
                          return;
                        }

                        resizeColumn(index, movementX);
                        setIsResizing(true);
                      }}
                      onResizeDone={() => setTimeout(() => setIsResizing(false), 100)}
                      style={{
                        // Set the resizer height to the viewport height.
                        // Since the resizer is hidden on overflow-y, there's no need to match
                        // the height of the visible table area exactly; the resizer height can be much greater.
                        // This simplifies calculations while ensuring the resizer remains visible only
                        // within the table area.
                        height: `calc(100% + ${totalRowListHeight}px)`,
                        right: '-0.3rem',
                      }}
                    />
                  </>
                )}
              </th>
            ))}
          </tr>
        </thead>
      </table>
    </div>
  );
}
