#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DuplicateBlock } from './util/duplication.ts';
import { collectSourceFiles, findDuplicateBlocks } from './util/duplication.ts';
import { REPOSITORY_ROOT } from './util/source-tree.ts';

/**
 * Regenerates `scripts/duplication-baseline.json`, the clones the duplicated-code guard accepts.
 *
 * Run it through `deno task duplication:baseline`. The baseline is a snapshot of the duplication
 * that exists today, so the guard in `scripts/duplicated-code.test.ts` fails on a new clone without
 * failing on the ones already in the tree; adding to it is how a clone is accepted, and removing a
 * line that has been deduplicated is how an acceptance is retired. It is generated rather than
 * hand-written because a hand-written copy of the detector's output is a second opinion about what
 * the detector found, and the two would drift.
 *
 * The output is formatted with Biome afterwards, because Biome owns formatting everywhere else —
 * including this file — and a generator that left its own output unformatted would fail
 * `deno task format:check` on the next run.
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

/** Formats the baseline that was just written, so the repository's formatter owns its layout too. */
function formatBaseline(): void {
  const { code, stderr } = new Deno.Command('deno', {
    args: ['run', '-A', 'npm:@biomejs/biome', 'format', '--write', BASELINE_PATH],
    cwd: REPOSITORY_ROOT,
    stdout: 'piped',
    stderr: 'piped',
  }).outputSync();

  if (code !== 0) {
    console.error(new TextDecoder().decode(stderr));
    throw new Error('Biome could not format the baseline');
  }
}

function main(): void {
  const entries = findDuplicateBlocks(collectSourceFiles()).map(entryOf).sort(compareEntries);

  writeFileSync(BASELINE_PATH, `${JSON.stringify(entries, null, 2)}\n`);
  formatBaseline();

  console.log(`Recorded ${entries.length} accepted duplicate blocks in ${BASELINE_PATH}`);
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(`\n✖ ${error instanceof Error ? error.message : String(error)}`);
    Deno.exit(1);
  }
}
