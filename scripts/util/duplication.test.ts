// SPDX-License-Identifier: MIT
// Tests the clone detector the duplicated-code guard runs.

import { describe, expect, it } from 'vitest';
import type { SourceFile } from './duplication.ts';
import { findDuplicateBlocks } from './duplication.ts';

/**
 * The detector behind the duplicated-code guard is the one piece of `scripts/` that has to be right
 * for the guard to mean anything, so it is tested against small in-memory sources rather than only
 * against the tree it happens to find clones in.
 *
 * The minimum is passed explicitly and kept low so a block the tests can read is still above it. The
 * default threshold is a property of the repository's tree, not of the algorithm.
 */

/** A six-statement block, thirty tokens long, comfortably above the minimum the tests pass. */
const BLOCK = [
  'const first = 1;',
  'const second = 2;',
  'const third = 3;',
  'const fourth = 4;',
  'const fifth = 5;',
  'const sixth = 6;',
].join('\n');

const MIN = 10;

function file(path: string, text: string): SourceFile {
  return { path, text };
}

describe('findDuplicateBlocks', () => {
  it('reports a block written identically in two files', () => {
    const blocks = findDuplicateBlocks([file('a.ts', BLOCK), file('b.ts', BLOCK)], MIN);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.locations.map((location) => location.path)).toEqual(['a.ts', 'b.ts']);
  });

  it('ignores a match shorter than the minimum', () => {
    const blocks = findDuplicateBlocks([file('a.ts', BLOCK), file('b.ts', BLOCK)], 100);

    expect(blocks).toEqual([]);
  });

  it('sees through comments and formatting', () => {
    const commented = [
      '// The leading comment is trivia.',
      'const first = 1;',
      '',
      '/* so is this block comment */',
      'const second = 2;   const third = 3;',
      'const fourth = 4;',
      'const fifth = 5;',
      'const sixth = 6;',
    ].join('\n');
    const blocks = findDuplicateBlocks([file('a.ts', BLOCK), file('b.ts', commented)], MIN);

    expect(blocks).toHaveLength(1);
  });

  it('reports a block repeated within one file', () => {
    const text = `${BLOCK}\n\ncallSomething();\n\n${BLOCK}\n`;
    const blocks = findDuplicateBlocks([file('a.ts', text)], MIN);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.locations).toHaveLength(2);
  });

  it('reports a maximal block once rather than once per overlapping window', () => {
    const blocks = findDuplicateBlocks([file('a.ts', BLOCK), file('b.ts', BLOCK)], MIN);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.tokenCount).toBe(30);
  });

  it('groups every copy of a block into one report', () => {
    const blocks = findDuplicateBlocks(
      [file('a.ts', BLOCK), file('b.ts', BLOCK), file('c.ts', BLOCK)],
      MIN,
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.locations.map((location) => location.path)).toEqual(['a.ts', 'b.ts', 'c.ts']);
  });

  it('does not report code that merely looks alike', () => {
    const other = [
      'const alpha = 7;',
      'const beta = 8;',
      'const gamma = 9;',
      'const delta = 10;',
      'const epsilon = 11;',
      'const zeta = 12;',
    ].join('\n');
    const blocks = findDuplicateBlocks([file('a.ts', BLOCK), file('b.ts', other)], MIN);

    expect(blocks).toEqual([]);
  });

  it('identifies a clone by content and files, not by line number', () => {
    const shifted = `// A new leading comment shifts every line below it.\n\n${BLOCK}\n`;
    const before = findDuplicateBlocks([file('a.ts', BLOCK), file('b.ts', BLOCK)], MIN);
    const after = findDuplicateBlocks([file('a.ts', shifted), file('b.ts', BLOCK)], MIN);

    expect(after[0]?.signature).toBe(before[0]?.signature);
    expect(after[0]?.locations[0]?.startLine).toBeGreaterThan(
      before[0]?.locations[0]?.startLine ?? 0,
    );
  });
});
