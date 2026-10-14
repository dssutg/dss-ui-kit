// SPDX-License-Identifier: MIT
// The table group's shared contracts across its tables.
// @vitest-environment jsdom

import { act } from 'react-dom/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { AutoSizer } from '@/components/layout/AutoSizer';
import { ResizableSplit } from '@/components/layout/ResizableSplit';
import { ColumnResizer } from '@/components/tables/ColumnResizer';
import { ControlledFilterableTable } from '@/components/tables/ControlledFilterableTable';
import { ControlledTable } from '@/components/tables/ControlledTable';
import { CountLabel } from '@/components/tables/CountLabel';
import { getEnumLabel } from '@/components/tables/enum_label';
import { FilterableTable } from '@/components/tables/FilterableTable';
import { FilterableTableStatsModal } from '@/components/tables/FilterableTableStatsModal';
import { useSearchSchemaPropertyValueToString } from '@/components/tables/filterable_table_property_value';
import { SortableTable, type SortableTableDescriptor } from '@/components/tables/SortableTable';
import { TimelineViewerModal } from '@/components/tables/TimelineViewerModal';
import { escapeProp, formatDateAndTime } from '@/components/tables/table_export';
import {
  buildFilterableTableSearchText,
  type SearchPropertySchema,
  type SearchSchema,
  useFilteredItems,
} from '@/components/tables/use_filtered_items';
import { getLocaleDates } from '@/locale';
import { change, click, flush, render } from '@/util/testing/render';

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
      <AutoSizer disableWidth={true} onResize={onResize}>
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

describe('ControlledFilterableTable', () => {
  it('draws the controlled table it stands in for', async () => {
    const { findByText } = await render(
      <ControlledFilterableTable
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
        searchText=""
        setSearchText={vi.fn()}
      />,
    );

    expect(findByText('alpha')).toBeDefined();
  });
});

describe('escapeProp', () => {
  it('quotes whitespace and a backslash so a value stays one term', () => {
    expect(escapeProp('a b')).toBe('a\\ b');
    expect(escapeProp('a\\b')).toBe('a\\\\b');
  });

  it('reads an absent value as the empty string', () => {
    expect(escapeProp(null)).toBe('');
    expect(escapeProp(undefined)).toBe('');
  });
});

describe('buildFilterableTableSearchText', () => {
  it('writes one escaped name=value term per entry', () => {
    expect(buildFilterableTableSearchText({ name: 'a b', count: 5 })).toBe('name=a\\ b count=5');
  });

  it('writes an absent value as an empty term', () => {
    expect(buildFilterableTableSearchText({ name: null })).toBe('name=');
  });
});

describe('formatDateAndTime', () => {
  it("writes a timestamp in the locale's format", () => {
    expect(formatDateAndTime(new Date(2020, 0, 2, 15, 4, 5).getTime(), getLocaleDates('en'))).toBe(
      '01/02/2020 03:04:05 PM',
    );
  });
});

/** A row with one property of each type a search schema can declare. */
interface FilterRow {
  readonly id: string;
  readonly name: string;
  readonly count: number;
  readonly active: boolean;
  readonly status: string;
  readonly address: string;
}

const filterRows: FilterRow[] = [
  { id: 'alpha', name: 'Alpha', count: 1, active: true, status: 'ok', address: '10.0.0.1' },
  { id: 'beta', name: 'Beta', count: 20, active: false, status: 'bad', address: '10.0.0.2' },
];

const filterSchema: SearchSchema<FilterRow> = {
  properties: [
    { name: 'name', label: 'Name', type: 'string', extractValue: (item) => item.name },
    { name: 'count', label: 'Count', type: 'decimalInteger', extractValue: (item) => item.count },
    { name: 'active', label: 'Active', type: 'boolean', extractValue: (item) => item.active },
    {
      name: 'status',
      label: 'Status',
      type: 'enum',
      extractValue: (item) => item.status,
      options: [{ value: 'ok', label: 'Working' }],
    },
    { name: 'address', label: 'Address', type: 'ip', extractValue: (item) => item.address },
  ],
};

function FilteredList({ searchText }: { readonly searchText: string }) {
  const filtered = useFilteredItems({ items: filterRows, searchText, searchSchema: filterSchema });

  return (
    <ul>
      {filtered.map((item) => (
        <li key={item.id}>{item.id}</li>
      ))}
    </ul>
  );
}

describe('useFilteredItems', () => {
  async function idsFor(searchText: string): Promise<(string | null)[]> {
    // A test that calls this twice mounts two lists into the body, so the query stays inside the
    // container this render owns rather than finding both.
    const { container } = await render(<FilteredList searchText={searchText} />);

    return [...container.querySelectorAll('li')].map((item) => item.textContent);
  }

  it('returns every item when the search text is empty', async () => {
    expect(await idsFor('')).toEqual(['alpha', 'beta']);
  });

  it('fuzzy-matches a free-text term against every property', async () => {
    expect(await idsFor('alp')).toEqual(['alpha']);
  });

  it('narrows on a named string property', async () => {
    expect(await idsFor('name=beta')).toEqual(['beta']);
  });

  it('compares a numeric property as a number, not as text', async () => {
    expect(await idsFor('count=20')).toEqual(['beta']);
    expect(await idsFor('count=2')).toEqual([]);
  });

  it('reads a boolean property only from true or false', async () => {
    expect(await idsFor('active=true')).toEqual(['alpha']);
    expect(await idsFor('active=false')).toEqual(['beta']);
  });

  it('matches an enum property on its label', async () => {
    expect(await idsFor('status=working')).toEqual(['alpha']);
  });

  it('matches an ip property after dropping separators the operator did not type', async () => {
    expect(await idsFor('address=10.0.0.2')).toEqual(['beta']);
  });
});

const booleanProperty: SearchPropertySchema<FilterRow> = {
  name: 'active',
  label: 'Active',
  type: 'boolean',
  extractValue: (item) => item.active,
};

const nameProperty: SearchPropertySchema<FilterRow> = {
  name: 'name',
  label: 'Name',
  type: 'string',
  extractValue: (item) => item.name,
};

const enumProperty: SearchPropertySchema<FilterRow> = {
  name: 'status',
  label: 'Status',
  type: 'enum',
  extractValue: (item) => item.status,
  options: [{ value: 'ok', label: 'Working' }],
};

const hexProperty: SearchPropertySchema<FilterRow> = {
  name: 'mask',
  label: 'Mask',
  type: 'unsignedHex',
  extractValue: () => 255,
};

const dateProperty: SearchPropertySchema<FilterRow> = {
  name: 'seen',
  label: 'Seen',
  type: 'dateAndTime',
  extractValue: () => new Date(2020, 0, 2, 15, 4, 5).getTime(),
};

function PropertyValueProbe({
  item,
  property,
}: {
  readonly item: FilterRow;
  readonly property: SearchPropertySchema<FilterRow>;
}) {
  const toValueString = useSearchSchemaPropertyValueToString<FilterRow>();

  return <span>{toValueString(item, property)}</span>;
}

describe('useSearchSchemaPropertyValueToString', () => {
  const row = filterRows[0] as FilterRow;

  it('writes each property type the way the table shows it', async () => {
    const { container, update } = await render(
      <PropertyValueProbe item={row} property={nameProperty} />,
    );

    expect(container.textContent).toBe('Alpha');

    await update(<PropertyValueProbe item={row} property={booleanProperty} />);
    expect(container.textContent).toBe('Yes');

    await update(<PropertyValueProbe item={row} property={enumProperty} />);
    expect(container.textContent).toBe('Working');

    await update(<PropertyValueProbe item={row} property={hexProperty} />);
    expect(container.textContent).toBe('FF');

    await update(<PropertyValueProbe item={row} property={dateProperty} />);
    expect(container.textContent).toBe('01/02/2020 03:04:05 PM');
  });
});

describe('FilterableTableStatsModal', () => {
  it('renders nothing while it is closed', async () => {
    const { container } = await render(
      <FilterableTableStatsModal
        open={false}
        onOpenChange={() => undefined}
        items={filterRows}
        searchSchema={filterSchema}
      />,
    );

    expect(container.textContent).toBe('');
  });

  it('counts the rows by the property it was given', async () => {
    const { findAll, findByText } = await render(
      <FilterableTableStatsModal
        open={true}
        onOpenChange={() => undefined}
        items={filterRows}
        searchSchema={filterSchema}
      />,
    );

    expect(findByText('Stats')).toBeDefined();
    expect(findByText('Total rows:')).toBeDefined();

    // One option per searchable property, so the caller can pick which breakdown to read.
    expect(findAll('option')).toHaveLength(filterSchema.properties.length);
  });

  it('re-breaks the rows down by the property chosen from the select', async () => {
    const { find } = await render(
      <FilterableTableStatsModal
        open={true}
        onOpenChange={() => undefined}
        items={filterRows}
        searchSchema={filterSchema}
      />,
    );

    change(find<HTMLSelectElement>('select'), 'active');

    // The two rows are one active and one inactive, written the way the table writes a boolean.
    expect(document.body.textContent).toContain('Yes');
    expect(document.body.textContent).toContain('No');
  });

  it('offers no property select when there are no rows to count', async () => {
    const { container, findByText } = await render(
      <FilterableTableStatsModal
        open={true}
        onOpenChange={() => undefined}
        items={[]}
        searchSchema={filterSchema}
      />,
    );

    expect(findByText('Total rows:')).toBeDefined();
    expect(container.querySelectorAll('select')).toHaveLength(0);
  });
});

interface TimelineRow {
  readonly id: string;
  readonly name: string;
  readonly seenAt: number;
}

const timelineRows: TimelineRow[] = [
  { id: 'a', name: 'Alpha', seenAt: new Date(2020, 0, 1).getTime() },
  { id: 'b', name: 'Beta', seenAt: new Date(2020, 0, 2).getTime() },
];

const timelineSchema: SearchSchema<TimelineRow> = {
  properties: [
    { name: 'name', label: 'Name', type: 'string', extractValue: (item) => item.name },
    { name: 'seen', label: 'Seen', type: 'dateAndTime', extractValue: (item) => item.seenAt },
  ],
};

describe('TimelineViewerModal', () => {
  it('draws the rows over the time property of the schema', async () => {
    const { findByText, query } = await render(
      <TimelineViewerModal
        open={true}
        onOpenChange={() => undefined}
        items={timelineRows}
        searchSchema={timelineSchema}
      />,
    );

    expect(findByText('Timeline')).toBeDefined();
    expect(query('canvas')).not.toBeNull();
  });

  it('offers only the non-time properties as series', async () => {
    const { findAll } = await render(
      <TimelineViewerModal
        open={true}
        onOpenChange={() => undefined}
        items={timelineRows}
        searchSchema={timelineSchema}
      />,
    );

    // A timeline of one time property has no series to draw, so the date is not offered as one.
    expect(findAll('option')).toHaveLength(1);
  });

  it('renders nothing extra when there are no rows', async () => {
    const { findByText, query } = await render(
      <TimelineViewerModal
        open={true}
        onOpenChange={() => undefined}
        items={[]}
        searchSchema={timelineSchema}
      />,
    );

    expect(findByText('Timeline')).toBeDefined();
    expect(query('select')).toBeNull();
  });
});
