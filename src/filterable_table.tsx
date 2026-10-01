import { createRoot } from 'preact/compat/client';
import {
  createContext,
  StrictMode,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { minstrftime } from '@/lib/date';
import { copyToClipboard } from '@/lib/dom';
import { serializeCSV } from '@/lib/dsv';
import { downloadStringAsPlainTextFile } from '@/lib/file';
import { formatHexNumber } from '@/lib/format_number';
import { handleKeyMapKeyDown, type KeyMapActions } from '@/lib/key_map';
import { clamp, cmp } from '@/lib/math';
import { useEventListener } from '@/lib/use_event_listener';
import { useFullScreenChange } from '@/lib/use_fullscreen_change';
import { getLocaleDates, type LocaleName, useLocale } from '@/locale';
import { useTheme } from '@/theme';
import { Button } from '@/ui/button';
import { DropDownMenu } from '@/ui/dropdown';
import {
  DecimalIntegerInput,
  type DecimalIntegerInputValue,
  Input,
  SearchInput,
  TextInput,
} from '@/ui/input';
import { Modal } from '@/ui/modal';
import { mapToShares, PieChart } from '@/ui/piechart';
import { Select } from '@/ui/select';
import {
  makeSortableTableCellRenderer,
  SortableTable,
  type SortableTableCellRenderer,
  type SortableTableColumnComparatorTable,
  type SortableTableColumnRenderMap,
  type SortableTableComparatorFunction,
  type SortableTableDescriptor,
} from '@/ui/sortable_table';
import type { ZoomableCanvasTransform } from '@/ui/zoomable_canvas';
import {
  type ActionKey,
  Chart,
  chartPosToCanvasRelative,
  chartViewKeyMap,
  chunkLines,
  formatChartHSL,
  getDefaultCanvasTransform,
  gridGap,
  MAX_SCALE,
  MIN_SCALE,
  type PlotFunctionRangeOptions,
  SCALE_FACTOR,
} from './chart';

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

export interface ControlledFilterableTableProps<T, C extends string>
  extends FilterableTableProps<T, C> {
  searchText: string;
  setSearchText: React.Dispatch<React.SetStateAction<string>>;
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

function ControlledTable<T, C extends string>({
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

export type FilterableTableExportFormat = 'pdf' | 'html' | 'csv' | 'json';

export type GetExportedTableFilenameCallback = ({
  format,
  extension,
}: {
  readonly format: FilterableTableExportFormat;
  readonly extension: string;
}) => string;

export function FilterableTableTopPanel<T>({
  searchText,
  setSearchText,
  filteredRowCount,
  items,
  extraSearchSchema,
  getExportedTableFilename,
  countLabelPrefix,
  countLabel,
  minCountLabelWidth,
  style,
  leftComponent,
  rightComponent,
  historyId,
}: {
  readonly searchText: string;
  readonly setSearchText: (searchText: string) => void;
  readonly filteredRowCount: number;
  readonly items: readonly T[];
  readonly extraSearchSchema: SearchSchema<T>;
  readonly getExportedTableFilename: GetExportedTableFilenameCallback;
  readonly countLabelPrefix?: string | undefined;
  readonly countLabel?: React.ReactNode | undefined;
  readonly minCountLabelWidth?: string | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly leftComponent?: React.ReactNode | undefined;
  readonly rightComponent?: React.ReactNode | undefined;
  readonly historyId?: string | undefined;
}) {
  const { t, lang } = useLocale();

  const [extraSearchModalOpen, setExtraSearchModalOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const hasTimeProperty = useMemo(() => {
    return extraSearchSchema.properties.some((p) => p.type === 'dateAndTime');
  }, [extraSearchSchema]);

  function serializeItemsToCsv() {
    const columnProperties = extraSearchSchema.properties.filter((prop) =>
      Boolean(prop.hiddenInTable),
    );

    return serializeCSV([
      columnProperties.map((property) => property.label),
      ...items
        .map((item) =>
          columnProperties.map((property) => {
            switch (property.type) {
              case 'string':
              case 'decimalInteger':
              case 'ip':
                return property.extractValue(item).toString();
              case 'enum':
                return getEnumLabel(property, property.extractValue(item));
              case 'dateAndTime':
                return formatDateAndTime(property.extractValue(item), lang);
              case 'unsignedHex':
                return formatHexNumber(property.extractValue(item), 1);
              case 'boolean':
                if (property.extractValue(item)) {
                  return t('yes');
                }
                return t('no');
            }
          }),
        )
        .toSorted(),
    ]);
  }

  function exportAsHtmlOrPdf(format: 'html' | 'pdf') {
    const extension = format;
    const filename = getExportedTableFilename({ format, extension });

    const printWindow = window.open('', '', 'height=600,width=800');

    if (printWindow === null) {
      return;
    }

    const sortedItems = items.toSorted();

    printWindow.document.writeln(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${filename}</title>
          <style>
            table, tr, td, th {
              border: 1px solid #000;
              border-collapse: collapse;
            }
            table { margin: 0 auto; }
            td, th { padding: 0.25rem; }
            .right { text-align: right; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .flex { display: flex; }
            .gap-2 { gap: 0.5rem; }
            .text-bad { color: #a94949; }
            .text-normal { color: #9c760d; }
          </style>
        </head>
        <body id="pdf-content">
        <body>
      </html>
    `);

    const pdfContentElement = printWindow.document.querySelector('#pdf-content');

    if (pdfContentElement === null) {
      throw new Error('Export failed: the print window has no #pdf-content element.');
    }

    const root = createRoot(pdfContentElement);

    const columnProperties = extraSearchSchema.properties.filter((prop) =>
      Boolean(prop.hiddenInTable),
    );

    root.render(
      <StrictMode>
        <div className="flex gap-2">
          <div className="bold">{countLabelPrefix}: </div>
          <div>{sortedItems.length}</div>
        </div>
        <table>
          <thead>
            <tr>
              {columnProperties.map((p) => (
                <th key={p.label}>{p.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item, itemIndex) => (
              <tr key={itemIndex}>
                {columnProperties.map((property, propertyIndex) => {
                  switch (property.type) {
                    case 'boolean': {
                      if (property.extractValue(item)) {
                        return (
                          <td key={propertyIndex} className="center">
                            {t('yes')}
                          </td>
                        );
                      }
                      return (
                        <td key={propertyIndex} className="center text-normal">
                          {t('no')}
                        </td>
                      );
                    }

                    case 'unsignedHex': {
                      const hex = formatHexNumber(property.extractValue(item), 1);
                      return (
                        <td key={propertyIndex} className="right">
                          {hex}
                        </td>
                      );
                    }

                    case 'enum': {
                      return (
                        <td key={propertyIndex} className="center">
                          {getEnumLabel(property, property.extractValue(item))}
                        </td>
                      );
                    }

                    case 'dateAndTime': {
                      return (
                        <td key={propertyIndex}>
                          {formatDateAndTime(property.extractValue(item), lang)}
                        </td>
                      );
                    }

                    case 'decimalInteger': {
                      return (
                        <td key={propertyIndex} className="right">
                          {property.extractValue(item)}
                        </td>
                      );
                    }

                    case 'string':
                    case 'ip': {
                      return <td key={propertyIndex}>{property.extractValue(item)}</td>;
                    }

                    default: {
                      // Every type the schema declares is handled above. Binding the leftover to
                      // `never` makes a type added to the schema later a compile error here
                      // rather than a blank cell in the export.
                      const unhandled: never = property;

                      throw new Error(`unexpected property type: ${JSON.stringify(unhandled)}`);
                    }
                  }
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </StrictMode>,
    );

    printWindow.document.close();

    setTimeout(() => {
      if (format === 'pdf') {
        printWindow.print();
        printWindow.close();
      }

      if (format === 'html') {
        const htmlContent = printWindow.document.documentElement.outerHTML;

        downloadStringAsPlainTextFile(filename, htmlContent);

        printWindow.close();
      }
    }, 500);
  }

  return (
    <div className="flex gap-2 flex-wrap" style={style}>
      {leftComponent}
      {countLabel === undefined && countLabelPrefix !== undefined && (
        <CountLabel
          filteredRowCount={filteredRowCount}
          totalRowCount={items.length}
          countLabelPrefix={countLabelPrefix}
          minCountLabelWidth={minCountLabelWidth}
        />
      )}
      {countLabel}
      <div className="flex gap-2 flex-grow items-center">
        <SearchInput
          historyId={historyId}
          value={searchText}
          placeholder={t('FilterableTable.search')}
          onChangeText={setSearchText}
          inputStyle={{ width: '100%' }}
        />
        <DropDownMenu
          menu={[
            {
              path: ['extraSearch'],
              icon: 'adjustments',
              title: t('FilterableTable.extraSearch'),
              onSelect: () => setExtraSearchModalOpen(true),
            },
            {
              path: ['copyTableAsCsv'],
              icon: 'copy',
              title: t('FilterableTable.copyTableAsCsv'),
              onSelect: () => copyToClipboard(serializeItemsToCsv()),
            },
            {
              path: ['exportTableAs'],
              icon: 'download',
              title: t('FilterableTable.exportTableAs'),
              submenu: [
                {
                  path: ['exportTableAs', 'pdf'],
                  title: t('FilterableTable.exportTableAs.pdf'),
                  onSelect: () => exportAsHtmlOrPdf('pdf'),
                },
                {
                  path: ['exportTableAs', 'html'],
                  title: t('FilterableTable.exportTableAs.html'),
                  onSelect: () => exportAsHtmlOrPdf('html'),
                },
                {
                  path: ['exportTableAs', 'csv'],
                  title: t('FilterableTable.exportTableAs.csv'),
                  onSelect() {
                    downloadStringAsPlainTextFile(
                      getExportedTableFilename({
                        format: 'csv',
                        extension: 'csv',
                      }),
                      serializeItemsToCsv(),
                    );
                  },
                },
                {
                  path: ['exportTableAs', 'json'],
                  title: t('FilterableTable.exportTableAs.json'),
                  onSelect() {
                    downloadStringAsPlainTextFile(
                      getExportedTableFilename({
                        format: 'json',
                        extension: 'json',
                      }),
                      JSON.stringify(items, null, 2),
                    );
                  },
                },
              ],
            },
            {
              path: ['showStats'],
              icon: 'barChart',
              title: t('FilterableTable.showStats'),
              onSelect: () => setStatsOpen(true),
            },
            ...(hasTimeProperty
              ? [
                  {
                    path: ['showTimeline'],
                    icon: 'clock' as const,
                    title: t('FilterableTable.showTimeline'),
                    onSelect: () => setTimelineOpen(true),
                  },
                ]
              : []),
          ]}
        />
      </div>
      {rightComponent}
      {/* Modals */}
      {extraSearchModalOpen && (
        <GeneralizedSearchModal
          title={t('FilterableTable.extraSearch')}
          open={extraSearchModalOpen}
          onOpenChange={setExtraSearchModalOpen}
          searchSchema={extraSearchSchema}
          onSearch={setSearchText}
        />
      )}
      {statsOpen && (
        <FilterableTableStatsModal
          open={statsOpen}
          onOpenChange={setStatsOpen}
          items={items}
          searchSchema={extraSearchSchema}
        />
      )}
      {timelineOpen && (
        <TimelineViewerModal
          open={timelineOpen}
          onOpenChange={setTimelineOpen}
          items={items}
          searchSchema={extraSearchSchema}
        />
      )}
    </div>
  );
}

function CountLabel({
  filteredRowCount,
  totalRowCount,
  countLabelPrefix,
  minCountLabelWidth,
}: {
  readonly filteredRowCount: number;
  readonly totalRowCount: number;
  readonly countLabelPrefix: string;
  readonly minCountLabelWidth?: string | undefined;
}) {
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

function FilterableTableStatsModal<T>({
  open,
  onOpenChange,
  items,
  searchSchema,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly items: readonly T[];
  readonly searchSchema: SearchSchema<T>;
}) {
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

function TimelineViewerModal<T>({
  open,
  onOpenChange,
  items,
  searchSchema,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly items: readonly T[];
  readonly searchSchema: SearchSchema<T>;
}) {
  const { t } = useLocale();

  const [statsPropertyName, setStatsPropertyName] = useState<
    SearchPropertySchemaName<T> | undefined
  >(
    // The first property that is not a time, since a timeline built from timestamps has no series to
    // show. A schema of nothing but times leaves nothing selected, which the modal renders as empty.
    () => searchSchema.properties.find((p) => p.type !== 'dateAndTime')?.name,
  );

  const id = useId();

  const property = useMemo(() => {
    return searchSchema.properties.find((p) => p.name === statsPropertyName);
  }, [searchSchema, statsPropertyName]);

  const timeProperty = useMemo(() => {
    return searchSchema.properties.find((p) => p.type === 'dateAndTime');
  }, [searchSchema]);

  return (
    <Modal
      open={open}
      title={t('TimelineViewerModal.title')}
      onOpenChange={onOpenChange}
      noWidthRestriction
    >
      {items.length !== 0 && (
        <div className="flex flex-col gap-2 mt-4">
          <div className="flex gap-2 items-center ml-auto">
            <label htmlFor={`${id}-property-select`} className="font-bold">
              {t('TimelineViewerModal.propertySelect.label')}
            </label>
            <Select
              id={`${id}-property-select`}
              value={statsPropertyName ?? ''}
              onChange={(e) =>
                setStatsPropertyName(e.currentTarget.value as typeof statsPropertyName)
              }
            >
              {searchSchema.properties
                .filter((property) => property.type !== 'dateAndTime')
                .map((property) => (
                  <option key={property.name} value={property.name}>
                    {property.label}
                  </option>
                ))}
            </Select>
          </div>
          {property !== undefined && timeProperty !== undefined && (
            <TimelineViewer items={items} property={property} timeProperty={timeProperty} />
          )}
        </div>
      )}
    </Modal>
  );
}

function TimelineViewer<T>({
  items,
  property,
  timeProperty,
}: {
  readonly items: readonly T[];
  readonly property: SearchPropertySchema<T>;
  readonly timeProperty: SearchPropertySchema<T>;
}) {
  const { lang } = useLocale();

  const searchSchemaPropertyValueToString = useSearchSchemaPropertyValueToString<T>();

  useTheme();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasTransform, setCanvasTransform] = useState<ZoomableCanvasTransform>(
    getDefaultCanvasTransform(),
  );
  const [gridVisible, setGridVisible] = useState(true);
  const [posLabelsVisible, setPosLabelsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const chartRef = useRef<HTMLDivElement>(null);

  useFullScreenChange(setIsFullscreen);

  const seekStart = useCallback(() => {
    setCanvasTransform((transform) => ({ ...transform, offsetX: 0 }));
  }, []);

  async function toggleFullscreen() {
    try {
      await (document.fullscreenElement
        ? document.exitFullscreen()
        : chartRef.current?.requestFullscreen());
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
    }
  }

  function onTransformChange(transform: ZoomableCanvasTransform) {
    setCanvasTransform(transform);
  }

  function zoomIn() {
    const scale = clamp(canvasTransform.scale + SCALE_FACTOR, MIN_SCALE, MAX_SCALE);
    onTransformChange({ ...canvasTransform, scale });
  }

  function zoomOut() {
    const scale = clamp(canvasTransform.scale - SCALE_FACTOR, MIN_SCALE, MAX_SCALE);
    onTransformChange({ ...canvasTransform, scale });
  }

  function resetCanvasTransform() {
    setCanvasTransform(getDefaultCanvasTransform());
  }

  const chartDescriptor = useMemo(() => {
    const timeSet = new Set<number>();
    const propSet = new Set<string>();
    const timeSetPerProp: Record<string, Set<number>> = {};

    for (const item of items) {
      const prop = searchSchemaPropertyValueToString(item, property);
      const time = Number(timeProperty.extractValue(item));

      timeSet.add(time);
      propSet.add(prop);
      // Initialised here rather than read back, so the set being filled is the one stored.
      const timesForProp = timeSetPerProp[prop] ?? new Set<number>();

      timesForProp.add(time);
      timeSetPerProp[prop] = timesForProp;
    }

    const sortedTimePoints = [...timeSet].sort(cmp);

    const reverseSortedProps = [...propSet].sort((a, b) => -cmp(a, b));

    const color = formatChartHSL([42, 100, 67]);

    function getTimeStampAtX(x: number) {
      return sortedTimePoints[(x - chunkLines) / chunkLines];
    }

    const lastX = (sortedTimePoints.length - 1) * chunkLines + chunkLines;

    function propIndexToY(propIndex: number) {
      return propIndex * chunkLines + chunkLines;
    }

    function yToPropIndex(y: number) {
      return (y - chunkLines) / chunkLines;
    }

    const functionsToPlot: PlotFunctionRangeOptions[] = reverseSortedProps.map(
      (prop, propIndex) => ({
        type: 'point',
        color,
        pointSize: gridGap / 2,
        getPointY: (x) => {
          const timestamp = getTimeStampAtX(x);

          if (timestamp === undefined) {
            return undefined;
          }

          if (timeSetPerProp[prop]?.has(timestamp) !== true) {
            return undefined;
          }

          return propIndexToY(propIndex);
        },
      }),
    );

    function getXLabel(x: number): string {
      const timestamp = getTimeStampAtX(x);

      if (timestamp === undefined) {
        return '';
      }

      return formatDateAndTime(timestamp, lang);
    }

    function getYLabel(y: number): string {
      const propLabel = reverseSortedProps[yToPropIndex(y)];

      return propLabel?.toString() ?? '';
    }

    return {
      functionsToPlot,
      getXLabel,
      getYLabel,
      lastX,
    };
  }, [items, property, timeProperty, lang, searchSchemaPropertyValueToString]);

  function seekEnd() {
    setCanvasTransform((transform) => {
      const canvasWidth = canvasRef.current?.width ?? 0;
      const canvasHeight = canvasRef.current?.height ?? 0;

      const lastX = Math.max(chartDescriptor.lastX);

      const lastXCanvasRelative = chartPosToCanvasRelative(transform, canvasHeight, lastX, 0).x;

      const scaledGridGap = gridGap * transform.scale;

      const offsetX =
        lastXCanvasRelative < canvasWidth
          ? transform.offsetX
          : canvasWidth - (lastX + chunkLines) * scaledGridGap;

      return { ...transform, offsetX };
    });
  }

  const noAction = useCallback(() => {}, []);

  const toggleGrid = useCallback(() => {
    setGridVisible((visible) => !visible);
  }, []);

  const togglePosLabels = useCallback(() => {
    setPosLabelsVisible((visible) => !visible);
  }, []);

  const actionMap: KeyMapActions<ActionKey> = {
    toggleGrid,
    toggleHighlights: noAction,
    togglePosLabels,
    zoomIn,
    zoomOut,
    resetCanvasTransform,
    toggleFullscreen,
    startStopOscilloscope: noAction,
    clearChart: noAction,
    seekStart,
    seekEnd,
    seekLeft: noAction,
    seekRight: noAction,
    seekLeftLarge: noAction,
    seekRightLarge: noAction,
    goToPreviousProblem: noAction,
    goToNextProblem: noAction,
    openGoToPointDialog: noAction,
    openChartMarkerManager: noAction,
  };

  useEventListener('keydown', (e: KeyboardEvent) => {
    if (!open) {
      return;
    }
    handleKeyMapKeyDown<ActionKey>(chartViewKeyMap, actionMap, e);
  });

  return (
    <Chart
      chartRef={chartRef}
      canvasRef={canvasRef}
      canvasTransform={canvasTransform}
      onTransformChange={onTransformChange}
      functionsToPlot={chartDescriptor.functionsToPlot}
      gridVisible={gridVisible}
      setGridVisible={setGridVisible}
      posLabelsVisible={posLabelsVisible}
      setPosLabelsVisible={setPosLabelsVisible}
      zoomIn={zoomIn}
      zoomOut={zoomOut}
      resetCanvasTransform={resetCanvasTransform}
      isFullscreen={isFullscreen}
      toggleFullscreen={toggleFullscreen}
      seekStart={seekStart}
      seekEnd={seekEnd}
      getXLabel={chartDescriptor.getXLabel}
      getYLabel={chartDescriptor.getYLabel}
      className="bg-bocb relative flex-grow rounded-2xl w-screen max-w-full"
      style={{ height: 600 }}
    />
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

function useSearchSchemaPropertyValueToString<T>() {
  const { t, lang } = useLocale();

  return (item: T, property: SearchPropertySchema<T>) => {
    switch (property.type) {
      case 'boolean':
        if (property.extractValue(item)) {
          return t('yes');
        }
        return t('no');
      case 'enum':
        return getEnumLabel(property, property.extractValue(item));
      case 'string':
      case 'decimalInteger':
      case 'ip':
        return property.extractValue(item).toString();
      case 'unsignedHex':
        return formatHexNumber(property.extractValue(item), 1);
      case 'dateAndTime':
        return formatDateAndTime(property.extractValue(item), lang);
    }
  };
}

// The value an option carries when nothing has been chosen. It is a locale key, because the
// select renders it as the prompt above the list.
const notChosen = 'notChosen' as const;

type OptionalValue<T extends string> = T | typeof notChosen;

function GeneralizedSearchModal<T>({
  title,
  open,
  onOpenChange,
  searchSchema,
  onSearch,
}: {
  readonly title: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly searchSchema: SearchSchema<T>;
  readonly onSearch: (searchText: string) => void;
}) {
  const { t, lang } = useLocale();

  const [valueMap, setValueMap] = useState<Record<string, unknown>>({});

  return (
    <Modal title={title} open={open} onOpenChange={onOpenChange}>
      <div className="grid grid-cols-[auto_auto] gap-2">
        {searchSchema.properties.map((property) => (
          <div key={property.name} className="contents">
            <div>{property.label}: </div>
            <InputComponent
              property={property}
              value={valueMap[property.name]}
              onChange={(value) => {
                setValueMap((map) => ({
                  ...map,
                  [property.name]: value,
                }));
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-center items-center mt-8">
        <Button
          type="encouraging"
          title={t('actions.find')}
          onClick={() => {
            const fields: string[] = [];

            for (const property of searchSchema.properties) {
              const value = valueMap[property.name];

              if (value === undefined) {
                continue;
              }

              switch (property.type) {
                case 'string':
                  if (property.trim && (value ?? '').toString().trim() === '') {
                    continue;
                  }
                  break;
                case 'ip':
                case 'enum':
                case 'dateAndTime':
                  if ((value ?? '').toString().trim() === '') {
                    continue;
                  }
                  break;
                case 'boolean':
                  if (value === null) {
                    continue;
                  }
                  break;
                case 'decimalInteger':
                case 'unsignedHex':
                  break;
              }

              const strValue = getFilterValueAsString(property, value, lang);
              fields.push(`${escapeProp(property.name)}=${escapeProp(strValue)}`);
            }

            onSearch(fields.join(' '));
            onOpenChange(false);
          }}
        />
      </div>
    </Modal>
  );
}

function BooleanSelect({
  value,
  onChange,
}: {
  readonly value: boolean | null;
  readonly onChange: (value: boolean | null) => void;
}) {
  type OptionalBoolean = OptionalValue<'true' | 'false'>;

  const { t } = useLocale();

  function booleanToString(value: boolean | null): OptionalBoolean {
    if (value === null) {
      return notChosen;
    }

    if (value) {
      return 'true';
    }

    return 'false';
  }

  function stringToBoolean(value: OptionalBoolean) {
    switch (value) {
      case 'true': {
        return true;
      }

      case 'false': {
        return false;
      }

      case notChosen: {
        return null;
      }
    }
  }

  return (
    <Select
      style={{ width: '100%' }}
      value={booleanToString(value)}
      onChange={(e) => onChange(stringToBoolean(e.currentTarget.value as OptionalBoolean))}
    >
      <option value={notChosen}>{t(notChosen)}</option>
      <option value="true">{t('yes')}</option>
      <option value="false">{t('no')}</option>
    </Select>
  );
}

/**
 * One value an operator may filter a `enum` column by.
 *
 * `label` is rendered as given rather than looked up, because which words name a value is the
 * caller's vocabulary: a filter over device types, over connection states or over anything else
 * labels its values itself.
 */
export interface EnumOption {
  readonly value: string;
  readonly label: string;
}

/**
 * The filter control for a closed set of values.
 *
 * A value held in the data but missing from `options` is still offered, labelled with the value
 * itself, so that a caller who adds a value to their data sees it in the filter before they add it
 * here. Without that, a new value would silently be unfilterable.
 */
function EnumSelect({
  value,
  options,
  onChange,
}: {
  readonly value: string | null;
  readonly options: readonly EnumOption[];
  readonly onChange: (value: string | undefined) => void;
}) {
  const { t } = useLocale();

  const known = new Set(options.map((option) => option.value));

  const unlisted = value !== null && value !== '' && !known.has(value) ? [value] : [];

  return (
    <Select
      style={{ width: '100%' }}
      value={value ?? notChosen}
      onChange={(e) => {
        const chosen = e.currentTarget.value as OptionalValue<string>;

        if (chosen === notChosen) {
          onChange(undefined);

          return;
        }

        onChange(chosen);
      }}
    >
      <option value={notChosen}>{t(notChosen)}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
      {unlisted.map((unlistedValue) => (
        <option key={unlistedValue} value={unlistedValue}>
          {unlistedValue}
        </option>
      ))}
    </Select>
  );
}

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
function getEnumLabel(
  property: { readonly options: readonly EnumOption[] },
  value: string,
): string {
  const asString = value.toString();

  return property.options.find((option) => option.value === asString)?.label ?? asString;
}

function getFilterValueAsString<T>(
  property: AnonymousSearchPropertySchema<T>,
  value: unknown,
  lang: LocaleName,
): string {
  switch (property.type) {
    case 'enum': {
      const asString = (value ?? '').toString();

      return property.options.find((option) => option.value === asString)?.label ?? asString;
    }

    case 'dateAndTime':
      return formatDateAndTime(value as number, lang);

    default:
      return (value ?? '').toString();
  }
}

function DateAndTimeInput({
  value,
  onChange,
}: {
  readonly value: number | null;
  readonly onChange: (value: number | null) => void;
}) {
  return (
    <Input
      type="datetime-local"
      style={{ width: '100%' }}
      value={value === null ? '' : minstrftime('%FT%T', new Date(value))}
      onChange={(e) => {
        if (e.currentTarget.value === '') {
          onChange(null);
        } else {
          onChange(new Date(e.currentTarget.value).getTime());
        }
      }}
      step={1}
    />
  );
}

function filterIpCharacters(s: string) {
  return s.replace(/[^\d.]+/g, '');
}

function InputComponent<T>({
  property,
  value,
  onChange,
}: {
  readonly property: SearchPropertySchema<T>;
  readonly value: unknown;
  readonly onChange: (value: unknown) => void;
}) {
  switch (property.type) {
    case 'string': {
      return (
        <TextInput
          inputPadding="0 0.5rem"
          width="100%"
          clearIconInnerClassName="size-2"
          value={value as string}
          onChange={(e) => {
            if (property.trim) {
              onChange(e.currentTarget.value.trim());
            } else {
              onChange(e.currentTarget.value);
            }
          }}
          onClearClick={() => onChange('')}
        />
      );
    }

    case 'ip': {
      return (
        <TextInput
          inputPadding="0 0.5rem"
          width="100%"
          clearIconInnerClassName="size-2"
          value={value as string}
          onChange={(e) => onChange(filterIpCharacters(e.currentTarget.value))}
          onClearClick={() => onChange('')}
        />
      );
    }

    case 'decimalInteger': {
      return (
        <DecimalIntegerInput
          value={value as DecimalIntegerInputValue}
          minValue={Math.max(Number.MIN_SAFE_INTEGER, property.min ?? Number.MIN_SAFE_INTEGER)}
          maxValue={Math.min(Number.MAX_SAFE_INTEGER, property.max ?? Number.MAX_SAFE_INTEGER)}
          onChange={onChange}
          onClear={() => onChange(undefined)}
        />
      );
    }

    case 'boolean': {
      return <BooleanSelect value={(value ?? null) as boolean | null} onChange={onChange} />;
    }

    case 'enum': {
      return (
        <EnumSelect
          value={value === null || value === undefined ? null : String(value)}
          options={property.options}
          onChange={onChange}
        />
      );
    }

    case 'dateAndTime': {
      return <DateAndTimeInput value={(value ?? null) as number | null} onChange={onChange} />;
    }

    case 'unsignedHex': {
      return (
        <DecimalIntegerInput
          value={value as DecimalIntegerInputValue}
          minValue={Math.max(0, property.min ?? 0)}
          maxValue={Math.min(Number.MAX_SAFE_INTEGER, property.max ?? Number.MAX_SAFE_INTEGER)}
          base={16}
          onChange={onChange}
          onClear={() => onChange(undefined)}
        />
      );
    }
  }
}

export const FilterableTableContext = createContext<{
  searchText: string;
  setSearchText: React.Dispatch<React.SetStateAction<string>>;
} | null>(null);

export type AnonymousSearchPropertySchema<T> =
  | {
      type: 'string';
      default?: string | undefined;
      extractValue: (item: T) => string;
      trim?: boolean | undefined;
    }
  | {
      type: 'decimalInteger';
      default?: number | undefined;
      extractValue: (item: T) => number;
      min?: number | undefined;
      max?: number | undefined;
    }
  | {
      type: 'boolean';
      default?: boolean | null | undefined;
      extractValue: (item: T) => boolean;
    }
  | {
      type: 'enum';
      default?: string | null | undefined;
      extractValue: (item: T) => string;
      /**
       * The values the operator may filter by, and how to label each one. A column is a closed set
       * of values in every table this serves, but which set is the caller's: naming them here is
       * what lets one filter control serve device types, connection states or anything else without
       * this module knowing any of them.
       *
       * A value present in the data but absent from `options` still renders, labelled with the
       * value itself, so a new value in the caller's data is visible before it is added here.
       */
      options: readonly EnumOption[];
    }
  | {
      type: 'ip';
      default?: string | null | undefined;
      extractValue: (item: T) => string;
    }
  | {
      type: 'unsignedHex';
      default?: number | null | undefined;
      extractValue: (item: T) => number;
      min?: number | undefined;
      max?: number | undefined;
    }
  | {
      type: 'dateAndTime';
      default?: number | null | undefined;
      extractValue: (item: T) => number;
    };

export type SearchPropertySchema<T> = AnonymousSearchPropertySchema<T> & {
  name: string;
  label: string;
  hiddenInTable?: boolean | undefined;
};

export type SearchPropertySchemaType<T> =
  SearchPropertySchema<T> extends {
    type: infer U;
  }
    ? U
    : never;

export type SearchPropertySchemaName<T> =
  SearchPropertySchema<T> extends {
    name: infer U;
  }
    ? U
    : never;

export type SearchPropertySchemaExtractedValue<T> = ReturnType<
  SearchPropertySchema<T> extends { extractValue: infer U } ? U : never
>;

export interface SearchSchema<T> {
  properties: SearchPropertySchema<T>[];
}

export function buildFilterableTableSearchText(keyValueMap: Record<string, unknown>) {
  return Object.entries(keyValueMap)
    .map(([prop, value]) => `${escapeProp(prop)}=${escapeProp((value ?? '').toString())}`)
    .join(' ');
}

export function useFilteredItems<T>({
  items,
  searchText,
  searchSchema,
}: {
  readonly items: T[];
  readonly searchText: string;
  readonly searchSchema: SearchSchema<T>;
}) {
  const { lang } = useLocale();

  if (searchText === '') {
    return items;
  }

  function cleanupWhitespace(s: string) {
    return s.trim().replace(/\s+/g, ' ');
  }

  function normalize(s: string) {
    return cleanupWhitespace(s.toLowerCase());
  }

  function parsePart(part: string) {
    for (const property of searchSchema.properties) {
      const prefix = `${property.name}=`;
      const valueString = part.slice(prefix.length);

      if (!part.startsWith(prefix) || valueString === '') {
        continue;
      }

      switch (property.type) {
        case 'string': {
          if (property.trim) {
            return { property, value: valueString.trim() };
          }
          return { property, value: valueString };
        }

        case 'enum':
        case 'dateAndTime': {
          return { property, value: valueString };
        }

        case 'ip': {
          return {
            property,
            value: valueString.replace(/[^\d.]+/g, ''),
          };
        }

        case 'boolean': {
          if (valueString === 'true' || valueString === 'false') {
            return { property, value: valueString === 'true' };
          }
          return null;
        }

        case 'decimalInteger': {
          return {
            property,
            value: clamp(
              Math.floor(Number(valueString) || 0),
              Math.max(Number.MIN_SAFE_INTEGER, property.min ?? Number.MIN_SAFE_INTEGER),
              Math.min(Number.MAX_SAFE_INTEGER, property.max ?? Number.MAX_SAFE_INTEGER),
            ),
          };
        }

        case 'unsignedHex': {
          return {
            property,
            value: clamp(
              Math.floor(parseInt(valueString, 16) || 0),
              Math.max(0, property.min ?? 0),
              Math.min(Number.MAX_SAFE_INTEGER, property.max ?? Number.MAX_SAFE_INTEGER),
            ),
          };
        }
      }
    }

    return null;
  }

  const fuzzyParts: string[] = [];
  const props: {
    property: SearchPropertySchema<T>;
    value: unknown;
  }[] = [];

  // Match sequences of:
  //  - backslash + any char (escaped char),
  //  - or any non-whitespace char
  // repeated to form tokens
  const parts = (cleanupWhitespace(searchText).match(/(?:\\.|[^\s])+/g) ?? []).map((part) =>
    part.replace(/\\(.)/g, '$1'),
  );

  for (const part of parts) {
    const pair = parsePart(part);

    if (pair === null) {
      fuzzyParts.push(part);
    } else {
      props.push(pair);
    }
  }

  const fuzzy = normalize(fuzzyParts.join(' '));

  return items.filter((item) => {
    for (const { property, value } of props) {
      switch (property.type) {
        case 'string':
        case 'ip': {
          const itemValue = normalize(property.extractValue(item));
          const stringValue = normalize((value ?? '').toString());

          if (!itemValue.includes(stringValue)) {
            return false;
          }

          break;
        }

        case 'enum': {
          const itemValue = normalize(getEnumLabel(property, property.extractValue(item)));
          const stringValue = normalize((value ?? '').toString());

          if (!itemValue.includes(stringValue)) {
            return false;
          }

          break;
        }

        case 'dateAndTime': {
          const itemValue = formatDateAndTime(property.extractValue(item), lang);

          const stringValue = normalize((value ?? '').toString());

          if (!itemValue.includes(stringValue)) {
            return false;
          }

          break;
        }

        default: {
          if (property.extractValue(item) !== value) {
            return false;
          }

          break;
        }
      }
    }

    return normalize(
      searchSchema.properties
        .map((property) => {
          switch (property.type) {
            case 'enum':
              return getEnumLabel(property, property.extractValue(item));
            case 'dateAndTime':
              return formatDateAndTime(property.extractValue(item), lang);
            default:
              return property.extractValue(item);
          }
        })
        .join(' '),
    ).includes(fuzzy);
  });
}

export function formatDateAndTime(timestamp: number, lang: LocaleName) {
  return minstrftime(
    getLocaleDates(lang).formats.format,
    new Date(timestamp),
    getLocaleDates(lang).names,
  );
}

export function escapeProp(x: string | null | undefined) {
  return (x ?? '').replace(/(\\|\s)/g, '\\$1');
}
