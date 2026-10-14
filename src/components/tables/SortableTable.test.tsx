// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  makeSortableTableCellRenderer,
  SortableTable,
  type SortableTableDescriptor,
} from '@/components/tables/SortableTable';
import { act, click, render } from '@/util/testing/render';

interface Row {
  readonly name: string;
  readonly count: number;
  readonly extra: number;
}

type ColumnId = string;

function makeColumns(extra: string[] = []) {
  return [
    { id: 'name', title: 'Name', width: 100, minWidth: 40, style: { color: 'blue' } },
    { id: 'count', title: 'Count', width: 80, minWidth: 40 },
    { id: 'extra', title: 'Extra', width: 60 },
    { id: 'tail', title: 'Tail', width: 50 },
    ...extra.map((id) => ({ id, title: id, width: 30 })),
  ];
}

const rows: { id: string; data: Row }[] = [
  { id: 'r1', data: { name: 'beta', count: 2, extra: 1 } },
  { id: 'r2', data: { name: 'alpha', count: 2, extra: 1 } },
  { id: 'r3', data: { name: 'same', count: 9, extra: 9 } },
  { id: 'r4', data: { name: 'same', count: 9, extra: 9 } },
];

function makeDescriptor(headerColumns = makeColumns()): SortableTableDescriptor<Row, ColumnId> {
  return {
    headerColumns,
    rows,
    headerRowHeight: 30,
    rowHeight: 30,
    cellRenderer: ({ columnId, data }) => <span>{`${columnId}:${data.count}`}</span>,
    columnComparators: {
      name: (a, b) => a.data.name.localeCompare(b.data.name),
      count: (a, b) => a.data.count - b.data.count,
      extra: (a, b) => a.data.extra - b.data.extra,
      tail: () => 0,
    },
  };
}

function headerButton(title: string): HTMLButtonElement {
  const button = [...document.body.querySelectorAll('th button')].find((candidate) =>
    candidate.textContent?.includes(title),
  );

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`no header button titled ${title}`);
  }

  return button;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('SortableTable', () => {
  it('draws a button per column, marks the sorted one and exposes the column style', async () => {
    const { findAll } = await render(<SortableTable descriptor={makeDescriptor()} />);

    const headers = findAll('th');

    expect(headers).toHaveLength(4);
    expect(headers[0]?.getAttribute('aria-sort')).toBe('ascending');
    expect(headers[1]?.getAttribute('aria-sort')).toBe('none');
    expect(headers[0]?.style.color).toBe('blue');
    expect(headers[3]?.style.width).toBe('100%');
  });

  it('sorts by a clicked column and reverses on a second click, reporting each state', async () => {
    await render(<SortableTable descriptor={makeDescriptor()} />);

    click(headerButton('Count'));

    expect(headerButton('Count').closest('th')?.getAttribute('aria-sort')).toBe('ascending');

    click(headerButton('Count'));

    expect(headerButton('Count').closest('th')?.getAttribute('aria-sort')).toBe('descending');
  });

  it('resizes a column by dragging its handle and ignores a header click while dragging', async () => {
    vi.useFakeTimers();

    const { findAll } = await render(<SortableTable descriptor={makeDescriptor()} />);

    const resizers = findAll('hr');

    expect(resizers).toHaveLength(3);

    act(() => {
      resizers[2]?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      document.dispatchEvent(new MouseEvent('mousemove', { movementX: 25, bubbles: true }));
    });

    click(headerButton('Count'));

    expect(headerButton('Count').closest('th')?.getAttribute('aria-sort')).toBe('none');

    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      vi.advanceTimersByTime(150);
    });

    click(headerButton('Count'));

    expect(headerButton('Count').closest('th')?.getAttribute('aria-sort')).toBe('ascending');
  });

  it('reads a column width the width list never had once the header grows', async () => {
    vi.useFakeTimers();

    const { findAll, update } = await render(<SortableTable descriptor={makeDescriptor()} />);

    await update(
      <SortableTable descriptor={makeDescriptor(makeColumns(['added-a', 'added-b']))} />,
    );

    expect(findAll('hr')[4]?.getAttribute('aria-valuenow')).toBe('0');

    act(() => {
      findAll('hr')[4]?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      document.dispatchEvent(new MouseEvent('mousemove', { movementX: 10, bubbles: true }));
    });

    expect(findAll('hr')[4]?.getAttribute('aria-valuenow')).toBe('24');
  });

  it('shows an empty-list message when there are no rows', async () => {
    const { findByText } = await render(
      <SortableTable descriptor={{ ...makeDescriptor(), rows: [] }} />,
    );

    expect(findByText('Empty list')).toBeDefined();
  });

  it('sorts without a column when the header is empty and no column was named', async () => {
    const { query } = await render(
      <SortableTable descriptor={{ ...makeDescriptor(), headerColumns: [] }} />,
    );

    expect(query('th')).toBeNull();
    expect(query('tbody tr')).not.toBeNull();
  });

  it("reports its own scroll and a row's click", async () => {
    const onScroll = vi.fn();
    const onRowClick = vi.fn();
    const { find } = await render(
      <SortableTable
        className="test-table"
        descriptor={{ ...makeDescriptor(), onRowClick }}
        onScroll={onScroll}
      />,
    );

    act(() => {
      find('.test-table').dispatchEvent(new Event('scroll', { bubbles: true }));
    });

    expect(onScroll).toHaveBeenCalledTimes(1);

    click(document.body.querySelectorAll('tbody tr')[0] as Element);

    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it('keeps the table section ref it was handed', async () => {
    const tableRef = { current: null as HTMLTableSectionElement | null };

    await render(<SortableTable descriptor={makeDescriptor()} tableRef={tableRef} />);

    expect(tableRef.current).not.toBeNull();
  });
});

describe('SortableTable header helpers', () => {
  it('renders an icon only for a table with a sorted column', async () => {
    const { findAll } = await render(<SortableTable descriptor={makeDescriptor()} />);

    expect(findAll('svg').length).toBeGreaterThan(0);
  });

  it('renders nothing for a column the cell map has no entry for', () => {
    const renderer = makeSortableTableCellRenderer<Row, ColumnId>({
      name: () => <span>cell</span>,
    });

    const context = {
      row: rows[0] as { id: string; data: Row },
      data: rows[0]?.data as Row,
      rowIndex: 0,
      columnId: 'name',
      columnIndex: 0,
      columnWidth: 100,
    };

    expect(renderer(context)).toBeDefined();
    expect(renderer({ ...context, columnId: 'missing' })).toBeUndefined();
  });

  it('stops drawing a row the row list no longer holds', async () => {
    const { update } = await render(<SortableTable descriptor={makeDescriptor()} />);

    await update(
      <SortableTable
        descriptor={{ ...makeDescriptor(), rows: [rows[0] as { id: string; data: Row }] }}
      />,
    );

    expect(document.body.querySelectorAll('tbody tr')).toHaveLength(1);
  });
});
