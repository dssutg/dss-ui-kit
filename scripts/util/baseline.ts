import { writeFileSync } from 'node:fs';
import { REPOSITORY_ROOT } from './source-tree.ts';

/**
 * The shape every `update-*-baseline.ts` generator follows: write the snapshot, then hand its layout
 * to Biome.
 *
 * A baseline is generated rather than hand-written because a hand-written copy of a detector's output
 * is a second opinion about what the detector found, and the two drift. Formatting it here rather than
 * in each generator keeps `deno task format:check` passing without every generator repeating the
 * `Deno.Command` invocation, which the duplicated-code guard treats as a clone for good reason.
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
    Deno.exit(1);
  }
}

/** Formats the file that was just written, so the repository's formatter owns its layout too. */
function formatBaseline(path: string): void {
  const { code, stderr } = new Deno.Command('deno', {
    args: ['run', '-A', 'npm:@biomejs/biome', 'format', '--write', path],
    cwd: REPOSITORY_ROOT,
    stdout: 'piped',
    stderr: 'piped',
  }).outputSync();

  if (code !== 0) {
    console.error(new TextDecoder().decode(stderr));
    throw new Error('Biome could not format the baseline');
  }
}
