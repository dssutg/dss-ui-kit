import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { collectFiles, REPOSITORY_ROOT } from './source-tree.ts';

/**
 * Finds the TypeScript type assertions in the library's own source.
 *
 * AGENTS.md treats a cast as a claim the author could not prove — "narrow the input instead, or make
 * the function return the type you actually meant" — and Biome catches the two casts that are always
 * wrong, `any` and `!`, while an `as` is invisible to it. This is the detector behind
 * `scripts/no-type-assertions.test.ts`, which holds the count per file to a baseline: a new cast
 * fails, and a baseline entry whose casts were removed fails too, so the acceptance cannot outlive
 * the code.
 *
 * `as const` is not a cast: it widens nothing and silences no check, so it is left out. Only
 * `src/**` is read, and only the non-test files in it: the policy is about the code that ships, not
 * the fixtures that exercise it.
 */

/** The extensions the detector parses. Assertions live in TypeScript, not in CSS or a catalogue. */
const SOURCE_EXTENSIONS = ['.ts', '.tsx'];

/** One `as` or `<T>` assertion, located so a report can name it. */
export interface TypeAssertion {
  readonly path: string;
  readonly line: number;
  readonly text: string;
}

/** Whether a repository-relative path is library source the detector should read. */
function isLibrarySource(path: string): boolean {
  if (path.endsWith('.test.ts') || path.endsWith('.test.tsx')) {
    return false;
  }

  return SOURCE_EXTENSIONS.some((extension) => path.endsWith(extension));
}

/** The type assertions in one source file, in the order they appear. */
function assertionsIn(path: string, text: string): TypeAssertion[] {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const assertions: TypeAssertion[] = [];

  const visit = (node: ts.Node): void => {
    if (node.kind === ts.SyntaxKind.AsExpression) {
      const expression = node as ts.AsExpression;
      // `as const` narrows a literal to its literal type; it is not a claim about a wider type.
      if (expression.type.getText(source) !== 'const') {
        assertions.push(locationOf(expression, path, source));
      }
    } else if (node.kind === ts.SyntaxKind.TypeAssertionExpression) {
      assertions.push(locationOf(node, path, source));
    }

    ts.forEachChild(node, visit);
  };

  visit(source);

  return assertions;
}

function locationOf(node: ts.Node, path: string, source: ts.SourceFile): TypeAssertion {
  return {
    path,
    line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
    text: node.getText(source).replace(/\s+/g, ' ').slice(0, 80),
  };
}

/** Every type assertion in the library's own source. */
export function collectTypeAssertions(): TypeAssertion[] {
  return collectFiles('src')
    .filter(isLibrarySource)
    .flatMap((path) => assertionsIn(path, readFileSync(join(REPOSITORY_ROOT, path), 'utf8')));
}

/** The number of type assertions per file, with files that hold none left out. */
export function countTypeAssertionsByFile(): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const assertion of collectTypeAssertions()) {
    counts[assertion.path] = (counts[assertion.path] ?? 0) + 1;
  }

  return counts;
}
