// SPDX-License-Identifier: MIT
// Keeps generated build output out of the Git index.

import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { REPOSITORY_ROOT } from './util/source-tree.ts';

/**
 * Generated output is built, never committed.
 *
 * `docs/api/` is written by TypeDoc, `jsr.json` by the publish script and `dist/` by the bundle;
 * each is derived from the source and each is listed in `.gitignore`. A `git add -f` or a fresh
 * clone that carries one anyway is a copy that drifts from the thing that produces it — the failure
 * the gitignore comment names ("never committed, so it cannot drift"). A `.gitignore` only filters
 * an add; it does not remove a file that is already tracked, so the list of tracked files is what is
 * checked here rather than the patterns.
 *
 * The check is `git ls-files` against the repository root, which is the only authority on what a
 * clone carries.
 */

/** Generated directories that must never be tracked. */
const GENERATED_DIRECTORIES = [
  '.deno/',
  '.vite/',
  'coverage/',
  'dist/',
  'docs/api/',
  'node_modules/',
];

/** Generated files that must never be tracked. */
const GENERATED_FILES = ['jsr.json'];

/** Every file Git tracks in this repository. */
function trackedFiles(): string[] {
  const output = execFileSync('git', ['ls-files'], { cwd: REPOSITORY_ROOT, encoding: 'utf8' });

  return output.split('\n').filter((path) => path !== '');
}

/** The tracked paths that are generated output. */
function findTrackedGenerated(): string[] {
  return trackedFiles()
    .filter(
      (path) =>
        GENERATED_FILES.includes(path) ||
        GENERATED_DIRECTORIES.some((directory) => path.startsWith(directory)) ||
        path.endsWith('.tsbuildinfo'),
    )
    .sort();
}

describe('generated output', () => {
  it('is not tracked by Git', () => {
    expect(findTrackedGenerated()).toEqual([]);
  });
});
