import { cn } from '@/util/cn';

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
  readonly className?: string | undefined;
}

/**
 * The label showing how many rows a table is showing out of how many it holds.
 *
 * See {@link CountLabelProps} for why the wording is the caller's and why the total disappears when
 * nothing is filtered.
 */
export function CountLabel({
  filteredRowCount,
  totalRowCount,
  countLabelPrefix,
  minCountLabelWidth,
  className,
}: CountLabelProps): React.JSX.Element {
  return (
    <div
      className={cn('p-2 bg-bpl rounded-lg truncate flex-grow sm:flex-grow-0', className)}
      style={{ minWidth: minCountLabelWidth }}
    >
      {filteredRowCount === totalRowCount
        ? `${countLabelPrefix}: ${filteredRowCount}`
        : `${countLabelPrefix}: ${filteredRowCount} / ${totalRowCount}`}
    </div>
  );
}
