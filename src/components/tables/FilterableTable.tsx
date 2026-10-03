import { createContext, useContext, useState } from 'react';
import type { GetExportedTableFilenameCallback } from './filterable_table_export';
import { ControlledTable } from './filterable_table_internal';
import type { AnonymousSearchPropertySchema } from './filterable_table_search';
import type { SortableTableCellRenderer, SortableTableComparatorFunction } from './SortableTable';

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

export interface FilterableTableFilterProperty<T, C extends string> {
  id: C;
  variant: 'filter';
  title: string;
  comparator: SortableTableComparatorFunction<T>;
  search: AnonymousSearchPropertySchema<T>;
}

export type FilterableTableProperty<T, C extends string> =
  | FilterableTableColumnProperty<T, C>
  | FilterableTableFilterProperty<T, C>;

export type FilterableTablePropertyList<T, C extends string> = FilterableTableProperty<T, C>[];

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
  readonly style?: React.CSSProperties | undefined;
  readonly historyId?: string | undefined;
  readonly getItemId?: ((item: T, index: number) => string | number) | undefined;
}

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
  style,
  historyId,
  getItemId,
}: FilterableTableProps<T, C>) {
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

export const FilterableTableContext = createContext<{
  searchText: string;
  setSearchText: React.Dispatch<React.SetStateAction<string>>;
} | null>(null);
