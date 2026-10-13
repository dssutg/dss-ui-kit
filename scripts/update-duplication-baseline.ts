#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env
import { join } from 'node:path';
import { runBaseline, writeBaseline } from './util/baseline.ts';
import type { DuplicateBlock } from './util/duplication.ts';
import { collectSourceFiles, findDuplicateBlocks } from './util/duplication.ts';
import { REPOSITORY_ROOT } from './util/source-tree.ts';

/**
 * Regenerates `scripts/duplication-baseline.json`, the clones the duplicated-code guard accepts.
 *
 * Run it through `deno task duplication:baseline`. The baseline is a snapshot of the duplication
 * that exists today, so the guard in `scripts/duplicated-code.test.ts` fails on a new clone without
 * failing on the ones already in the tree; adding to it is how a clone is accepted, and removing a
 * line that has been deduplicated is how an acceptance is retired.
 */

const BASELINE_PATH = join(REPOSITORY_ROOT, 'scripts', 'duplication-baseline.json');

/** One accepted clone as it is stored: its identity, its length and the files that share it. */
interface BaselineEntry {
  readonly files: readonly string[];
  readonly tokens: number;
  readonly signature: string;
}

function entryOf(block: DuplicateBlock): BaselineEntry {
  return {
    files: [...new Set(block.locations.map((location) => location.path))].sort(),
    tokens: block.tokenCount,
    signature: block.signature,
  };
}

function compareEntries(first: BaselineEntry, second: BaselineEntry): number {
  return (
    first.files.join('\n').localeCompare(second.files.join('\n')) ||
    first.tokens - second.tokens ||
    first.signature.localeCompare(second.signature)
  );
}

function main(): void {
  const entries = findDuplicateBlocks(collectSourceFiles()).map(entryOf).sort(compareEntries);

  writeBaseline(BASELINE_PATH, entries);

  console.log(`Recorded ${entries.length} accepted duplicate blocks in ${BASELINE_PATH}`);
}

runBaseline(main);
