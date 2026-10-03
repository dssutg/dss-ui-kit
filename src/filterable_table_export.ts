import { minstrftime } from '@/lib/date';
import type { LocaleDates } from '@/locale';

export type FilterableTableExportFormat = 'pdf' | 'html' | 'csv' | 'json';

export type GetExportedTableFilenameCallback = ({
  format,
  extension,
}: {
  readonly format: FilterableTableExportFormat;
  readonly extension: string;
}) => string;

/** A timestamp in the format the active locale writes dates in. */
export function formatDateAndTime(timestamp: number, dates: LocaleDates): string {
  return minstrftime(dates.formats.format, new Date(timestamp), dates.names);
}

export function escapeProp(x: string | null | undefined) {
  return (x ?? '').replace(/(\\|\s)/g, '\\$1');
}
