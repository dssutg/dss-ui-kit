#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env
// SPDX-License-Identifier: MIT
// Checks the public API declares its types, by running the JSR no-slow-types rule.

import { JSR_JSON, writeJsrConfig } from './publish.ts';
import { REPOSITORY_ROOT } from './util/source-tree.ts';

/**
 * Checks that every symbol of the public API declares its type, by running JSR's own rule.
 *
 * A package JSR serves as source has to be statically analyzable: a function reachable from
 * `src/index.ts` whose return type is inferred is a "slow type", and the registry refuses it. That
 * check is what `deno publish` runs, and it is the only reason a publish belongs in the pipeline —
 * the upload itself is the maintainer's. So this runs the rule alone, against the same generated
 * `jsr.json` a publish uses for its imports map.
 *
 * `--rules-tags=` clears the recommended rule set and `--rules-include=no-slow-types` adds the one
 * rule back, because Deno's linter is otherwise disabled in this repository (see `deno.json`) and its
 * other rules would report on files the library does not intend to lint. The rule follows re-exports
 * from the entry, so a violation in a component is reported where it sits.
 */

function main(): void {
  writeJsrConfig();

  const { code } = new Deno.Command('deno', {
    args: [
      'lint',
      '--rules-tags=',
      '--rules-include=no-slow-types',
      '-c',
      JSR_JSON,
      'src/index.ts',
    ],
    cwd: REPOSITORY_ROOT,
    stdout: 'inherit',
    stderr: 'inherit',
  }).outputSync();

  if (code !== 0) {
    Deno.exit(code);
  }
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(`\n✖ ${error instanceof Error ? error.message : String(error)}`);
    Deno.exit(1);
  }
}
