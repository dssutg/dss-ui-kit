import { minstrftime } from '@/lib/date';
import type { LocaleDates } from '@/locale';

/** The formats a filtered table can be exported as. Each is written by the caller, not by the table. */
export type FilterableTableExportFormat = 'pdf' | 'html' | 'csv' | 'json';

/**
 * Chooses the filename an export is downloaded under, given the format and the file extension for it.
 *
 * A callback because the filename is the caller's: it knows what the table is a list of and when it was
 * exported, and a library that invented a name would produce `table-1.csv` in someone's downloads.
 */
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
