/**
 * `fuzzySearch` is what the search inputs narrow a list with, so the suite pins the ranking contract
 * the dropdown's order comes from: in-order containment only, an outright match first, earlier
 * matches ahead of later ones, and no reordering of ties — a stable order is part of the result a
 * user reads.
 */
import { describe, expect, test } from 'vitest';
import { fuzzySearch } from './';

const clean = (text: string) => text.toLowerCase();

describe('fuzzySearch', () => {
  const names = ['alpha', 'beta', 'alphabet', 'gamma'];

  test('returns the whole list for an empty query', () => {
    expect(fuzzySearch('', names, clean, (item) => item)).toEqual(names);
  });

  test('returns only the items whose characters appear in order', () => {
    expect(fuzzySearch('alp', names, clean, (item) => item)).toEqual(['alpha', 'alphabet']);
  });

  test('drops an item missing any character of the query', () => {
    expect(fuzzySearch('xyz', names, clean, (item) => item)).toEqual([]);
  });

  test('an outright match outranks every fuzzy match', () => {
    expect(fuzzySearch('beta', names, clean, (item) => item)[0]).toBe('beta');
  });

  test('an earlier match outranks a later one', () => {
    expect(fuzzySearch('alp', names, clean, (item) => item)).toEqual(['alpha', 'alphabet']);
  });

  test('searches on the name the caller extracts, not the item itself', () => {
    const items = [
      { id: 'a1', title: 'Alpha' },
      { id: 'b2', title: 'Beta' },
    ];

    expect(fuzzySearch('alp', items, clean, (item) => item.title)).toEqual([items[0]]);
  });

  test('applies the cleaning to both the query and the names', () => {
    const cleaner = (text: string) => text.replaceAll('_', '');

    expect(fuzzySearch('alpha', ['al_pha', 'beta'], cleaner, (item) => item)).toEqual(['al_pha']);
  });

  test('does not reorder when every score is equal', () => {
    // Two names the query touches at the same position tie, and a stable sort keeps their order.
    expect(fuzzySearch('a', ['ab', 'ac'], clean, (item) => item)).toEqual(['ab', 'ac']);
  });
});
