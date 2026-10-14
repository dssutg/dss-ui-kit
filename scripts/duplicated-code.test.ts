// SPDX-License-Identifier: MIT
// Fails on a source block the duplication baseline does not already record.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CloneLocation, DuplicateBlock } from './util/duplication.ts';
import { collectSourceFiles, findDuplicateBlocks } from './util/duplication.ts';
import { REPOSITORY_ROOT } from './util/source-tree.ts';

/**
 * Duplicated logic is the one defect a code review is worst at: the reader sees the copy in front of
 * them and not the copy three directories away, and the cost lands on whoever changes the fact next.
 * AGENTS.md states the rule — a fact needed in two places belongs in one place — and this is the
 * mechanical half of it, running as part of `deno task ci`.
 *
 * The finding is about the repository's own code and about exact repetition. The detector tokenizes
 * with the TypeScript scanner, so a reformat or a comment does not hide a clone, but two functions
 * that only look alike are not one. `src/icons/index.tsx`, the test files and the CSS data are left
 * out — an icon that shares a curve with another is data, not logic.
 *
 * A strict guard cannot ship, because the tree already holds clones; accepting them one by one in
 * `scripts/duplication-baseline.json` is what turns "there is duplication" into "there is no *new*
 * duplication". The two tests below are the two directions that keeps honest: a clone that is not
 * accepted fails, and an acceptance that no longer matches anything fails too, so an entry cannot
 * outlive the code it names.
 */

/** The accepted clones, keyed by the block identity `findDuplicateBlocks` gives each one. */
const BASELINE_PATH = join(REPOSITORY_ROOT, 'scripts', 'duplication-baseline.json');

interface BaselineEntry {
  readonly files: readonly string[];
  readonly tokens: number;
  readonly signature: string;
}

const CURRENT = findDuplicateBlocks(collectSourceFiles());
const BASELINE = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as readonly BaselineEntry[];

/** `path:line`, the shortest way to name where a copy sits. */
function locationOf(location: CloneLocation): string {
  return `${location.path}:${location.startLine}`;
}

/** A report line that names every copy of a block and how long it is. */
function describeBlock(block: DuplicateBlock): string {
  const places = block.locations.map(locationOf).join(', ');

  return `${block.tokenCount} tokens at ${places}`;
}

function describeEntry(entry: BaselineEntry): string {
  return `${entry.tokens} tokens in ${entry.files.join(', ')}`;
}

describe('duplicated code', () => {
  it('introduces no block of code that is already written elsewhere', () => {
    const accepted = new Set(BASELINE.map((entry) => entry.signature));
    const added = CURRENT.filter((block) => !accepted.has(block.signature)).map(describeBlock);

    expect(added).toEqual([]);
  });

  it('keeps no accepted clone that is no longer duplicated', () => {
    const found = new Set(CURRENT.map((block) => block.signature));
    const stale = BASELINE.filter((entry) => !found.has(entry.signature)).map(describeEntry);

    expect(stale).toEqual([]);
  });
});
