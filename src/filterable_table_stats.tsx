import { useId, useState } from 'react';
import { useSearchSchemaPropertyValueToString } from '@/filterable_table_property_value';
import type {
  SearchPropertySchema,
  SearchPropertySchemaName,
  SearchSchema,
} from '@/filterable_table_search';
import { cmp } from '@/lib/math';
import { useLocale } from '@/locale';
import { Modal } from '@/ui/Modal';
import { mapToShares, PieChart } from '@/ui/PieChart';
import { Select } from '@/ui/Select';
import { makeSortableTableCellRenderer, SortableTable } from '@/ui/SortableTable';

/**
 * How many rows a table is showing, out of how many it has.
 *
 * `countLabelPrefix` is the caller's wording for "rows" rather than a key, because the word belongs
 * to what is being counted. The total is dropped when nothing is filtered out, so an unfiltered table
 * reads `Rows: 40` and not `Rows: 40 / 40`.
 */
export interface CountLabelProps {
  readonly filteredRowCount: number;
  readonly totalRowCount: number;
  readonly countLabelPrefix: string;
  readonly minCountLabelWidth?: string | undefined;
}

export function CountLabel({
  filteredRowCount,
  totalRowCount,
  countLabelPrefix,
  minCountLabelWidth,
}: CountLabelProps) {
  return (
    <div
      className="p-2 bg-bpl rounded-lg truncate flex-grow sm:flex-grow-0"
      style={{ minWidth: minCountLabelWidth }}
    >
      {filteredRowCount === totalRowCount
        ? `${countLabelPrefix}: ${filteredRowCount}`
        : `${countLabelPrefix}: ${filteredRowCount} / ${totalRowCount}`}
    </div>
  );
}

interface ItemCountByPropertyValue {
  propertyValue: string;
  count: number;
}

/**
 * How many rows there are per value of one searchable property, as a pie chart and a table.
 *
 * The property is the caller's to pick from a dropdown, because which breakdown is interesting depends
 * on the question being asked. Values are grouped by the same text the search string uses, so a value
 * an operator can type is a value they can count.
 */
export interface FilterableTableStatsModalProps<T> {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly items: readonly T[];
  readonly searchSchema: SearchSchema<T>;
}

export function FilterableTableStatsModal<T>({
  open,
  onOpenChange,
  items,
  searchSchema,
}: FilterableTableStatsModalProps<T>) {
  const { t } = useLocale();

  const [statsPropertyName, setStatsPropertyName] = useState<
    SearchPropertySchemaName<T> | undefined
  >(
    // A schema with no properties has no property to report stats on, so the selection starts empty
    // rather than naming one that is not there.
    () => searchSchema.properties[0]?.name,
  );

  const id = useId();

  const property = searchSchema.properties.find((property) => property.name === statsPropertyName);

  return (
    <Modal open={open} title={t('FilterableTableStatsModal.title')} onOpenChange={onOpenChange}>
      <div className="flex gap-2">
        <label htmlFor={`${id}-total-items`} className="font-bold">
          {t('FilterableTableStatsModal.totalItems')}
        </label>
        <div id={`${id}-total-items`}>{items.length}</div>
      </div>
      {items.length !== 0 && (
        <div className="flex flex-col gap-2 mt-4">
          <div className="flex gap-2 items-center ml-auto">
            <label htmlFor={`${id}-property-select`} className="font-bold">
              {t('FilterableTableStatsModal.propertySelect.label')}
            </label>
            <Select
              id={`${id}-property-select`}
              value={statsPropertyName ?? ''}
              onChange={(e) =>
                setStatsPropertyName(e.currentTarget.value as typeof statsPropertyName)
              }
            >
              {searchSchema.properties.map((property) => (
                <option key={property.name} value={property.name}>
                  {property.label}
                </option>
              ))}
            </Select>
          </div>
          {property !== undefined && <PropertyStats items={items} property={property} />}
        </div>
      )}
    </Modal>
  );
}

function PropertyStats<T>({
  items,
  property,
}: {
  readonly items: readonly T[];
  readonly property: SearchPropertySchema<T>;
}) {
  const { t } = useLocale();

  const searchSchemaPropertyValueToString = useSearchSchemaPropertyValueToString<T>();

  function getItemCountByColumnId(
    items: readonly T[],
    property: SearchPropertySchema<T>,
  ): ItemCountByPropertyValue[] {
    const countMap: Record<string, number> = {};

    for (const item of items) {
      const key = searchSchemaPropertyValueToString(item, property);
      countMap[key] = (countMap[key] ?? 0) + 1;
    }

    const entries: ItemCountByPropertyValue[] = [];

    for (const [propertyValue, count] of Object.entries(countMap)) {
      entries.push({ propertyValue, count });
    }

    return entries;
  }

  const shares = mapToShares(
    getItemCountByColumnId(items, property),
    items.length,
    ({ propertyValue, count }) => ({
      title: propertyValue,
      count,
    }),
  );

  const itemTypeToColor = Object.fromEntries(shares.map((share) => [share.title, share.color]));

  return (
    <>
      <PieChart
        shares={shares}
        radius={100}
        shareMarginDegrees={5}
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginLeft: 'auto',
          marginRight: 'auto',
          marginTop: '0.5rem',
          marginBottom: '0.5rem',
        }}
      />
      <div className="overflow-auto max-h-[50vh]">
        <SortableTable
          descriptor={{
            headerColumns: [
              {
                id: 'column',
                title: property.label,
                width: 300,
              },
              {
                id: 'count',
                title: t('FilterableTableStatsModal.itemCountByCriterionColumn'),
                width: 100,
              },
            ],
            rowHeight: 32,
            headerRowHeight: 50,
            rows: getItemCountByColumnId(items, property).map((record) => ({
              id: JSON.stringify(record),
              data: record,
            })),
            cellRenderer: makeSortableTableCellRenderer({
              column: ({ data, columnWidth }) => (
                <div
                  className="flex w-full items-center gap-1 truncate text-nowrap"
                  style={{ width: columnWidth }}
                >
                  <div
                    className="border-bpd size-4 rounded-full border-2 shrink-0"
                    style={{
                      backgroundColor: itemTypeToColor[data.propertyValue],
                    }}
                  />
                  {data.propertyValue}
                </div>
              ),

              count: ({ data, columnWidth }) => {
                return (
                  <div className="flex w-full items-center gap-1 overflow-hidden text-nowrap">
                    <div
                      className="flex-grow truncate"
                      style={{ width: `calc(${columnWidth}px - 2.75rem)` }}
                    >
                      {data.count}
                    </div>
                  </div>
                );
              },
            }),
            columnComparators: {
              column: (a, b) => cmp(a.data.propertyValue, b.data.propertyValue),
              count: (a, b) => cmp(a.data.count, b.data.count),
            },
          }}
          sortColumnId="count"
          reversedSort
          rowListOverScanCount={items.length < 50 ? items.length : undefined}
          style={{
            marginTop: '2rem',
            height: 300,
            flexGrow: 1,
          }}
          className="sm:h-auto"
          rowStyle={{ borderBottomWidth: 0 }}
        />
      </div>
    </>
  );
}
