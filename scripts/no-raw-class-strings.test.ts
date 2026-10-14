// SPDX-License-Identifier: MIT
// Fails on a class attribute built by string concatenation instead of cn().

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { collectFiles, REPOSITORY_ROOT } from './util/source-tree.ts';

/**
 * A component's classes go through `cn()`, not through a template literal or a `+`.
 *
 * `cn` merges with `tailwind-merge`, so a caller's `className` wins where the two conflict. A
 * template literal or a concatenation does not merge: it appends, so which of two classes that set
 * the same property survives depends on the order they happened to be written in rather than on
 * which one the caller passed. It is the failure AGENTS.md names when it says "a caller's
 * `className` loses to the component's own".
 *
 * It also breaks the Tailwind scanner, which only sees a class that appears whole in a scanned file.
 * A class assembled from a fragment and a variable is generated for nobody and the component renders
 * unstyled in a consumer's application. So the value of a `className` attribute — and anything
 * inside the `cn(...)` call that becomes one — is checked for a template expression or a string
 * concatenation, and nothing else is read. A plain string literal and a pass-through `className` are
 * both fine; it is the *construction* of a class string that this forbids.
 *
 * The scan reads the syntax tree, not the text, so a template literal in a comment or a string that
 * is not a class name is not a hit.
 */

/** A source file whose JSX the scan reads, with its text. */
interface ScannedFile {
  readonly path: string;
  readonly text: string;
}

/** The render files the scan reads, and nothing generated or tested. */
function collectRenderFiles(): ScannedFile[] {
  return collectFiles('src')
    .filter((path) => path.endsWith('.tsx') && !path.endsWith('.test.tsx'))
    .map((path) => ({ path, text: readFileSync(join(REPOSITORY_ROOT, path), 'utf8') }));
}

/** Whether a class expression builds its string from a template or a concatenation. */
function constructsClassString(node: ts.Node): boolean {
  let found = false;

  const visit = (child: ts.Node): void => {
    if (found) {
      return;
    }
    if (ts.isTemplateExpression(child)) {
      found = true;
      return;
    }
    if (ts.isBinaryExpression(child) && child.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      found = true;
      return;
    }

    ts.forEachChild(child, visit);
  };

  visit(node);

  return found;
}

/** The expression a JSX attribute was initialised with, or `null` when it has none. */
function initializerExpression(initializer: ts.JsxAttribute['initializer']): ts.Expression | null {
  if (initializer === undefined) {
    return null;
  }
  if (ts.isJsxExpression(initializer)) {
    return initializer.expression ?? null;
  }

  return initializer;
}

/** Every `className` built by concatenation or a template in the given files, as `path:line`. */
function findRawClassStrings(files: readonly ScannedFile[]): string[] {
  const offenders: string[] = [];

  for (const { path, text } of files) {
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);

    const visit = (node: ts.Node): void => {
      if (ts.isJsxAttribute(node) && node.name.getText(source) === 'className') {
        const expression = initializerExpression(node.initializer);

        if (expression !== null && constructsClassString(expression)) {
          const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

          offenders.push(`${path}:${line}: className built from a template or a concatenation`);
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(source);
  }

  return offenders;
}

describe('class name construction', () => {
  it('builds every className through cn() rather than a template or a concatenation', () => {
    expect(findRawClassStrings(collectRenderFiles())).toEqual([]);
  });
});
