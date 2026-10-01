import { useMemo } from 'react';
import type { ControlledFilterableTableProps } from '@/ControlledFilterableTable';
import type { FilterableTableColumnProperty } from '@/FilterableTable';
import { type EnumOption, FilterableTableTopPanel } from '@/FilterableTableTopPanel';
import { type SearchSchema, useFilteredItems } from '@/filterable_table_search';
import {
  makeSortableTableCellRenderer,
  SortableTable,
  type SortableTableColumnComparatorTable,
  type SortableTableColumnRenderMap,
  type SortableTableDescriptor,
} from '@/ui/SortableTable';

/**
 * Renders a filter value the way the search string and the CSV export spell it.
 *
 * A closed set of values is rendered through the caller's own labels, so what an operator searches
 * for is the wording they see in the column rather than a key.
 */
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
  style,
  historyId,
  getItemId,
  searchText,
  setSearchText,
}: ControlledFilterableTableProps<T, C>) {
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
      className="flex flex-col gap-2 rounded-2xl p-2 bg-bpd overflow-auto sm:overflow-hidden flex-grow"
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
      />
    </div>
  );
}
