// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
  buildFilterableTableSearchText,
  type SearchSchema,
  useFilteredItems,
} from '@/components/tables/use_filtered_items';
import { render } from '@/util/testing/render';

interface FilterRow {
  readonly id: string;
  readonly name: string;
  readonly note: string;
  readonly count: number;
  readonly mask: number;
  readonly active: boolean;
  readonly status: string;
  readonly seen: number;
  readonly address: string;
}

const rows: FilterRow[] = [
  {
    id: 'a',
    name: 'alpha',
    note: 'note-a',
    count: 5,
    mask: 255,
    active: true,
    status: 'ok',
    seen: new Date(2020, 0, 2, 15, 4, 5).getTime(),
    address: '10.0.0.1',
  },
  {
    id: 'b',
    name: 'beta',
    note: 'note-b',
    count: 10,
    mask: 16,
    active: false,
    status: 'new',
    seen: new Date(2020, 2, 4, 15, 4, 5).getTime(),
    address: '10.0.0.2',
  },
  {
    id: 'c',
    name: 'a b',
    note: 'note-c',
    count: 0,
    mask: 0,
    active: true,
    status: 'ok',
    seen: new Date(2020, 0, 2, 15, 4, 5).getTime(),
    address: '10.0.0.3',
  },
];

const schema: SearchSchema<FilterRow> = {
  properties: [
    { name: 'name', label: 'Name', type: 'string', trim: true, extractValue: (item) => item.name },
    { name: 'note', label: 'Note', type: 'string', extractValue: (item) => item.note },
    {
      name: 'count',
      label: 'Count',
      type: 'decimalInteger',
      min: 0,
      max: 10,
      extractValue: (item) => item.count,
    },
    {
      name: 'unbounded',
      label: 'Unbounded',
      type: 'decimalInteger',
      extractValue: (item) => item.count,
    },
    {
      name: 'mask',
      label: 'Mask',
      type: 'unsignedHex',
      min: 0,
      max: 255,
      extractValue: (item) => item.mask,
    },
    {
      name: 'maskFree',
      label: 'Mask free',
      type: 'unsignedHex',
      extractValue: (item) => item.mask,
    },
    { name: 'active', label: 'Active', type: 'boolean', extractValue: (item) => item.active },
    {
      name: 'status',
      label: 'Status',
      type: 'enum',
      extractValue: (item) => item.status,
      options: [{ value: 'ok', label: 'Working' }],
    },
    { name: 'seen', label: 'Seen', type: 'dateAndTime', extractValue: (item) => item.seen },
    { name: 'address', label: 'Address', type: 'ip', extractValue: (item) => item.address },
  ],
};

function FilteredList({ searchText }: { readonly searchText: string }) {
  const filtered = useFilteredItems({ items: rows, searchText, searchSchema: schema });

  return (
    <ul>
      {filtered.map((item) => (
        <li key={item.id}>{item.id}</li>
      ))}
    </ul>
  );
}

async function idsFor(searchText: string): Promise<(string | null)[]> {
  const { container } = await render(<FilteredList searchText={searchText} />);

  return [...container.querySelectorAll('li')].map((item) => item.textContent);
}

describe('useFilteredItems', () => {
  it('returns every item for an empty or whitespace-only search', async () => {
    expect(await idsFor('')).toEqual(['a', 'b', 'c']);
    expect(await idsFor('   ')).toEqual(['a', 'b', 'c']);
  });

  it('fuzzy-matches free text across every property', async () => {
    expect(await idsFor('alp')).toEqual(['a']);
  });

  it('narrows on a named string property, and escapes a value holding a space', async () => {
    expect(await idsFor('name=alpha')).toEqual(['a']);
    expect(await idsFor('name=a\\ b')).toEqual(['c']);
  });

  it('drops a term whose named value is empty and treats it as free text', async () => {
    expect(await idsFor('name=')).toEqual([]);
  });

  it('matches a string property that is not trimmed on the exact text typed', async () => {
    expect(await idsFor('note=note-b')).toEqual(['b']);
  });

  it('compares a decimal property as a number and clamps it to the declared range', async () => {
    expect(await idsFor('count=5')).toEqual(['a']);
    expect(await idsFor('count=999')).toEqual(['b']);
    expect(await idsFor('count=-3')).toEqual(['c']);
    expect(await idsFor('count=abc')).toEqual(['c']);
  });

  it('leaves a decimal property with no range unbounded', async () => {
    expect(await idsFor('unbounded=5')).toEqual(['a']);
    expect(await idsFor('unbounded=-5')).toEqual([]);
  });

  it('reads a hex property and clamps it to the declared range', async () => {
    expect(await idsFor('mask=ff')).toEqual(['a']);
    expect(await idsFor('mask=1000')).toEqual(['a']);
    expect(await idsFor('mask=0')).toEqual(['c']);
  });

  it('leaves a hex property with no range unbounded', async () => {
    expect(await idsFor('maskFree=ff')).toEqual(['a']);
    expect(await idsFor('maskFree=1000')).toEqual([]);
  });

  it('reads a boolean property only from true or false', async () => {
    expect(await idsFor('active=true')).toEqual(['a', 'c']);
    expect(await idsFor('active=false')).toEqual(['b']);
    expect(await idsFor('active=maybe')).toEqual([]);
  });

  it('matches an enum property on its label and falls back to the raw value', async () => {
    expect(await idsFor('status=working')).toEqual(['a', 'c']);
    expect(await idsFor('status=new')).toEqual(['b']);
  });

  it('matches a date property on its formatted text', async () => {
    expect(await idsFor('seen=01/02/2020')).toEqual(['a', 'c']);
  });

  it('matches an ip property after dropping separators the operator did not type', async () => {
    expect(await idsFor('address=10.0.0.2')).toEqual(['b']);
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
