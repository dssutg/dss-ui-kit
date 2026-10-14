// SPDX-License-Identifier: MIT
// Verifies every source file opens with the MIT SPDX identifier and a purpose comment.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectFiles, REPOSITORY_ROOT } from './util/source-tree.ts';

/**
 * The license statement every source file carries.
 *
 * `LICENSE` and the `license` field of `package.json` state what the library is licensed under, but
 * a file that travels on its own — into a dependency's vendor tree, into a source scan, into a line
 * of a published package — carries nothing but itself. The SPDX identifier is what a scanner reads,
 * so it is the first line of every file the repository writes, and a purpose comment under it says
 * what the file is for before the file says anything else.
 *
 * "Strict" is literal here: the identifier is matched as an exact string, and it is only accepted
 * as the first content line of the file (after the one shebang the script files carry). A variant
 * spelling, a mid-file duplicate or a file that starts with code fails this test.
 */

/** The exact SPDX line a TypeScript file opens with. */
const TS_SPDX = '// SPDX-License-Identifier: MIT';

/** The exact SPDX line a CSS file opens with. */
const CSS_SPDX = '/* SPDX-License-Identifier: MIT */';

/** The license package.json declares, which the header has to match. */
const DECLARED_LICENSE = 'MIT';

/** Whether a repository-relative path is a source file the header rule applies to. */
function isLicensedSource(path: string): boolean {
  if (path.endsWith('.ts') || path.endsWith('.tsx')) {
    return path.startsWith('src/') || path.startsWith('scripts/') || !path.includes('/');
  }

  return path.endsWith('.css') && path.startsWith('src/');
}

/** The SPDX line the file at the given path has to open with. */
function spdxLineOf(path: string): string {
  return path.endsWith('.css') ? CSS_SPDX : TS_SPDX;
}

/** Whether the line is a tool directive, which states nothing about the file it sits in. */
function isDirective(line: string): boolean {
  return line.startsWith('// @');
}

/**
 * Walks the lines below the SPDX line, answering whether a purpose comment comes before the code.
 *
 * Any comment opener is a purpose statement — a module docblock and a leading line comment are
 * equally the file describing itself. A tool directive does not count: `// @vitest-environment
 * jsdom` selects a test environment and describes that, not the file. The walk stops at the first
 * line that is neither blank nor a comment: that line is code, and too late for a description.
 */
function hasPurposeComment(lines: readonly string[], start: number): boolean {
  for (let index = start; index < lines.length; index++) {
    const line = lines[index]!.trim();

    if (line === '') {
      continue;
    }

    if (line.startsWith('/*')) {
      return true;
    }

    if (line.startsWith('//')) {
      if (!isDirective(line)) {
        return true;
      }
      continue;
    }

    return false;
  }

  return false;
}

/** The violations of the header rule one file has. */
function headerViolations(path: string): string[] {
  const spdx = spdxLineOf(path);
  const lines = readFileSync(join(REPOSITORY_ROOT, path), 'utf8').split('\n');

  let index = 0;
  if (lines[index]?.startsWith('#!')) {
    index++;
  }

  if (lines[index] !== spdx) {
    return [
      `${path}: opens with ${JSON.stringify(lines[index])} instead of the SPDX line "${spdx}"`,
    ];
  }

  return hasPurposeComment(lines, index + 1)
    ? []
    : [`${path}: has no purpose comment before its first code`];
}

/** The violations over the whole tree, so the failure message lists every file at once. */
function findHeaderViolations(): string[] {
  return collectFiles().filter(isLicensedSource).flatMap(headerViolations);
}

describe('the MIT license header', () => {
  it('is carried by every source file, with a purpose comment', () => {
    expect(findHeaderViolations()).toEqual([]);
  });

  it('is the license package.json declares', () => {
    const manifest = JSON.parse(readFileSync(join(REPOSITORY_ROOT, 'package.json'), 'utf8')) as {
      license: string;
    };

    expect(manifest.license).toBe(DECLARED_LICENSE);
  });
});
