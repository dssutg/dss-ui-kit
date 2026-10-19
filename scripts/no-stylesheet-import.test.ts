// SPDX-License-Identifier: MIT
// Keeps the public surface free of a stylesheet import.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { REPOSITORY_ROOT } from './util/source-tree.ts';

/**
 * The public surface carries no stylesheet import.
 *
 * The CSS is a build of its own (`vite.css.config.ts` → `dist/dss-ui-kit.css`), reached through the
 * `dss-ui-kit/style.css` subpath: a script-tag consumer loads it separately, and a bundler consumer
 * decides whether to import it. A side-effect `import '...css'` added here would make the order the
 * stylesheet loads in significant, a decision the caller owns. So the absence is a property of the
 * file, and it is checked rather than left to the comment above it.
 *
 * Comments are not imports, which is why this reads the syntax tree rather than the text: the module
 * documents the subpath it deliberately does not import in its own TSDoc.
 */

/** The `import` and `export ... from` specifiers of a source file. */
function moduleSpecifiers(path: string): string[] {
  const text = readFileSync(join(REPOSITORY_ROOT, path), 'utf8');
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];

  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  };

  visit(source);

  return specifiers;
}

describe('the global stylesheet', () => {
  it('is not imported by the public surface', () => {
    expect(
      moduleSpecifiers('src/index.ts').filter((specifier) => specifier.endsWith('.css')),
    ).toEqual([]);
  });
});
