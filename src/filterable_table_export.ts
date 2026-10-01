import { minstrftime } from '@/lib/date';
import { getLocaleDates, type LocaleName } from '@/locale';

export type FilterableTableExportFormat = 'pdf' | 'html' | 'csv' | 'json';

export type GetExportedTableFilenameCallback = ({
  format,
  extension,
}: {
  readonly format: FilterableTableExportFormat;
  readonly extension: string;
}) => string;

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
