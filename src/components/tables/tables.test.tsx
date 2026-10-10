// @vitest-environment jsdom

import { act } from 'react-dom/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { AutoSizer } from '@/components/layout/AutoSizer';
import { ResizableSplit } from '@/components/layout/ResizableSplit';
import { ColumnResizer } from '@/components/tables/ColumnResizer';
import { ControlledTable, getEnumLabel } from '@/components/tables/ControlledTable';
import { CountLabel } from '@/components/tables/CountLabel';
import { FilterableTable } from '@/components/tables/FilterableTable';
import { SortableTable, type SortableTableDescriptor } from '@/components/tables/SortableTable';
import { click, flush, render } from '@/util/testing/render';

/** One row of the table every test here renders, over a shape the library never names. */
interface Row {
  readonly name: string;
  readonly count: number;
}

const rows: Row[] = [
  { name: 'alpha', count: 2 },
  { name: 'beta', count: 1 },
];

describe('AutoSizer', () => {
  it('measures its parent and hands the size to its child', async () => {
    const { findByText } = await render(
      <AutoSizer>
        {(size) => <p>measured {size.width > 0 && size.height > 0 ? 'yes' : 'no'}</p>}
      </AutoSizer>,
    );

    expect(findByText('measured yes')).toBeDefined();
  });

  it('reports a resize, and passes on only the axis it was asked for', async () => {
    const onResize = vi.fn();
    const { findByText } = await render(
      <AutoSizer disableWidth onResize={onResize}>
        {(size) => <p>height {size.height}</p>}
      </AutoSizer>,
    );

    expect(findByText(`height ${onResize.mock.calls[0]?.[0]?.height ?? ''}`)).toBeDefined();
    expect(onResize).toHaveBeenCalled();
  });
});

describe('ResizableSplit', () => {
  it("renders each panel's own component, and a divider between them but not after the last", async () => {
    const { container, findAll, findByText } = await render(
      <ResizableSplit
        panels={[
          { id: 'left', component: <p>Left</p>, minSize: 10, initialSize: 30 },
          { id: 'right', component: <p>Right</p>, minSize: 10, initialSize: 70 },
        ]}
      />,
    );

    expect(findByText('Left')).toBeDefined();
    expect(findByText('Right')).toBeDefined();
    // A resizer is a div (handle), not an <hr>; each panel before last has one.
    const handles = findAll('div').filter((el) => (el as HTMLElement).className.includes('cursor'));
    expect(handles.length).toBe(1);
    expect(container.textContent).toContain('Left');
  });
});

describe('ColumnResizer', () => {
  it('reports a drag as a movement rather than resizing the column itself', async () => {
    const onResize = vi.fn();
    const { find } = await render(
      <ColumnResizer width={100} onResize={onResize} onResizeDone={() => undefined} />,
    );

    // A real `<hr>`, so it is in the document as a separator without the role having to be added.
    const handle = find('hr');

    expect(handle.getAttribute('aria-valuenow')).toBe('100');

    act(() => {
      handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { movementX: 40, bubbles: true }));
    });
    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    expect(onResize).toHaveBeenCalledWith(40);
  });
});

describe('CountLabel', () => {
  it('drops the total while nothing is filtered out', async () => {
    const { find } = await render(
      <CountLabel filteredRowCount={40} totalRowCount={40} countLabelPrefix="Rows" />,
    );

    expect(find('div').textContent).toBe('Rows: 40');
  });

  it('shows both counts once rows are filtered out', async () => {
    const { find } = await render(
      <CountLabel filteredRowCount={3} totalRowCount={40} countLabelPrefix="Rows" />,
    );

    expect(find('div').textContent).toBe('Rows: 3 / 40');
  });
});

describe('getEnumLabel', () => {
  it('prefers the label the caller listed, and falls back to the raw value', () => {
    const property = {
      options: [{ value: 'ok', label: 'Working' }],
    };

    expect(getEnumLabel(property, 'ok')).toBe('Working');
    // A value added to the caller's data is still readable before they list it.
    expect(getEnumLabel(property, 'new')).toBe('new');
  });
});

describe('SortableTable', () => {
  type ColumnId = 'name' | 'count';

  const descriptor: SortableTableDescriptor<Row, ColumnId> = {
    headerColumns: [
      { id: 'name', title: 'Name', width: 100, minWidth: 40 },
      { id: 'count', title: 'Count', width: 80, minWidth: 40 },
    ],
    rows: rows.map((data, index) => ({ id: String(index), data })),
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

  it('renders a header cell per column and a row per item', async () => {
    const { findAll, findByText } = await render(<SortableTable descriptor={descriptor} />);

    expect(findAll('th')).toHaveLength(2);
    expect(findAll('tbody tr').length).toBeGreaterThanOrEqual(2);
    expect(findByText('alpha')).toBeDefined();
    expect(findByText('beta')).toBeDefined();
  });

  it('reports a row click with the item behind it', async () => {
    const onRowClick = vi.fn();
    const { findByText } = await render(
      <SortableTable descriptor={{ ...descriptor, onRowClick }} />,
    );

    await click(findByText('alpha'));

    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick.mock.calls[0]?.[0]).toMatchObject({ row: { data: rows[0] } });
  });

  it('sorts by the column it is told to, and says which direction it is in', async () => {
    const { findAll } = await render(
      <SortableTable descriptor={descriptor} sortColumnId="count" reversedSort={false} />,
    );

    // The header is a real `<th>`, and the sort is stated on the column that is sorted rather than on
    // the rows, which is where a screen reader looks for it.
    await flush();
    const headers = findAll('th');

    expect(headers[0]?.getAttribute('aria-sort')).toBe('none');
    expect(headers[1]?.getAttribute('aria-sort')).toBe('ascending');
  });
});

describe('ControlledTable', () => {
  const properties = [
    {
      id: 'name',
      title: 'Name',
      width: 200,
      minWidth: 40,
      cell: ({ data }: { readonly data: Row }) => <span>{data.name}</span>,
      comparator: ({ data: a }: { readonly data: Row }, { data: b }: { readonly data: Row }) =>
        a.name.localeCompare(b.name),
      search: { type: 'string', extractValue: (item: Row) => item.name },
    },
  ] as const;

  const searchText = '';
  const setSearchText = vi.fn();

  it("renders the caller's items through the caller's properties", async () => {
    const { findByText, findAll } = await render(
      <ControlledTable
        items={rows}
        countLabelPrefix="Found"
        minCountLabelWidth="3rem"
        headerRowHeight={30}
        rowHeight={30}
        properties={[...properties]}
        getExportedTableFilename={() => 'items.csv'}
        searchText={searchText}
        setSearchText={setSearchText}
      />,
    );

    expect(findByText('alpha')).toBeDefined();
    expect(findAll('th')).toHaveLength(1);
  });

  it('filters its own rows by the search text it was given, and does not own it', async () => {
    const { findByText, findAll, update } = await render(
      <ControlledTable
        items={rows}
        countLabelPrefix="Found"
        minCountLabelWidth="3rem"
        headerRowHeight={30}
        rowHeight={30}
        properties={[...properties]}
        getExportedTableFilename={() => 'items.csv'}
        searchText={''}
        setSearchText={setSearchText}
      />,
    );

    expect(findAll('tbody tr').length).toBeGreaterThanOrEqual(2);

    await update(
      <ControlledTable
        items={rows}
        countLabelPrefix="Found"
        minCountLabelWidth="3rem"
        headerRowHeight={30}
        rowHeight={30}
        properties={[...properties]}
        getExportedTableFilename={() => 'items.csv'}
        searchText="bet"
        setSearchText={setSearchText}
      />,
    );

    expect(findByText('beta')).toBeDefined();
    expect(document.body.textContent).not.toContain('alpha');
  });
});

describe('FilterableTable', () => {
  it('holds its own search text, which is the difference from the controlled one', async () => {
    const { findByText } = await render(
      <FilterableTable
        items={rows}
        countLabelPrefix="Found"
        minCountLabelWidth="3rem"
        headerRowHeight={30}
        rowHeight={30}
        properties={[
          {
            id: 'name',
            title: 'Name',
            width: 200,
            minWidth: 40,
            cell: ({ data }: { readonly data: Row }) => <span>{data.name}</span>,
            comparator: (
              { data: a }: { readonly data: Row },
              { data: b }: { readonly data: Row },
            ) => a.name.localeCompare(b.name),
            search: { type: 'string', extractValue: (item: Row) => item.name },
          },
        ]}
        getExportedTableFilename={() => 'items.csv'}
      />,
    );

    expect(findByText('alpha')).toBeDefined();
  });

  it('calls onScroll when its scrolling element is scrolled', async () => {
    const onScroll = vi.fn();
    const { container } = await render(
      <FilterableTable
        items={rows}
        countLabelPrefix="Found"
        minCountLabelWidth="3rem"
        headerRowHeight={30}
        rowHeight={30}
        properties={[
          {
            id: 'name',
            title: 'Name',
            width: 200,
            minWidth: 40,
            cell: ({ data }: { readonly data: Row }) => <span>{data.name}</span>,
            comparator: (
              { data: a }: { readonly data: Row },
              { data: b }: { readonly data: Row },
            ) => a.name.localeCompare(b.name),
            search: { type: 'string', extractValue: (item: Row) => item.name },
          },
        ]}
        getExportedTableFilename={() => 'items.csv'}
        onScroll={onScroll}
      />,
    );

    const scrollContainer = container.querySelector('table')?.parentElement;

    expect(scrollContainer).not.toBeNull();

    act(() => {
      scrollContainer?.dispatchEvent(new Event('scroll', { bubbles: true }));
    });

    expect(onScroll).toHaveBeenCalled();
  });
});
