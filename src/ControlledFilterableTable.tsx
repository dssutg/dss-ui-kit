import type { FilterableTableProps } from '@/FilterableTable';
import { ControlledTable } from '@/filterable_table_internal';

export interface ControlledFilterableTableProps<T, C extends string>
  extends FilterableTableProps<T, C> {
  searchText: string;
  setSearchText: React.Dispatch<React.SetStateAction<string>>;
}

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
}: ControlledFilterableTableProps<T, C>) {
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
