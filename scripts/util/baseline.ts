// SPDX-License-Identifier: MIT
// The one writer every baseline generator shares, so snapshots are formatted alike.

import { writeFileSync } from 'node:fs';
import { runCommand } from './run-command.ts';

/**
 * The shape every `update-*-baseline.ts` generator follows: write the snapshot, then hand its layout
 * to Biome.
 *
 * A baseline is generated rather than hand-written because a hand-written copy of a detector's output
 * is a second opinion about what the detector found, and the two drift. Formatting it here rather than
 * in each generator keeps `npm run format:check` passing without every generator repeating the
 * subprocess invocation, which the duplicated-code guard treats as a clone for good reason.
 */

/** Writes `value` to `path` as JSON with a trailing newline, then formats it with Biome. */
export function writeBaseline(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  formatBaseline(path);
}

/**
 * Runs a baseline generator's `main`, reporting an error and turning it into a non-zero exit.
 *
 * Whether the generator is the program being run is the caller's own fact: `import.meta.main` inside
 * this helper names this helper, which is never the entry point, so a gate held here returned early
 * every time and every generator silently wrote nothing. The generator gates with its own
 * `import.meta.main` before calling.
 */
export function runBaseline(main: () => void): void {
  try {
    main();
  } catch (error) {
    console.error(`\n✖ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/** Formats the file that was just written, so the repository's formatter owns its layout too. */
function formatBaseline(path: string): void {
  try {
    runCommand('biome', ['format', '--write', path]);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    throw new Error('Biome could not format the baseline');
  }
}
