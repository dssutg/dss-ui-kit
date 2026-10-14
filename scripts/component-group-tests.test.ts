// SPDX-License-Identifier: MIT
// Requires every component group to ship at least one render test.

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectFiles, REPOSITORY_ROOT } from './util/source-tree.ts';

/**
 * Every component group ships with at least one render test.
 *
 * A component group is a directory under `src/components/`, and the rule is the one AGENTS.md states:
 * "every component group with at least one render test". It is easy to add a group and forget the
 * test, and the failure is silent — the suite stays green because it never looked. So the directory
 * list is the source of the claim and the check is a comparison, not a review: a new group with no
 * `*.test.tsx` fails here, and the failure names the group rather than a missing assertion somewhere.
 *
 * What the test does is the group's business; that one exists is this test's.
 */

/** The name of every directory under `src/components/`. */
function componentGroups(): string[] {
  return readdirSync(join(REPOSITORY_ROOT, 'src/components'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** Whether a group directory holds at least one render test. */
function hasRenderTest(group: string): boolean {
  return collectFiles(`src/components/${group}`).some((path) => path.endsWith('.test.tsx'));
}

describe('component groups', () => {
  it('each have at least one render test', () => {
    const untested = componentGroups().filter((group) => !hasRenderTest(group));

    expect(untested).toEqual([]);
  });
});
