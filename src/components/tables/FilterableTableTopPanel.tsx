import { createRoot } from 'preact/compat/client';
import { StrictMode, useMemo, useState } from 'react';
import { SearchInput } from '@/components/inputs/SearchInput';
import { DropDownMenu } from '@/components/overlays/DropDownMenu';
import { copyToClipboard } from '@/lib/dom';
import { serializeCSV } from '@/lib/dsv';
import { downloadStringAsPlainTextFile } from '@/lib/file';
import { formatHexNumber } from '@/lib/format_number';
import { unreachable } from '@/lib/unreachable';
import { useLocale } from '@/locale';
import { getEnumLabel } from './ControlledTable';
import { CountLabel } from './CountLabel';
import { FilterableTableStatsModal } from './FilterableTableStatsModal';
import { GeneralizedSearchModal } from './GeneralizedSearchModal';
import { TimelineViewerModal } from './TimelineViewerModal';
import { formatDateAndTime, type GetExportedTableFilenameCallback } from './table_export';
import type { SearchSchema } from './use_filtered_items';

export type { EnumOption } from './GeneralizedSearchModal';

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
  const { t, dates } = useLocale();

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
                return formatDateAndTime(property.extractValue(item), dates);
              case 'unsignedHex':
                return formatHexNumber(property.extractValue(item), 1);
              case 'boolean':
                if (property.extractValue(item)) {
                  return t('yes');
                }
                return t('no');

              // The switch covers every member of `SearchPropertySchema`, and this says so: adding one
              // is a type error here rather than a blank cell in the exported CSV.
              default:
                return unreachable(property);
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
                          {formatDateAndTime(property.extractValue(item), dates)}
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
