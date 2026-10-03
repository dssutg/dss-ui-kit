import { useCallback, useMemo, useState } from 'react';
import { Icon } from '@/components/display/Icon';
import { Ripple } from '@/components/feedback/Ripple';
import {
  useVirtualizedList,
  type VirtualizedListRowRendererProps,
} from '@/components/inputs/VirtualizedList';
import { useForceUpdate } from '@/lib/use_force_update';
import { useTimeout } from '@/lib/use_timeout';
import { useLocale } from '@/locale';
import { ColumnResizer } from './ColumnResizer';
import { SortableTableRow } from './SortableTableRow';

export type SortableTableComparatorFunction<T> = (
  a: SortableTableRowDescriptor<T>,
  b: SortableTableRowDescriptor<T>,
) => number;

export type SortableTableColumnComparatorTable<T, C extends string> = Readonly<
  Record<C, SortableTableComparatorFunction<T>>
>;

export type SortableTableHeaderColumn<C extends string> = Readonly<{
  id: C;
  title: string;
  width: number;
  minWidth?: number | undefined;
  style?: React.CSSProperties | undefined;
}>;

export type SortableTableCellDescriptor<C extends string> = Readonly<{
  columnId: C;
  component: React.ReactNode;
}>;

export type SortableTableRowDescriptor<T> = Readonly<{
  id: string;
  data: T;
}>;

export type SortableTableCellRendererContext<T, C extends string> = Readonly<{
  row: SortableTableRowDescriptor<T>;
  data: T;
  rowIndex: number;
  columnId: C;
  columnIndex: number;
  columnWidth: number;
}>;

export type SortableTableCellRenderer<T, C extends string> = (
  context: SortableTableCellRendererContext<T, C>,
) => React.ReactNode;

export type SortableTableColumnRenderMap<T, C extends string> = Readonly<
  Record<C, SortableTableCellRenderer<T, C>>
>;

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

export function makeSortableTableCellRenderer<T, C extends string>(
  columnMap: SortableTableColumnRenderMap<T, C>,
) {
  return (context: SortableTableCellRendererContext<T, C>) =>
    columnMap[context.columnId]?.(context);
}

export function SortableTable<T, C extends string>({
  descriptor,
  sortColumnId,
  reversedSort = false,
  className,
  style,
  rowStyle,
  tableRef,
}: {
  readonly descriptor: Readonly<SortableTableDescriptor<T, C>>;
  readonly sortColumnId?: C | undefined;
  readonly reversedSort?: boolean | undefined;
  readonly rowListOverScanCount?: number | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly className?: string | undefined;
  readonly rowStyle?: React.CSSProperties | undefined;
  tableRef?: React.MutableRefObject<HTMLTableSectionElement | null> | undefined;
}) {
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
      className={`relative flex flex-col overflow-auto ${className}`}
      style={style}
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
