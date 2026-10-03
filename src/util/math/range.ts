import { cmp } from './scalar';

/**
 * A span of numbers from `start` to `end`, inclusive on both ends.
 *
 * The bounds are inclusive so that a single element — one selected row, one found index — is a valid
 * range rather than an empty one; {@link mergeIntegers} relies on that when it folds a run of
 * integers into ranges.
 */
export interface Range {
  start: number;
  end: number;
}

/**
 * Merges ranges that touch or overlap, returning the result sorted in ascending order.
 *
 * Touching counts as overlapping (`[1, 3]` and `[3, 5]` become `[1, 5]`) because the bounds are
 * inclusive and a shared bound is the same position, so two ranges meeting at it are one span, not
 * two. The input is sorted first, so the caller's order does not matter; the result is a flat list,
 * never a range spanning a gap between two disjoint inputs.
 *
 * The merged ranges are the input range objects, not copies, so the first of each overlap is
 * mutated: a caller reusing its input afterwards is passing objects whose `end` has moved.
 */
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

/**
 * Folds a set of integers into ranges of consecutive runs, ascending.
 *
 * `1, 2, 3, 7, 9, 10` becomes `[1..3], [7..7], [9..10]` — the shape a "selected rows" note renders
 * as, which a long list of one-by-one numbers is too noisy to read. The input is sorted first, so
 * the caller's order does not matter.
 *
 * Gap detection is strict adjacency: a single missing integer splits the run (`1, 2, 4` is
 * `[1..2], [4..4]`), and duplicates are not removed — a repeated value closes the run it lands in
 * and starts a new one that overlaps it, so the input is expected to be free of duplicates. An
 * empty input answers an empty list rather than throwing.
 */
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
