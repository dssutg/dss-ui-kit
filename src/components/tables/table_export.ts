import type { LocaleDates } from '@/locale';
import { minstrftime } from '@/util/date';

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

/**
 * Escapes the characters that would break a `name=value` search term apart: whitespace separates one
 * term from the next, and a backslash quotes the character after it. A name or value holding either
 * is rewritten so it stays one token once the terms are joined with spaces. `null` and `undefined`
 * mean no value and become the empty string.
 */
export function escapeProp(x: string | null | undefined) {
  return (x ?? '').replace(/(\\|\s)/g, '\\$1');
}
