#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run
import { join } from 'node:path';
import { runBaseline, writeBaseline } from './util/baseline.ts';
import { REPOSITORY_ROOT } from './util/source-tree.ts';
import { countTypeAssertionsByFile } from './util/type-assertions.ts';

/**
 * Regenerates `scripts/type-assertion-baseline.json`, the per-file assertion counts the guard
 * accepts.
 *
 * Run it through `deno task type-assertions:baseline`. The baseline is a snapshot of the casts that
 * exist today, so `scripts/no-type-assertions.test.ts` fails on a new one without failing on the ones
 * already in the tree; accepting a cast lowers or raises a single number, and deduplicating a file's
 * casts retires the entry.
 */

const BASELINE_PATH = join(REPOSITORY_ROOT, 'scripts', 'type-assertion-baseline.json');

/** Sorted by path so the file reads in the order a person scans it and a diff stays minimal. */
function sorted(counts: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(counts).sort(([first], [second]) => (first < second ? -1 : 1)),
  );
}

function main(): void {
  const baseline = sorted(countTypeAssertionsByFile());

  writeBaseline(BASELINE_PATH, baseline);

  console.log(
    `Recorded ${Object.values(baseline).reduce((sum, count) => sum + count, 0)} accepted assertions in ${BASELINE_PATH}`,
  );
}

if (import.meta.main) {
  runBaseline(main);
}
