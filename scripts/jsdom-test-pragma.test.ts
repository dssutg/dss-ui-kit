// SPDX-License-Identifier: MIT
// Requires every test file that renders to ask for jsdom before its imports.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { collectFiles, REPOSITORY_ROOT } from './util/source-tree.ts';

/**
 * A test that renders asks for the DOM in the file that needs it.
 *
 * The default test environment is `node`, and a suite that walks the filesystem or builds a URL has
 * no business in a DOM emulation. A file that imports the render helper is rendering, and rendering
 * needs `document` — which is why every such file carries `// @vitest-environment jsdom` before its
 * imports. That is the one thing about the environment a reader of the file can check, and it is
 * easy to leave out when copying a test: the suite then fails with a DOM-shaped error from the
 * render helper rather than at the line that chose the wrong environment.
 *
 * The pragma has to sit before the first import, which is where Vitest reads it. The check reads the
 * syntax tree, so a mention in a comment after the imports is not a hit.
 */

/** The import specifiers of one test file. */
function moduleSpecifiers(path: string): string[] {
  const text = readFileSync(join(REPOSITORY_ROOT, path), 'utf8');
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];

  for (const statement of source.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      statement.moduleSpecifier !== undefined &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      specifiers.push(statement.moduleSpecifier.text);
    }
  }

  return specifiers;
}

/** Whether a test file renders, which is the same as importing the render helper. */
function renders(path: string): boolean {
  return moduleSpecifiers(path).some((specifier) => specifier.includes('util/testing'));
}

/** The text before the first import, which is where Vitest reads the environment pragma. */
function headerBeforeImports(path: string): string {
  const text = readFileSync(join(REPOSITORY_ROOT, path), 'utf8');
  const firstImport = text.search(/^import\s/m);

  return firstImport < 0 ? text : text.slice(0, firstImport);
}

/** The rendering test files that do not ask for the jsdom environment. */
function findMissingPragma(): string[] {
  return collectFiles('src')
    .filter((path) => path.endsWith('.test.ts') || path.endsWith('.test.tsx'))
    .filter(renders)
    .filter((path) => !headerBeforeImports(path).includes('@vitest-environment jsdom'));
}

describe('the test environment', () => {
  it('is jsdom in every test file that renders', () => {
    expect(findMissingPragma()).toEqual([]);
  });
});
