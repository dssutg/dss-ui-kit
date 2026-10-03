import { cmp } from '@/lib/math';

/** The score of an item that matched at least one character of the query. */
const HIGHEST_SCORE = Infinity;

/** The score of an item that did not match. It sorts below every match and is never returned. */
const LOWEST_SCORE = -1;

/**
 * How well `itemName` answers `cleanQuery`: every character of the query appears in order, and an
 * earlier or tighter match scores higher.
 *
 * An item that contains the query outright scores above every fuzzy match, because a caller
 * searching for a field name almost always wants the field with that name rather than one whose
 * letters happen to appear in that order. An item missing any character of the query scores
 * {@link LOWEST_SCORE} and the caller drops it.
 */
function scoreItem(itemName: string, cleanQuery: string): number {
  if (itemName.includes(cleanQuery)) {
    return HIGHEST_SCORE;
  }

  let score = 0;
  let matchIndex = 0;

  for (const char of cleanQuery) {
    matchIndex = itemName.indexOf(char, matchIndex);

    if (matchIndex === -1) {
      return LOWEST_SCORE;
    }

    score = score + 1 - matchIndex / itemName.length;
    matchIndex = matchIndex + 1;
  }

  return score;
}

/**
 * Filters a list by whether the query's characters appear in each item's name, in order but not
 * adjacently.
 *
 * The caller's `cleanString` is applied to both sides, which is where the differences between
 * languages are handled: case folding, and stripping the accents a search box may not carry, are
 * decisions about the caller's data rather than about this comparison. Items come back in score
 * order — a name the query matches from its start outranks one that matches at the end — and an empty
 * query returns the list untouched rather than everything scored.
 */
export function fuzzySearch<T>(
  query: string,
  array: readonly T[],
  cleanString: (queryOrItemName: string) => string,
  getItemName: (item: T) => string,
): readonly T[] {
  const cleanQuery = cleanString(query);

  if (cleanQuery === '') {
    return array;
  }

  const results: { item: T; score: number }[] = [];

  for (const item of array) {
    const score = scoreItem(cleanString(getItemName(item)), cleanQuery);

    if (score !== LOWEST_SCORE) {
      results.push({ item, score });
    }
  }

  // Sort results based on score (higher score means better match)
  // and return only items (not the scores).
  return results.sort((a, b) => -cmp(a.score, b.score)).map((result) => result.item);
}
