// SPDX-License-Identifier: MIT
// One row's cells against the widths the header is drawn from.
// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import type {
  SortableTableDescriptor,
  SortableTableHeaderColumn,
} from '@/components/tables/SortableTable';
import { SortableTableRow } from '@/components/tables/SortableTableRow';
import { click, render } from '@/util/testing/render';

interface Row {
  readonly name: string;
  readonly count: number;
}

type ColumnId = 'name' | 'count';

const descriptor: SortableTableDescriptor<Row, ColumnId> = {
  headerColumns: [
    { id: 'name', title: 'Name', width: 100, minWidth: 40 },
    { id: 'count', title: 'Count', width: 80 },
  ],
  rows: [{ id: 'a', data: { name: 'alpha', count: 1 } }],
  headerRowHeight: 30,
  rowHeight: 30,
  cellRenderer: ({ columnId, data }) => (
    <span>{columnId === 'name' ? data.name : String(data.count)}</span>
  ),
  columnComparators: {
    name: (a, b) => a.data.name.localeCompare(b.data.name),
    count: (a, b) => a.data.count - b.data.count,
  },
};

function renderRow(props: {
  columnWidths: number[];
  style?: React.CSSProperties;
  rowStyle?: React.CSSProperties;
}) {
  return render(
    <table>
      <tbody>
        <SortableTableRow
          descriptor={descriptor}
          columnWidths={props.columnWidths}
          row={descriptor.rows[0] as { id: string; data: Row }}
          rowIndex={0}
          style={props.style}
          rowStyle={props.rowStyle}
        />
      </tbody>
    </table>,
  );
}

describe('SortableTableRow', () => {
  it('renders a cell per column and lets the last column take the remaining width', async () => {
    const { findAll } = await renderRow({ columnWidths: [100, 80], style: { height: 30 } });

    const cells = findAll('td');

    expect(cells).toHaveLength(2);
    expect(cells[0]?.style.width).toBe('100px');
    expect(cells[1]?.style.width).toBe('100%');
  });

  it('reads a missing column width and row height as zero', async () => {
    const { findAll } = await renderRow({ columnWidths: [] });

    const cells = findAll('td');

    expect(cells[0]?.getAttribute('style')).toBe('height: 0px;');
    expect(cells[1]?.style.width).toBe('100%');
  });

  it('skips a column the header array has no entry for', async () => {
    const headerColumns: SortableTableHeaderColumn<ColumnId>[] = [];
    headerColumns.length = 2;

    const { container } = await render(
      <table>
        <tbody>
          <SortableTableRow
            descriptor={{ ...descriptor, headerColumns }}
            columnWidths={[100, 80]}
            row={descriptor.rows[0] as { id: string; data: Row }}
            rowIndex={0}
          />
        </tbody>
      </table>,
    );

    expect(container.querySelectorAll('td')).toHaveLength(0);
  });

  it("reports a click with the row, and layers the row's own style over the row style", async () => {
    const onRowClick = vi.fn();
    const getRowStyle = vi.fn(() => ({ color: 'red' }));
    const { find } = await render(
      <table>
        <tbody>
          <SortableTableRow
            descriptor={{ ...descriptor, onRowClick, getRowStyle }}
            columnWidths={[100, 80]}
            row={descriptor.rows[0] as { id: string; data: Row }}
            rowIndex={3}
            rowStyle={{ fontWeight: 'bold' }}
          />
        </tbody>
      </table>,
    );

    const row = find('tr');

    click(row);

    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick.mock.calls[0]?.[0]).toMatchObject({ rowIndex: 3 });
    expect(getRowStyle).toHaveBeenCalledWith({ row: descriptor.rows[0], rowIndex: 3 });
    expect(row.style.color).toBe('red');
    expect(find('td').style.fontWeight).toBe('bold');
  });
});
