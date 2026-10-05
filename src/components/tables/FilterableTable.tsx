import { type Context, createContext, useContext, useState } from 'react';
import { ControlledTable } from './ControlledTable';
import type { SortableTableCellRenderer, SortableTableComparatorFunction } from './SortableTable';
import type { GetExportedTableFilenameCallback } from './table_export';
import type { AnonymousSearchPropertySchema } from './use_filtered_items';

/**
 * A property shown as a column: its title, its widths, how to render a cell, how to sort by it, and
 * what to search in it.
 *
 * The three are per property rather than per table because they are per property: a status column
 * renders its own badge, sorts by its own order and is searched by its own text, and none of that is
 * derivable from the data. `minWidth` is what a column cannot be dragged narrower than.
 */
export interface FilterableTableColumnProperty<T, C extends string> {
  id: C;
  variant?: 'column' | undefined;
  title: string;
  width: number;
  minWidth: number;
  headerStyle?: React.CSSProperties | undefined;
  cell: SortableTableCellRenderer<T, C>;
  comparator: SortableTableComparatorFunction<T>;
  search: AnonymousSearchPropertySchema<T>;
}

/**
 * A property that filters and sorts without taking up a column.
 *
 * For a property an operator filters by but does not need to see — the resolved address behind a
 * hostname, the formatted date behind a timestamp. It still needs a comparator and a search schema,
 * because a filter the table cannot search is not a filter.
 */
export interface FilterableTableFilterProperty<T, C extends string> {
  id: C;
  variant: 'filter';
  title: string;
  comparator: SortableTableComparatorFunction<T>;
  search: AnonymousSearchPropertySchema<T>;
}

/** One property of a filterable table: a visible column, or a filter with no column. */
export type FilterableTableProperty<T, C extends string> =
  | FilterableTableColumnProperty<T, C>
  | FilterableTableFilterProperty<T, C>;

/** The properties of one table, in the order their columns are drawn. */
export type FilterableTablePropertyList<T, C extends string> = FilterableTableProperty<T, C>[];

/**
 * What a filterable table takes, whatever it is a table of.
 *
 * There is nothing in it about what is being listed: `items` is the caller's type,
 * `properties` says how each of its fields is shown, searched and compared, and the two heights
 * are the caller's because the row geometry has to be exact. `getItemId` is needed only for
 * export and selection; when it is absent the table keys rows by index.
 */
export interface FilterableTableProps<T, C extends string> {
  readonly items: T[];
  readonly countLabelPrefix: string;
  readonly minCountLabelWidth: string;
  readonly headerRowHeight: number;
  readonly rowHeight: number;
  readonly properties: FilterableTablePropertyList<T, C>;
  readonly getExportedTableFilename: GetExportedTableFilenameCallback;
  readonly sortColumnId?: C | undefined;
  readonly reversedSort?: boolean | undefined;
  readonly className?: string | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly historyId?: string | undefined;
  readonly getItemId?: ((item: T, index: number) => string | number) | undefined;
}

/**
 * A table over the caller's items, holding its own search text.
 *
 * The searchable counterpart of {@link ControlledTable}: use this one when nothing outside the table
 * needs the search string, and the controlled one when something does.
 */
export function FilterableTable<T, C extends string>({
  items,
  countLabelPrefix,
  minCountLabelWidth,
  headerRowHeight,
  rowHeight,
  properties,
  getExportedTableFilename,
  sortColumnId,
  reversedSort,
  className,
  style,
  historyId,
  getItemId,
}: FilterableTableProps<T, C>): React.JSX.Element {
  return (
    <FilterableTableContextProvider>
      <Table
        items={items}
        countLabelPrefix={countLabelPrefix}
        minCountLabelWidth={minCountLabelWidth}
        headerRowHeight={headerRowHeight}
        rowHeight={rowHeight}
        properties={properties}
        getExportedTableFilename={getExportedTableFilename}
        sortColumnId={sortColumnId}
        reversedSort={reversedSort}
        className={className}
        style={style}
        historyId={historyId}
        getItemId={getItemId}
      />
    </FilterableTableContextProvider>
  );
}

function Table<T, C extends string>({
  items,
  countLabelPrefix,
  minCountLabelWidth,
  headerRowHeight,
  rowHeight,
  properties,
  getExportedTableFilename,
  sortColumnId,
  reversedSort,
  className,
  style,
  historyId,
  getItemId,
}: FilterableTableProps<T, C>) {
  const context = useContext(FilterableTableContext);

  if (context === null) {
    throw new Error('FilterableTable must be rendered inside a FilterableTableProvider.');
  }

  const { searchText, setSearchText } = context;

  return (
    <ControlledTable
      items={items}
      countLabelPrefix={countLabelPrefix}
      minCountLabelWidth={minCountLabelWidth}
      headerRowHeight={headerRowHeight}
      rowHeight={rowHeight}
      properties={properties}
      getExportedTableFilename={getExportedTableFilename}
      sortColumnId={sortColumnId}
      reversedSort={reversedSort}
      className={className}
      style={style}
      historyId={historyId}
      getItemId={getItemId}
      searchText={searchText}
      setSearchText={setSearchText}
    />
  );
}

function FilterableTableContextProvider({ children }: { readonly children: React.ReactNode }) {
  const [searchText, setSearchText] = useState('');

  return (
    <FilterableTableContext
      value={{
        searchText,
        setSearchText,
      }}
    >
      {children}
    </FilterableTableContext>
  );
}

/**
 * The search text of the enclosing filterable table, and the setter for it.
 *
 * Exported for the pieces that make up a table panel — the top panel with its search box and the stats
 * modal — which have to live below the provider that owns the search text and read it from here rather
 * than be handed it as a prop through every panel in between. It is `null` outside a
 * {@link FilterableTable}, so a panel used on its own fails with a message naming the cause rather than
 * reading `undefined.searchText`.
 */
export interface FilterableTableContext {
  searchText: string;
  setSearchText: React.Dispatch<React.SetStateAction<string>>;
}

export const FilterableTableContext: Context<FilterableTableContext | null> =
  createContext<FilterableTableContext | null>(null);
