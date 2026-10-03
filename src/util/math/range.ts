import { cmp } from './scalar';

export interface Range {
  start: number;
  end: number;
}

// This function returns a sorted list in ascending order of merged ranges
export function mergeRanges<T extends Range>(ranges: readonly T[]): T[] {
  // Sort the ranges based on `start`
  const sortedRanges = ranges.toSorted((a, b) => cmp(a.start, b.start));

  let merged: T[] = [];

  for (const range of sortedRanges) {
    const lastMerge = merged[merged.length - 1];

    // If merged is empty or the current range does not overlap with the last one, add it
    if (lastMerge === undefined || lastMerge.end < range.start) {
      merged = [...merged, range];
    } else {
      // There is an overlap, so merge the current range with the last one
      lastMerge.end = Math.max(lastMerge.end, range.end);
    }
  }

  return merged;
}

export function mergeIntegers(array: readonly number[]): Range[] {
  const sorted = array.toSorted((a, b) => cmp(a, b));
  const [first, ...rest] = sorted;

  if (first === undefined) {
    return [];
  }

  let merged: Range[] = [];

  let start = first;
  let end = first;

  for (const element of rest) {
    if (element !== end + 1) {
      merged = [...merged, { start, end }];
      start = element;
    }

    end = element;
  }

  merged = [...merged, { start, end }];

  return merged;
}
