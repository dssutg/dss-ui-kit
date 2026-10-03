import { ControlledTable, type ControlledTableProps } from '@/filterable_table_internal';

/**
 * {@link ControlledTable} under the name this table was first published as.
 *
 * The two take the same props and draw the same thing; new code should use `ControlledTable`, whose
 * name says what it is, and this wrapper exists so an existing import keeps working.
 */
export type ControlledFilterableTableProps<T, C extends string> = ControlledTableProps<T, C>;

export function ControlledFilterableTable<T, C extends string>({
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
}: ControlledTableProps<T, C>) {
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
