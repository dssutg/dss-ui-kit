import { useMemo } from 'react';
import { cn } from '@/util/cn';
import type { FilterableTableColumnProperty, FilterableTableProps } from './FilterableTable';
import { type EnumOption, FilterableTableTopPanel } from './FilterableTableTopPanel';
import {
  makeSortableTableCellRenderer,
  SortableTable,
  type SortableTableColumnComparatorTable,
  type SortableTableColumnRenderMap,
  type SortableTableDescriptor,
} from './SortableTable';
import { type SearchSchema, useFilteredItems } from './use_filtered_items';

/**
 * The label a `enum` value is shown, searched and exported as.
 *
 * The caller's own label when it has one, and the raw value when it does not, so a value added to
 * the caller's data is still visible before they list it in `options`.
 */
export function getEnumLabel(
  property: { readonly options: readonly EnumOption[] },
  value: string,
): string {
  const asString = value.toString();

  return property.options.find((option) => option.value === asString)?.label ?? asString;
}

/**
 * A filterable table whose search text the caller holds.
 *
 * "Controlled" means the search string is a prop, so a caller can put it in a URL, restore it from
 * history, or pair it with a search form and have both edit the same state. A table that owned its
 * search text could not do any of that.
 */
export interface ControlledTableProps<T, C extends string> extends FilterableTableProps<T, C> {
  readonly searchText: string;
  readonly setSearchText: React.Dispatch<React.SetStateAction<string>>;
}

/**
 * A filterable table over the caller's items, with the search text held by the caller.
 *
 * Items, their property descriptions and the comparators are all the caller's data; the table filters
 * with them, renders them through the descriptor and reports a click. It is not a data source and has
 * no opinion about what an item is — which is what lets the same table show anything, given the
 * right properties.
 */
export function ControlledTable<T, C extends string>({
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
  onScroll,
  searchText,
  setSearchText,
}: ControlledTableProps<T, C>): React.JSX.Element {
  const searchSchema: SearchSchema<T> = {
    properties: properties.map((property) => ({
      name: property.id,
      label: property.title,
      ...property.search,
    })),
  };

  const filteredItems = useFilteredItems({
    searchText,
    items,
    searchSchema,
  });

  const columnProperties = useMemo(() => {
    const columnProperties: FilterableTableColumnProperty<T, C>[] = [];

    for (const prop of properties) {
      if (prop.variant === undefined) {
        columnProperties.push(prop);
      }
    }

    return columnProperties;
  }, [properties]);

  const headerColumns = useMemo(
    () =>
      columnProperties.map((prop) => ({
        id: prop.id,
        title: prop.title,
        width: prop.width,
        minWidth: prop.minWidth,
        style: prop.headerStyle,
      })),
    [columnProperties],
  );

  const tableDescriptor: SortableTableDescriptor<T, C> = {
    headerColumns,
    headerRowHeight,
    rowHeight,
    cellRenderer: makeSortableTableCellRenderer(
      Object.fromEntries(
        columnProperties.map(({ id, cell }) => [id, cell]),
      ) as SortableTableColumnRenderMap<T, C>,
    ),
    columnComparators: Object.fromEntries(
      properties.map(({ id, comparator }) => [id, comparator]),
    ) as SortableTableColumnComparatorTable<T, C>,
    rows: filteredItems.map((item, index) => ({
      id:
        getItemId !== undefined ? getItemId(item, index).toString() : JSON.stringify([item, index]),
      data: item,
    })),
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-2xl p-2 bg-bpd overflow-auto sm:overflow-hidden flex-grow',
        className,
      )}
      style={style}
    >
      <FilterableTableTopPanel
        historyId={historyId}
        searchText={searchText}
        setSearchText={setSearchText}
        filteredRowCount={filteredItems.length}
        items={items}
        extraSearchSchema={searchSchema}
        getExportedTableFilename={getExportedTableFilename}
        countLabelPrefix={countLabelPrefix}
        minCountLabelWidth={minCountLabelWidth}
      />
      <SortableTable
        descriptor={tableDescriptor}
        rowListOverScanCount={filteredItems.length < 50 ? filteredItems.length : undefined}
        rowStyle={{
          borderBottomWidth: 0,
          flexShrink: 0,
        }}
        sortColumnId={sortColumnId}
        reversedSort={reversedSort}
        onScroll={onScroll}
      />
    </div>
  );
}
