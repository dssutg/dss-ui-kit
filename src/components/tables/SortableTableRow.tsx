import type {
  SortableTableCellRendererContext,
  SortableTableDescriptor,
  SortableTableRowDescriptor,
} from './SortableTable';

export function SortableTableRow<T, C extends string>({
  descriptor,
  columnWidths,
  row,
  rowIndex,
  style,
  rowStyle,
}: {
  readonly descriptor: SortableTableDescriptor<T, C>;
  readonly columnWidths: number[];
  readonly row: SortableTableRowDescriptor<T>;
  readonly rowIndex: number;
  readonly style?: React.CSSProperties | undefined;
  readonly rowStyle?: React.CSSProperties | undefined;
}) {
  let cells: React.ReactNode[] = [];

  for (let columnIndex = 0; columnIndex < descriptor.headerColumns.length; columnIndex++) {
    const headerColumn = descriptor.headerColumns[columnIndex];

    if (headerColumn === undefined) {
      continue;
    }

    const columnId = headerColumn.id;

    const context: SortableTableCellRendererContext<T, C> = {
      row,
      data: row.data,
      rowIndex,
      columnId,
      columnIndex,
      columnWidth: columnWidths[columnIndex] ?? 0,
    };

    cells = [
      ...cells,
      <td
        key={columnId}
        className="group border-tpl relative box-border overflow-hidden border-r-2 px-2 font-normal last:border-r-0"
        style={{
          ...(columnIndex !== descriptor.headerColumns.length - 1
            ? {
                width: columnWidths[columnIndex],
                minWidth: columnWidths[columnIndex],
                maxWidth: columnWidths[columnIndex],
              }
            : {
                minWidth: columnWidths[columnIndex],
                width: '100%',
              }),
          height: style?.height ?? 0,
          ...rowStyle,
        }}
      >
        {descriptor.cellRenderer(context)}
      </td>,
    ];
  }

  return (
    <tr
      className="border-tpl odd:bg-bpl overflow-hidden border-b-2"
      style={{
        ...style,
        ...descriptor?.getRowStyle?.({ row, rowIndex }),
      }}
      onClick={(e) => descriptor?.onRowClick?.({ event: e, row, rowIndex })}
    >
      {cells}
    </tr>
  );
}
