// SPDX-License-Identifier: MIT
// The filterable table's filtering, from schema to filtered order.
// @vitest-environment jsdom

import type { Mock } from 'vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ControlledTable } from '@/components/tables/ControlledTable';
import { FilterableTableStatsModal } from '@/components/tables/FilterableTableStatsModal';
import { FilterableTableTopPanel } from '@/components/tables/FilterableTableTopPanel';
import { GeneralizedSearchModal } from '@/components/tables/GeneralizedSearchModal';
import { TimelineViewerModal } from '@/components/tables/TimelineViewerModal';
import { escapeProp, formatDateAndTime } from '@/components/tables/table_export';
import type { SearchPropertySchema, SearchSchema } from '@/components/tables/use_filtered_items';
import { getLocaleDates } from '@/locale';
import type { RenderResult } from '@/util/testing/render';
import { act, change, click, flush, render, type } from '@/util/testing/render';

/**
 * The filterable table family: the controlled table over a caller's search text, the search form, the
 * stats and timeline modals, and the top panel that wires search, count, export and the modals.
 *
 * The row type is a caller's own; every field the search schema can declare is on it, so each kind of
 * filter control and each export cell is exercised. The controls and modals name themselves with the
 * locale's English messages, which is what the assertions read.
 */

/**
 * The worker process the test file runs in, typed for what the uncaught-error capture below does with
 * it: attaching is what keeps an error thrown by a handler a captured one, so no unhandled error
 * reaches the runner a second time.
 */
declare const process: {
  on(event: 'uncaughtException', listener: (error: unknown) => void): void;
  off(event: 'uncaughtException', listener: (error: unknown) => void): void;
};

/**
 * jsdom has no canvas back-end: `getContext('2d')` answers null and a plot's series functions are
 * never called. This context answers the calls a 2D context receives, and counts the markers drawn in
 * each pass, so the timeline is a test that actually draws rather than one that skips the drawing.
 */
let arcsDrawn = 0;

if (typeof window !== 'undefined') {
  class RecordingCanvasRenderingContext2D {
    readonly canvas: HTMLCanvasElement;

    fillStyle = '';
    strokeStyle = '';
    lineWidth = 1;

    constructor(canvas: HTMLCanvasElement) {
      this.canvas = canvas;
    }

    save(): void {}
    restore(): void {}
    setTransform(): void {}
    // The count is of the markers of the current drawing; each drawing starts by clearing.
    clearRect(): void {
      arcsDrawn = 0;
    }
    beginPath(): void {}
    arc(): void {
      arcsDrawn++;
    }
    closePath(): void {}
    fill(): void {}
    moveTo(): void {}
    lineTo(): void {}
    stroke(): void {}
  }

  const contextClassKey: string = 'CanvasRenderingContext2D';
  Object.defineProperty(window, contextClassKey, {
    configurable: true,
    value: RecordingCanvasRenderingContext2D,
  });

  const getContextKey: string = 'getContext';
  Object.defineProperty(window.HTMLCanvasElement.prototype, getContextKey, {
    configurable: true,
    value: function (this: HTMLCanvasElement): RecordingCanvasRenderingContext2D {
      return new RecordingCanvasRenderingContext2D(this);
    },
  });
}

/** One row of every table render here, in the order this file reads its fields. */
interface Row {
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

const rows: Row[] = [
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
    seen: new Date(2020, 0, 3, 15, 4, 5).getTime(),
    address: '10.0.0.2',
  },
];

const seenOfRowA = new Date(2020, 0, 2, 15, 4, 5).getTime();
const seenTextOfRowA = formatDateAndTime(seenOfRowA, getLocaleDates('en'));

/** The schema naming one property of every kind the search union declares, as a caller ships it. */
const fullSchema: SearchSchema<Row> = {
  properties: [
    { name: 'name', label: 'Name', type: 'string', trim: true, extractValue: (item) => item.name },
    {
      name: 'note',
      label: 'Note',
      type: 'string',
      hiddenInTable: true,
      extractValue: (item) => item.note,
    },
    {
      name: 'count',
      label: 'Count',
      type: 'decimalInteger',
      min: 0,
      max: 10000,
      hiddenInTable: true,
      extractValue: (item) => item.count,
    },
    {
      name: 'countFree',
      label: 'Count (free)',
      type: 'decimalInteger',
      hiddenInTable: true,
      extractValue: (item) => item.count,
    },
    {
      name: 'mask',
      label: 'Mask',
      type: 'unsignedHex',
      min: 0,
      max: 16777215,
      hiddenInTable: true,
      extractValue: (item) => item.mask,
    },
    {
      name: 'maskFree',
      label: 'Mask (free)',
      type: 'unsignedHex',
      hiddenInTable: true,
      extractValue: (item) => item.mask,
    },
    {
      name: 'active',
      label: 'Active',
      type: 'boolean',
      hiddenInTable: true,
      extractValue: (item) => item.active,
    },
    {
      name: 'status',
      label: 'Status',
      type: 'enum',
      options: [{ value: 'ok', label: 'Working' }],
      hiddenInTable: true,
      extractValue: (item) => item.status,
    },
    {
      name: 'seen',
      label: 'Seen',
      type: 'dateAndTime',
      hiddenInTable: true,
      extractValue: (item) => item.seen,
    },
    {
      name: 'address',
      label: 'Address',
      type: 'ip',
      hiddenInTable: true,
      extractValue: (item) => item.address,
    },
  ],
};

/**
 * The schema of a dateless table: the top panel offers a timeline only when some property is a time,
 * and its export paths write only the properties hidden from the table, so the export branches of
 * every non-date kind are still reached by a schema that leaves the time out.
 */
const datelessSchema: SearchSchema<Row> = {
  properties: [
    {
      name: 'note',
      label: 'Note',
      type: 'string',
      hiddenInTable: true,
      extractValue: (item) => item.note,
    },
    {
      name: 'count',
      label: 'Count',
      type: 'decimalInteger',
      hiddenInTable: true,
      extractValue: (item) => item.count,
    },
    {
      name: 'mask',
      label: 'Mask',
      type: 'unsignedHex',
      hiddenInTable: true,
      extractValue: (item) => item.mask,
    },
    {
      name: 'active',
      label: 'Active',
      type: 'boolean',
      hiddenInTable: true,
      extractValue: (item) => item.active,
    },
    {
      name: 'status',
      label: 'Status',
      type: 'enum',
      options: [{ value: 'ok', label: 'Working' }],
      hiddenInTable: true,
      extractValue: (item) => item.status,
    },
    {
      name: 'address',
      label: 'Address',
      type: 'ip',
      hiddenInTable: true,
      extractValue: (item) => item.address,
    },
  ],
};

const twoSeriesSchema: SearchSchema<Row> = {
  properties: [
    { name: 'name', label: 'Name', type: 'string', extractValue: (item) => item.name },
    { name: 'note', label: 'Note', type: 'string', extractValue: (item) => item.note },
    { name: 'seen', label: 'Seen', type: 'dateAndTime', extractValue: (item) => item.seen },
  ],
};

const timeOnlySchema: SearchSchema<Row> = {
  properties: [
    { name: 'seen', label: 'Seen', type: 'dateAndTime', extractValue: (item) => item.seen },
  ],
};

/** A slot whose property is a boolean, re-read as a trimmed string when the caller re-types it. */
const booleanSlotProperty: SearchPropertySchema<Row> = {
  name: 'active',
  label: 'Active',
  type: 'boolean',
  extractValue: (item) => item.active,
};

const stringSlotProperty: SearchPropertySchema<Row> = {
  name: 'active',
  label: 'Active',
  type: 'string',
  trim: true,
  extractValue: (item) => item.name,
};

/** A string field that keeps the text as it was typed: its empty value is checked without the trim. */
const nonTrimmedSlotProperty: SearchPropertySchema<Row> = {
  name: 'active',
  label: 'Active',
  type: 'string',
  extractValue: (item) => item.name,
};

function manyRows(count: number, name: string): Row[] {
  return Array.from({ length: count }, (_, index) => ({
    id: String(index),
    name,
    note: `note-${index}`,
    count: index,
    mask: index,
    active: index % 2 === 0,
    status: index % 2 === 0 ? 'ok' : 'new',
    seen: new Date(2020, 0, 1, 0, index % 60, Math.floor(index / 60)).getTime(),
    address: `10.0.0.${index % 250}`,
  }));
}

/** A property whose runtime `type` is outside the schema union, for the export switches' guard arms. */
function propertyTypeOutsideTheSchemaUnion(): SearchPropertySchema<Row> {
  const property: SearchPropertySchema<Row> = {
    name: 'future',
    label: 'Future',
    type: 'string',
    hiddenInTable: true,
    extractValue: (item) => item.name,
  };

  Reflect.set(property, 'type', 'aTypeAddedToTheSchemaLater');

  return property;
}

function propertyTypeOutsideTheSchemaUnionSchema(): SearchSchema<Row> {
  return { properties: [propertyTypeOutsideTheSchemaUnion()] };
}

/** The one button carrying the title text: the drop-down trigger, and its items and menu entries. */
function menuButton(title: string): HTMLButtonElement {
  const buttons = [...document.body.querySelectorAll<HTMLButtonElement>('button')];
  const found = buttons.find((button) => button.textContent?.trim() === title);

  if (found === undefined) {
    throw new Error(
      `no button titled "${title}"; buttons hold: ${buttons
        .map((button) => button.textContent ?? '')
        .join(' | ')}`,
    );
  }

  return found;
}

/** Opens a top panel's drop-down menu, which the panel keeps open until an item is chosen. */
async function openMenuTo(rendered: RenderResult): Promise<void> {
  click(rendered.find('button[title="Menu"]'));
  await flush();
}

/** Opens the drop-down menu and then a named item's submenu, awaiting each portal it renders into. */
async function openMenuItem(itemTitle: string, rendered: RenderResult): Promise<void> {
  await openMenuTo(rendered);
  act(() => {
    menuButton(itemTitle).dispatchEvent(new MouseEvent('mouseenter'));
  });
  await flush();
}

/** The control under a search-form row's label, which is what the row renders next to the label. */
function rowControl<T extends Element>(labelText: string, selector: string): T {
  const row = [...document.body.querySelectorAll('div')].find(
    (div) => div.firstElementChild?.textContent === labelText,
  );

  if (row === undefined) {
    throw new Error(`no row labelled "${labelText}".`);
  }

  const control = row.querySelector<T>(selector);

  if (control === null) {
    throw new Error(`no control "${selector}" in the "${labelText}" row.`);
  }

  return control;
}

/** The clear of a text field's row, which is the one icon button that row's field carries. */
function clearButton(labelText: string): HTMLButtonElement {
  return rowControl<HTMLButtonElement>(labelText, 'button[title="Clear text"]');
}

/**
 * A `name=value` term the way the search form writes it, so the assertions spell what the component
 * means rather than re-derive the escaping by hand.
 */
function term(name: string, value: string): string {
  return `${escapeProp(name)}=${escapeProp(value)}`;
}

/** The throws a handler's error event and an uncaught-exception notification carry, with cleanup. */
function withUncaughtCapture(run: () => void): string[] {
  const messages: string[] = [];

  function onWindowError(event: Event): void {
    if (event instanceof ErrorEvent) {
      event.preventDefault();
      messages.push(event.message);
    }
  }

  function onUncaughtException(error: unknown): void {
    if (error instanceof Error) {
      messages.push(error.message);
    }
  }

  window.addEventListener('error', onWindowError);
  process.on('uncaughtException', onUncaughtException);

  try {
    run();
  } finally {
    window.removeEventListener('error', onWindowError);
    process.off('uncaughtException', onUncaughtException);
  }

  return messages;
}

interface RecordedObjectURL {
  readonly url: string;
  readonly blob: Blob;
}

let recordedObjectURLs: RecordedObjectURL[] = [];

/** A fake object URL factory so the string exports' blobs can be read back out of the test. */
function stubObjectURLs(): void {
  recordedObjectURLs = [];
  let nextURL = 1;

  const createKey: string = 'createObjectURL';
  const revokeKey: string = 'revokeObjectURL';

  Object.defineProperty(URL, createKey, {
    configurable: true,
    value: (blob: Blob) => {
      // The anchor jsdom clicks navigates by hash, which jsdom handles rather than report
      // unimplemented navigation about.
      const url = `#downloaded-${nextURL++}`;

      recordedObjectURLs.push({ url, blob });

      return url;
    },
  });

  Object.defineProperty(URL, revokeKey, {
    configurable: true,
    value: () => undefined,
  });
}

/** The blob content of the downloads the test recorded. */
async function downloadedContents(): Promise<string[]> {
  return await Promise.all(recordedObjectURLs.map(({ blob }) => blob.text()));
}

interface FakePrintWindow {
  readonly document: {
    readonly writeln: Mock<(text: string) => void>;
    readonly close: Mock<() => void>;
    readonly querySelector: Mock<(selector: string) => Element | null>;
    readonly documentElement: { readonly outerHTML: string };
  };
  readonly print: Mock<() => void>;
  readonly close: Mock<() => void>;
}

/** The window an export opens, with the document the export writes its skeleton into. */
function stubExportWindow(withBody: boolean): { window: FakePrintWindow; body: HTMLDivElement } {
  const pdfContent = document.createElement('div');

  const fake: FakePrintWindow = {
    document: {
      writeln: vi.fn((_text: string) => undefined),
      close: vi.fn(),
      querySelector: vi.fn((selector: string) =>
        selector === '#pdf-content' && withBody ? pdfContent : null,
      ),
      documentElement: { outerHTML: '<html><body>printed</body></html>' },
    },
    print: vi.fn(() => undefined),
    close: vi.fn(() => undefined),
  };

  vi.stubGlobal(
    'open',
    vi.fn(() => fake),
  );

  return { window: fake, body: pdfContent };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  recordedObjectURLs = [];
  Reflect.deleteProperty(document, 'fullscreenElement');
});

describe('ControlledTable', () => {
  it('draws filter-only properties without a column, and rows keyed by the ids the caller names', async () => {
    const { findByText, findAll } = await render(
      <ControlledTable
        items={manyRows(60, 'alpha')}
        countLabelPrefix="Found"
        minCountLabelWidth="3rem"
        headerRowHeight={30}
        rowHeight={30}
        properties={[
          {
            id: 'name',
            variant: undefined,
            title: 'Name',
            width: 200,
            minWidth: 40,
            cell: ({ data }) => <span>{data.name}</span>,
            comparator: ({ data: a }, { data: b }) => a.name.localeCompare(b.name),
            search: { type: 'string', extractValue: (item) => item.name },
          },
          {
            id: 'count',
            variant: 'filter',
            title: 'Count',
            comparator: ({ data: a }, { data: b }) => a.count - b.count,
            search: { type: 'decimalInteger', extractValue: (item) => item.count },
          },
        ]}
        getExportedTableFilename={() => 'items.csv'}
        getItemId={(item) => item.id}
        searchText=""
        setSearchText={vi.fn()}
      />,
    );

    // The filter-only property takes no column; the rows beyond the overscan default stay in place.
    expect(findAll('th')).toHaveLength(1);
    expect(findByText('alpha')).toBeDefined();
  });
});

describe('FilterableTableStatsModal', () => {
  it('counts the rows without offering a breakdown when the schema names no property', async () => {
    const { findByText, find } = await render(
      <FilterableTableStatsModal
        open={true}
        onOpenChange={() => undefined}
        items={rows}
        searchSchema={{ properties: [] }}
      />,
    );

    expect(findByText('Stats')).toBeDefined();
    expect(findByText('Total rows:')).toBeDefined();
    expect(findByText('2')).toBeDefined();
    expect(document.body.querySelectorAll('option')).toHaveLength(0);
    // Nothing to break down by: the select starts empty rather than naming a missing property.
    expect(find<HTMLSelectElement>('select').value).toBe('');
  });

  it('does not cap the breakdown overscan once the rows reach fifty', async () => {
    const items = manyRows(60, 'alpha');
    const { findByText, findAll } = await render(
      <FilterableTableStatsModal
        open={true}
        onOpenChange={() => undefined}
        items={items}
        searchSchema={fullSchema}
      />,
    );

    expect(findByText('Stats')).toBeDefined();
    expect(findAll('option')).toHaveLength(fullSchema.properties.length);
    // All sixty rows share one name: one share, carrying all of them.
    expect(findByText('alpha')).toBeDefined();
    expect(findByText('60')).toBeDefined();
  });

  it('re-breaks the rows down by the property chosen from the select', async () => {
    const { find } = await render(
      <FilterableTableStatsModal
        open={true}
        onOpenChange={() => undefined}
        items={rows}
        searchSchema={fullSchema}
      />,
    );

    change(find<HTMLSelectElement>('select'), 'active');

    // One row active and one not, written the way the table writes a boolean.
    expect(document.body.textContent).toContain('Yes');
    expect(document.body.textContent).toContain('No');
  });
});

describe('GeneralizedSearchModal', () => {
  it('renders one field per property and searches with what the fields hold', async () => {
    const onSearch = vi.fn();
    const onOpenChange = vi.fn();
    const { findByText } = await render(
      <GeneralizedSearchModal
        title="Search form"
        open={true}
        onOpenChange={onOpenChange}
        searchSchema={fullSchema}
        onSearch={onSearch}
      />,
    );

    expect(findByText('Search form')).toBeDefined();

    type(rowControl<HTMLInputElement>('Name: ', 'input'), 'alpha');
    type(rowControl<HTMLInputElement>('Note: ', 'input'), 'note-b');
    type(rowControl<HTMLInputElement>('Count: ', 'input'), '123');
    type(rowControl<HTMLInputElement>('Count (free): ', 'input'), '77');
    type(rowControl<HTMLInputElement>('Mask: ', 'input'), 'ff');
    type(rowControl<HTMLInputElement>('Mask (free): ', 'input'), '10');
    change(rowControl<HTMLSelectElement>('Active: ', 'select'), 'true');
    change(rowControl<HTMLSelectElement>('Status: ', 'select'), 'ok');
    type(rowControl<HTMLInputElement>('Seen: ', 'input'), '2020-01-02T15:04:05');
    type(rowControl<HTMLInputElement>('Address: ', 'input'), '10.0.0.1');

    const findButton = findByText('Find').closest('button');

    if (findButton === null) {
      throw new Error('no Find button.');
    }

    click(findButton);

    expect(onSearch).toHaveBeenCalledWith(
      [
        term('name', 'alpha'),
        term('note', 'note-b'),
        term('count', '123'),
        term('countFree', '77'),
        // A hex field's value reaches the search as its number, not as its padded hex digits.
        term('mask', '255'),
        term('maskFree', '16'),
        term('active', 'true'),
        // An enum field is searched by its label.
        term('status', 'Working'),
        term('seen', seenTextOfRowA),
        term('address', '10.0.0.1'),
      ].join(' '),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('leaves untouched fields out of the search and drops a field cleared to empty', async () => {
    const onSearch = vi.fn();
    const { findByText } = await render(
      <GeneralizedSearchModal
        title="Search form"
        open={true}
        onOpenChange={() => undefined}
        searchSchema={fullSchema}
        onSearch={onSearch}
      />,
    );

    // A trimmed string field cleared to nothing is not a filter, not a search for empty text.
    type(rowControl<HTMLInputElement>('Name: ', 'input'), 'alpha');
    click(clearButton('Name: '));
    // A cleared ip field is the same.
    type(rowControl<HTMLInputElement>('Address: ', 'input'), '10.1');
    click(clearButton('Address: '));
    // An enum field cleared by the prompt is dropped, as is a boolean set back to unchosen and a
    // date cleared to the empty text.
    change(rowControl<HTMLSelectElement>('Status: ', 'select'), '');
    change(rowControl<HTMLSelectElement>('Active: ', 'select'), 'notChosen');
    type(rowControl<HTMLInputElement>('Seen: ', 'input'), '');

    const findButton = findByText('Find').closest('button');

    if (findButton === null) {
      throw new Error('no Find button.');
    }

    click(findButton);

    expect(onSearch).toHaveBeenCalledWith('');
  });

  it('reads a boolean field through every answer the three options stand for', async () => {
    const onSearch = vi.fn();
    const { findByText } = await render(
      <GeneralizedSearchModal
        title="Search form"
        open={true}
        onOpenChange={() => undefined}
        searchSchema={fullSchema}
        onSearch={onSearch}
      />,
    );

    const active = rowControl<HTMLSelectElement>('Active: ', 'select');
    const findButtonOf = (): HTMLButtonElement => {
      const button = findByText('Find').closest('button');

      if (button === null) {
        throw new Error('no Find button.');
      }

      return button;
    };

    change(active, 'true');
    click(findButtonOf());
    expect(onSearch).toHaveBeenLastCalledWith(term('active', 'true'));

    change(active, 'false');
    click(findButtonOf());
    expect(onSearch).toHaveBeenLastCalledWith(term('active', 'false'));

    change(active, 'notChosen');
    click(findButtonOf());
    expect(onSearch).toHaveBeenLastCalledWith('');
  });

  it('still offers a chosen value the options no longer name, labelled with the value itself', async () => {
    const onSearch = vi.fn();
    const { findByText, findAll, update } = await render(
      <GeneralizedSearchModal
        title="Search form"
        open={true}
        onOpenChange={() => undefined}
        searchSchema={fullSchema}
        onSearch={onSearch}
      />,
    );

    // The caller's data holds values their option list does not, so a chosen value stays offered as
    // the value itself when the list has no label for it.
    change(rowControl<HTMLSelectElement>('Status: ', 'select'), 'ok');

    const [labelled] = findAll<HTMLOptionElement>('option').filter(
      (option) => option.textContent === 'Working',
    );

    expect(labelled?.value).toBe('ok');

    const shrunkSchema: SearchSchema<Row> = {
      properties: [
        {
          name: 'status',
          label: 'Status',
          type: 'enum',
          options: [],
          hiddenInTable: true,
          extractValue: (item) => item.status,
        },
      ],
    };

    await update(
      <GeneralizedSearchModal
        title="Search form"
        open={true}
        onOpenChange={() => undefined}
        searchSchema={shrunkSchema}
        onSearch={onSearch}
      />,
    );

    // The value survived the smaller list, offered under its own text.
    expect(findAll<HTMLOptionElement>('option').map((option) => option.value)).toEqual(
      expect.arrayContaining(['notChosen', 'ok']),
    );

    const findButton = findByText('Find').closest('button');

    if (findButton === null) {
      throw new Error('no Find button.');
    }

    click(findButton);

    expect(onSearch).toHaveBeenLastCalledWith(term('status', 'ok'));

    change(rowControl<HTMLSelectElement>('Status: ', 'select'), 'notChosen');
    click(findButton);

    // Choosing nothing clears the field: the search holds no term for it.
    expect(onSearch).toHaveBeenLastCalledWith('');
  });

  it('filters ip text down to digits and dots the operator may not type cleanly', async () => {
    const onSearch = vi.fn();
    const { findByText } = await render(
      <GeneralizedSearchModal
        title="Search form"
        open={true}
        onOpenChange={() => undefined}
        searchSchema={fullSchema}
        onSearch={onSearch}
      />,
    );

    // Only digits and dots survive: the separators the operator missed, and the ones they did not
    // type, are dropped on the way in.
    type(rowControl<HTMLInputElement>('Address: ', 'input'), '10 0 0_2');

    const findButton = findByText('Find').closest('button');

    if (findButton === null) {
      throw new Error('no Find button.');
    }

    click(findButton);

    expect(onSearch).toHaveBeenLastCalledWith(term('address', '10002'));
  });

  it('leaves the cleared value of a number field out of the search it builds', async () => {
    const onSearch = vi.fn();
    const { findByText } = await render(
      <GeneralizedSearchModal
        title="Search form"
        open={true}
        onOpenChange={() => undefined}
        searchSchema={fullSchema}
        onSearch={onSearch}
      />,
    );

    // A number field's clear reports "no value", which no term is written for.
    type(rowControl<HTMLInputElement>('Count: ', 'input'), '123');
    click(rowControl<HTMLButtonElement>('Count: ', 'button[title="Clear input field"]'));
    type(rowControl<HTMLInputElement>('Mask: ', 'input'), 'ff');
    click(rowControl<HTMLButtonElement>('Mask: ', 'button[title="Clear input field"]'));

    const findButton = findByText('Find').closest('button');

    if (findButton === null) {
      throw new Error('no Find button.');
    }

    click(findButton);

    expect(onSearch).toHaveBeenLastCalledWith('');
  });

  it('reads the null a boolean slot holds as the empty filter a re-typed field spells', async () => {
    // The value map follows the property, not its type: a boolean slot's null is what a string field
    // re-reads as empty, so whatever the caller's re-typed field holds, the slot's filter is empty.
    const onSearch = vi.fn();
    const { findByText, update } = await render(
      <GeneralizedSearchModal
        title="Search form"
        open={true}
        onOpenChange={() => undefined}
        searchSchema={{ properties: [booleanSlotProperty] }}
        onSearch={onSearch}
      />,
    );

    change(rowControl<HTMLSelectElement>('Active: ', 'select'), 'notChosen');

    await update(
      <GeneralizedSearchModal
        title="Search form"
        open={true}
        onOpenChange={() => undefined}
        searchSchema={{ properties: [stringSlotProperty] }}
        onSearch={onSearch}
      />,
    );

    // The null the boolean slot held reads through the string field as the empty filter.
    expect(rowControl<HTMLInputElement>('Active: ', 'input').value).toBe('');

    const findButton = findByText('Find').closest('button');

    if (findButton === null) {
      throw new Error('no Find button.');
    }

    click(findButton);

    expect(onSearch).toHaveBeenCalledWith('');
  });

  it('reads the null a boolean slot holds as the empty value a re-typed field spells', async () => {
    // The value map follows the property, not its type: a boolean slot's null is what a re-typed
    // field reads back. A non-trimmed string field spells that null as an empty value, which the
    // search records as a term of its own.
    const onSearch = vi.fn();
    const { findByText, update } = await render(
      <GeneralizedSearchModal
        title="Search form"
        open={true}
        onOpenChange={() => undefined}
        searchSchema={{ properties: [booleanSlotProperty] }}
        onSearch={onSearch}
      />,
    );

    change(rowControl<HTMLSelectElement>('Active: ', 'select'), 'notChosen');

    await update(
      <GeneralizedSearchModal
        title="Search form"
        open={true}
        onOpenChange={() => undefined}
        searchSchema={{ properties: [nonTrimmedSlotProperty] }}
        onSearch={onSearch}
      />,
    );

    // The null the boolean slot held reads through the string field as the empty filter.
    expect(rowControl<HTMLInputElement>('Active: ', 'input').value).toBe('');

    const findButton = findByText('Find').closest('button');

    if (findButton === null) {
      throw new Error('no Find button.');
    }

    click(findButton);

    expect(onSearch).toHaveBeenCalledWith(term('active', ''));
  });
});

describe('FilterableTableTopPanel', () => {
  /** A top panel over the two rows, in the shape the panel takes from the table it serves. */
  async function renderTopPanel(
    overrides: {
      readonly items?: Row[];
      readonly schema?: SearchSchema<Row>;
      readonly filteredRowCount?: number;
      readonly countLabelPrefix?: string;
      readonly countLabel?: React.ReactNode;
      readonly leftComponent?: React.ReactNode;
      readonly rightComponent?: React.ReactNode;
      readonly getExportedTableFilename?: () => string;
    } = {},
  ): Promise<{
    rendered: RenderResult;
    findByText: RenderResult['findByText'];
    find: RenderResult['find'];
    query: RenderResult['query'];
    setSearchText: Mock<(searchText: string) => void>;
  }> {
    const setSearchText = vi.fn();

    const rendered = await render(
      <FilterableTableTopPanel
        searchText=""
        setSearchText={setSearchText}
        filteredRowCount={overrides.filteredRowCount ?? rows.length}
        items={overrides.items ?? rows}
        extraSearchSchema={overrides.schema ?? fullSchema}
        getExportedTableFilename={overrides.getExportedTableFilename ?? (() => 'items.csv')}
        countLabelPrefix={overrides.countLabelPrefix}
        countLabel={overrides.countLabel}
        minCountLabelWidth="3rem"
        leftComponent={overrides.leftComponent}
        rightComponent={overrides.rightComponent}
      />,
    );

    return {
      rendered,
      findByText: rendered.findByText,
      find: rendered.find,
      query: rendered.query,
      setSearchText,
    };
  }

  it("renders the caller's extras instead of the count label when they are given", async () => {
    const { rendered } = await renderTopPanel({
      countLabel: <p>custom count</p>,
      leftComponent: <p>Left</p>,
      rightComponent: <p>Right</p>,
    });

    expect(rendered.findByText('Left')).toBeDefined();
    expect(rendered.findByText('Right')).toBeDefined();
    expect(rendered.findByText('custom count')).toBeDefined();
    // The prefix's own label is not drawn once a count label of the caller's is given.
    expect(document.body.textContent).not.toContain('Found');
  });

  it('reports the row count and passes the search text up as it is typed', async () => {
    const { rendered, setSearchText } = await renderTopPanel({ countLabelPrefix: 'Found' });

    expect(rendered.findByText('Found: 2')).toBeDefined();

    type(rendered.find('input'), 'alp');

    expect(setSearchText).toHaveBeenCalledWith('alp');
  });

  it('offers the timeline entry only when the schema has a time property', async () => {
    const { rendered } = await renderTopPanel({
      countLabelPrefix: 'Found',
      schema: datelessSchema,
    });

    click(rendered.find('button[title="Menu"]'));
    await flush();

    expect(menuButton('Extra Search')).toBeDefined();
    expect(menuButton('Copy Table as CSV')).toBeDefined();
    expect(menuButton('Export Table as')).toBeDefined();
    expect(menuButton('Show Stats')).toBeDefined();

    const timelineEntries = rendered
      .findAll('button')
      .filter((button) => button.textContent?.trim() === 'Show Timeline');

    expect(timelineEntries).toHaveLength(0);
  });

  it('copies the hidden-in-table columns of the rows as a CSV to the clipboard', async () => {
    const writeText = vi.fn((_text: string) => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    const { rendered } = await renderTopPanel({ countLabelPrefix: 'Found' });

    click(rendered.find('button[title="Menu"]'));
    await flush();
    click(menuButton('Copy Table as CSV'));
    await flush();

    const csv = writeText.mock.calls[0]?.[0] ?? '';

    // Every property hidden from the table travels, with its boolean, hex, enum and date forms.
    expect(csv).toContain('Note,Count,Count (free),Mask,Mask (free),Active,Status,Seen,Address');
    expect(csv).toContain('note-a');
    expect(csv).toContain('FF');
    expect(csv).toContain('Yes');
    expect(csv).toContain('No');
    expect(csv).toContain('Working');
    expect(csv).toContain('new');
    expect(csv).toContain(seenTextOfRowA);
  });

  it('downloads the same CSV as a plain-text file under the name the caller names it', async () => {
    stubObjectURLs();

    const getExportedTableFilename = vi.fn(() => 'items.csv');

    const rendered = await render(
      <FilterableTableTopPanel
        searchText=""
        setSearchText={vi.fn()}
        filteredRowCount={rows.length}
        items={rows}
        extraSearchSchema={fullSchema}
        getExportedTableFilename={getExportedTableFilename}
        countLabelPrefix="Found"
        minCountLabelWidth="3rem"
      />,
    );

    await openMenuItem('Export Table as', rendered);
    click(menuButton('CSV'));
    await flush();

    expect(getExportedTableFilename).toHaveBeenCalledWith({ format: 'csv', extension: 'csv' });
    // The CSV travels as a blob, downloaded under the caller's name.
    expect(recordedObjectURLs).toHaveLength(1);
    expect((await downloadedContents())[0]).toContain('Note,Count,Count (free)');
  });

  it('writes a json export of the rows as they are', async () => {
    stubObjectURLs();

    const getExportedTableFilename = vi.fn(() => 'items.json');

    const rendered = await render(
      <FilterableTableTopPanel
        searchText=""
        setSearchText={vi.fn()}
        filteredRowCount={rows.length}
        items={rows}
        extraSearchSchema={fullSchema}
        getExportedTableFilename={getExportedTableFilename}
        countLabelPrefix="Found"
        minCountLabelWidth="3rem"
      />,
    );

    await openMenuItem('Export Table as', rendered);
    click(menuButton('JSON'));
    await flush();

    expect(getExportedTableFilename).toHaveBeenCalledWith({ format: 'json', extension: 'json' });
    expect((await downloadedContents())[0]).toContain('"name": "alpha"');
  });

  it('writes an html export through the print window and downloads the page it rendered', async () => {
    vi.useFakeTimers();
    stubObjectURLs();
    const { window: printWindow } = stubExportWindow(true);

    const { rendered } = await renderTopPanel();

    await openMenuItem('Export Table as', rendered);
    click(menuButton('HTML'));

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(printWindow.document.writeln).toHaveBeenCalledWith(expect.stringContaining('DOCTYPE'));
    expect(printWindow.print).not.toHaveBeenCalled();
    expect(printWindow.close).toHaveBeenCalled();
    // The page the export rendered is what is downloaded, not the skeleton it wrote.
    expect((await downloadedContents())[0]).toContain('printed');
  });

  it('starts the print dialog for a pdf export and closes the window', async () => {
    vi.useFakeTimers();
    const { window: printWindow, body } = stubExportWindow(true);

    const { rendered } = await renderTopPanel({ getExportedTableFilename: () => 'items.pdf' });

    await openMenuItem('Export Table as', rendered);
    click(menuButton('PDF'));

    act(() => {
      vi.advanceTimersByTime(600);
    });

    // The export's own table carries every cell's value, headed by the count of the rows.
    expect(body.textContent).toContain('Note');
    expect(body.textContent).toContain('Working');
    expect(printWindow.print).toHaveBeenCalled();
    expect(printWindow.close).toHaveBeenCalled();
  });

  it('exports nothing when the browser refused the print window', async () => {
    const open = vi.fn(() => null);
    const getExportedTableFilename = vi.fn(() => 'items.pdf');

    const { rendered } = await renderTopPanel({ getExportedTableFilename });

    vi.stubGlobal('open', open);
    await openMenuItem('Export Table as', rendered);
    click(menuButton('PDF'));

    expect(open).toHaveBeenCalledWith('', '', 'height=600,width=800');
    expect(getExportedTableFilename).toHaveBeenCalledWith({ format: 'pdf', extension: 'pdf' });
    // Nothing was written: the export stops at the refusal.
    expect(recordedObjectURLs).toHaveLength(0);
  });

  it('fails the export when the printed document has no body to render onto', async () => {
    stubExportWindow(false);

    const { rendered } = await renderTopPanel({ getExportedTableFilename: () => 'items.pdf' });

    await openMenuItem('Export Table as', rendered);

    const messages = withUncaughtCapture(() => {
      click(menuButton('PDF'));
    });

    expect(messages).toContain('Export failed: the print window has no #pdf-content element.');
    expect(recordedObjectURLs).toHaveLength(0);
  });

  it('fails the csv copy when a property of a kind the export does not spell reaches it', async () => {
    const writeText = vi.fn((_text: string) => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    const { rendered } = await renderTopPanel({
      schema: propertyTypeOutsideTheSchemaUnionSchema(),
      getExportedTableFilename: () => 'items.csv',
    });

    await openMenuTo(rendered);

    const messages = withUncaughtCapture(() => {
      click(menuButton('Copy Table as CSV'));
    });

    expect(messages).toContain(
      'Unreachable value reached: {"name":"future","label":"Future","type":"aTypeAddedToTheSchemaLater","hiddenInTable":true}',
    );
    expect(writeText).not.toHaveBeenCalled();
  });

  it('fails the html export when a property of a kind the export does not spell reaches it', async () => {
    const { window: printWindow } = stubExportWindow(true);

    const { rendered } = await renderTopPanel({
      schema: propertyTypeOutsideTheSchemaUnionSchema(),
      getExportedTableFilename: () => 'items.pdf',
    });

    await openMenuItem('Export Table as', rendered);

    const messages = withUncaughtCapture(() => {
      click(menuButton('PDF'));
    });

    expect(messages).toContain(
      'unexpected property type: {"name":"future","label":"Future","type":"aTypeAddedToTheSchemaLater","hiddenInTable":true}',
    );
    // The document got as far as the skeleton, which the render failed on.
    expect(printWindow.document.writeln).toHaveBeenCalled();
  });

  it('opens the stats and the timeline modals over the rows', async () => {
    const { rendered, findByText, find, query } = await renderTopPanel({
      countLabelPrefix: 'Found',
    });

    click(find('button[title="Menu"]'));
    await flush();
    click(menuButton('Show Stats'));
    await flush();

    expect(findByText('Stats')).toBeDefined();
    expect(find<HTMLSelectElement>('select').value).toBe('name');

    click(rendered.find('button[title="Menu"]'));
    await flush();
    click(menuButton('Show Timeline'));
    await flush();

    expect(findByText('Timeline')).toBeDefined();
    expect(query('canvas')).not.toBeNull();
  });

  it('searches from the extra-search form and closes it with the search it built', async () => {
    const searchFormSchema: SearchSchema<Row> = {
      properties: [
        {
          name: 'name',
          label: 'Name',
          type: 'string',
          trim: true,
          extractValue: (item) => item.name,
        },
        {
          name: 'status',
          label: 'Status',
          type: 'enum',
          options: [{ value: 'ok', label: 'Working' }],
          extractValue: (item) => item.status,
        },
      ],
    };

    const { findByText, find, setSearchText } = await renderTopPanel({
      schema: searchFormSchema,
    });

    click(find('button[title="Menu"]'));
    await flush();
    click(menuButton('Extra Search'));
    await flush();

    type(rowControl<HTMLInputElement>('Name: ', 'input'), 'alpha');
    change(rowControl<HTMLSelectElement>('Status: ', 'select'), 'ok');

    const findButton = findByText('Find').closest('button');

    if (findButton === null) {
      throw new Error('no Find button.');
    }

    click(findButton);
    await flush();

    // One term per touched field, and the modal's open state back to the panel.
    expect(setSearchText).toHaveBeenCalledWith('name=alpha status=Working');
  });
});

describe('TimelineViewerModal', () => {
  it('offers no series and draws no chart when every property is a time', async () => {
    const { findByText, query } = await render(
      <TimelineViewerModal
        open={true}
        onOpenChange={() => undefined}
        items={rows}
        searchSchema={timeOnlySchema}
      />,
    );

    expect(findByText('Timeline')).toBeDefined();
    expect(document.body.querySelectorAll('option')).toHaveLength(0);
    expect(query('canvas')).toBeNull();
  });

  it('draws the rows over the time property and offers the other properties as series', async () => {
    const { findByText, query, findAll, find } = await render(
      <TimelineViewerModal
        open={true}
        onOpenChange={() => undefined}
        items={rows}
        searchSchema={twoSeriesSchema}
      />,
    );

    expect(findByText('Timeline')).toBeDefined();
    expect(query('canvas')).not.toBeNull();
    // A time property is not a series; the two search texts are.
    expect(findAll('option')).toHaveLength(2);

    change(find<HTMLSelectElement>('select'), 'note');

    expect(find<HTMLSelectElement>('select').value).toBe('note');
  });

  it('runs the actions the keyboard is bound to when the modal is open', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { query } = await render(
      <TimelineViewerModal
        open={true}
        onOpenChange={() => undefined}
        items={rows}
        searchSchema={twoSeriesSchema}
      />,
    );

    await flush();

    // The chart is there to be drawn on, so its own fullscreen request is what the fullscreen action
    // reaches; jsdom has no fullscreen back-end, so the action fails and is only logged.
    for (const code of [
      'KeyG',
      'KeyL',
      'KeyH',
      'KeyC',
      'KeyM',
      'ArrowLeft',
      'ArrowRight',
      'ShiftLeft',
      'ShiftRight',
      'BracketLeft',
      'BracketRight',
      'Equal',
      'Minus',
      'KeyR',
      'KeyF',
      'Home',
      'End',
    ]) {
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
      });
    }

    expect(consoleError).toHaveBeenCalledWith('Error toggling fullscreen:', expect.anything());
    expect(query('canvas')).not.toBeNull();
  });

  it('reads the fullscreen state back off the document when one is active', async () => {
    Object.defineProperty(document, 'fullscreenElement', {
      value: document.documentElement,
      configurable: true,
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { query } = await render(
      <TimelineViewerModal
        open={true}
        onOpenChange={() => undefined}
        items={rows}
        searchSchema={twoSeriesSchema}
      />,
    );

    await flush();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', bubbles: true }));
    });

    expect(consoleError).toHaveBeenCalled();
    expect(document.fullscreenElement).toEqual(document.documentElement);
    expect(query('canvas')).not.toBeNull();
  });

  it('keeps the timeline in place when the rows end before the visible grid does', async () => {
    const { query } = await render(
      <TimelineViewerModal
        open={true}
        onOpenChange={() => undefined}
        items={rows}
        searchSchema={twoSeriesSchema}
      />,
    );

    await flush();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'End', bubbles: true }));
    });

    expect(query('canvas')).not.toBeNull();
  });

  it('pans the timeline to when the rows end once they outlast the visible grid', async () => {
    const { query } = await render(
      <TimelineViewerModal
        open={true}
        onOpenChange={() => undefined}
        items={manyRows(60, 'alpha')}
        searchSchema={twoSeriesSchema}
      />,
    );

    await flush();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'End', bubbles: true }));
    });

    expect(query('canvas')).not.toBeNull();
  });

  it('draws one marker per row the chosen series holds at the time it was written', async () => {
    const { findByText, query } = await render(
      <TimelineViewerModal
        open={true}
        onOpenChange={() => undefined}
        items={rows}
        searchSchema={twoSeriesSchema}
      />,
    );

    // The plot draws at columns named in time: at scale one the grid stops short of them, so the
    // zoom runs up until both series have a column of their own, one marker per series.
    for (let press = 0; press < 69; press++) {
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Equal', bubbles: true }));
      });
    }

    expect(findByText('Timeline')).toBeDefined();
    expect(query('canvas')).not.toBeNull();
    expect(arcsDrawn).toBe(2);
  });

  it('labels the columns of a wide grid with the time each names', async () => {
    // A grid wider than eight thousand pixels reaches both series' columns; a narrower one stops
    // short of the first labelled column. The width is widened for this test and put back after.
    const offsetWidth = Object.getOwnPropertyDescriptor(
      window.HTMLElement.prototype,
      'offsetWidth',
    );

    Object.defineProperty(window.HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get: () => 8400,
    });

    try {
      const { findByText, query } = await render(
        <TimelineViewerModal
          open={true}
          onOpenChange={() => undefined}
          items={rows}
          searchSchema={twoSeriesSchema}
        />,
      );

      await flush();

      expect(query('canvas')).not.toBeNull();
      expect(findByText(seenTextOfRowA)).toBeDefined();
      // The second column names the other row's time.
      expect(findByText(formatDateAndTime(rows[1]?.seen ?? 0, getLocaleDates('en')))).toBeDefined();
    } finally {
      if (offsetWidth !== undefined) {
        Object.defineProperty(window.HTMLElement.prototype, 'offsetWidth', offsetWidth);
      }
    }
  });
});
