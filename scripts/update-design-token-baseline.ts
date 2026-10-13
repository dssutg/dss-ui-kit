#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run
import { join } from 'node:path';
import { runBaseline, writeBaseline } from './util/baseline.ts';
import { declaredTokens } from './util/design-tokens.ts';
import { REPOSITORY_ROOT } from './util/source-tree.ts';

/**
 * Regenerates `scripts/design-token-baseline.json`, the tokens a release already shipped.
 *
 * Run it through `deno task design-tokens:baseline`. The baseline is what lets
 * `scripts/design-tokens.test.ts` tell adding a token from renaming one: the map and the theme files
 * can be renamed in step and still agree with each other, so only a snapshot from before the rename
 * can notice. Updating it is how a token is added, and the missing-name failure it produces is how a
 * rename is caught.
 */

const BASELINE_PATH = join(REPOSITORY_ROOT, 'scripts', 'design-token-baseline.json');

function main(): void {
  const tokens = declaredTokens();

  writeBaseline(BASELINE_PATH, tokens);

  console.log(`Recorded ${tokens.length} shipped tokens in ${BASELINE_PATH}`);
}

runBaseline(main);
