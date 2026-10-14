// SPDX-License-Identifier: MIT
// Fails on a preact import specifier, which would bypass the react compat alias.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { collectFiles, REPOSITORY_ROOT } from './util/source-tree.ts';

/**
 * The library imports the React API, and Preact resolves it through the compat layer.
 *
 * `react`, `react-dom` and their subpaths are aliased onto `preact/compat` by the bundler and the
 * type checker (see `vite.config.ts` and `tsconfig.json`), so the source says `react` and the runtime
 * is Preact. A statement that imports `preact/...` directly is the change AGENTS.md warns against:
 * it is a different reading from the one every other file uses, it can resolve to a different module
 * instance than the aliased one, and in a consumer's bundle it is how a second Preact enters the
 * graph and breaks hooks. So no `preact` specifier is imported anywhere under `src/`.
 *
 * The scan reads the syntax tree, so the alias in a comment or a string is not a hit. `jest.config`,
 * `vite.config` and the other tooling files are outside `src/` and are not read: they are not part
 * of the package.
 */

/** The import and `export ... from` specifiers of one source file. */
function moduleSpecifiers(path: string): string[] {
  const text = readFileSync(join(REPOSITORY_ROOT, path), 'utf8');
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, false);
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

/** Every `preact` specifier imported under `src/`, as `path: specifier`. */
function findPreactImports(): string[] {
  const offenders: string[] = [];

  for (const path of collectFiles('src')) {
    if (!path.endsWith('.ts') && !path.endsWith('.tsx')) {
      continue;
    }

    for (const specifier of moduleSpecifiers(path)) {
      if (specifier === 'preact' || specifier.startsWith('preact/')) {
        offenders.push(`${path}: ${specifier}`);
      }
    }
  }

  return offenders;
}

describe('the Preact compat layer', () => {
  // The scan parses the whole of `src/` in one test. In a plain run that is under two seconds; in
  // the coverage run the other workers instrumenting `src/` compete for cores with it and the same
  // scan has been seen to take over ten. The budget is for that contention, not an excuse for a
  // hung test: a genuinely stuck scan still fails the suite, just later.
  it('is reached through the React alias, never by importing preact directly', {
    timeout: 30_000,
  }, () => {
    expect(findPreactImports()).toEqual([]);
  });
});
