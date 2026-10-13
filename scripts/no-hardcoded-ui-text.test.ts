import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { collectFiles, REPOSITORY_ROOT } from './util/source-tree.ts';

/**
 * User-facing text is a locale key, not a literal in a component.
 *
 * The `no-russian-text` guard keeps Russian out of components, but English pasted straight into a
 * component is just as unlocalisable: it is a string no translator can reach and no second language
 * can display. A key that exists in `en.tsx` and not in `ru.tsx` is already a type error, so the one
 * gap is a literal that never became a key at all. This closes it for the two shapes a literal takes
 * where a person reads it directly: the text between JSX tags, and the value of an attribute whose
 * content is the accessible name — `aria-label` and its kin, `title`, `placeholder` and `alt`.
 *
 * The scan reads the syntax tree, not the text, so a string in a comment is not a hit, and only the
 * *static* part of a value is judged: `` `${value}%` `` has no letters that need a key and is left
 * alone, while `\`Saturation ${value}%\`` is caught on the word it hard-codes. A literal passed
 * through a variable, or rendered by an expression the scan cannot see through, is outside what a
 * deterministic check can reach; this is the net over the direct cases, and it starts empty.
 */

/** The attributes whose value a person reads: an accessible name or a prompt. */
const TEXT_ATTRIBUTES = [
  'alt',
  'aria-description',
  'aria-label',
  'aria-placeholder',
  'aria-roledescription',
  'aria-valuetext',
  'placeholder',
  'title',
];

/** Any letter, in any script, so punctuation and units are not mistaken for text. */
const LETTER = /\p{L}/u;

/** A source file the scan reads, with its text. */
interface ScannedFile {
  readonly path: string;
  readonly text: string;
}

/** The files whose JSX the scan reads: the components that render, and nothing generated or tested. */
function collectComponentFiles(): ScannedFile[] {
  return collectFiles('src')
    .filter((path) => path.endsWith('.tsx') && !path.endsWith('.test.tsx'))
    .map((path) => ({ path, text: readFileSync(join(REPOSITORY_ROOT, path), 'utf8') }));
}

/** The static text of a JSX attribute value, or `null` when it is not a literal the scan can read. */
function staticAttributeText(initializer: ts.JsxAttribute['initializer']): string | null {
  if (initializer === undefined) {
    return null;
  }

  const expression = ts.isJsxExpression(initializer) ? initializer.expression : initializer;

  if (expression === undefined) {
    return null;
  }
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text;
  }
  if (ts.isTemplateExpression(expression)) {
    return [
      expression.head.text,
      ...expression.templateSpans.map((span) => span.literal.text),
    ].join('');
  }

  return null;
}

/** The hard-coded text one syntax node holds, or `null` when the node is not user-facing text. */
function offenderAt(
  node: ts.Node,
  line: number,
  path: string,
  source: ts.SourceFile,
): string | null {
  if (ts.isJsxText(node) && LETTER.test(node.text)) {
    return `${path}:${line}: JSX text ${JSON.stringify(node.text.trim())}`;
  }
  if (ts.isJsxAttribute(node) && TEXT_ATTRIBUTES.includes(node.name.getText(source))) {
    const value = staticAttributeText(node.initializer);
    if (value !== null && LETTER.test(value)) {
      return `${path}:${line}: ${node.name.getText(source)}=${JSON.stringify(value)}`;
    }
  }

  return null;
}

/** Every hard-coded, user-facing string in the given files, as `path:line: value`. */
function findHardcodedText(files: readonly ScannedFile[]): string[] {
  const offenders: string[] = [];

  for (const { path, text } of files) {
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);

    const visit = (node: ts.Node): void => {
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      const offender = offenderAt(node, line, path, source);

      if (offender !== null) {
        offenders.push(offender);
      }

      ts.forEachChild(node, visit);
    };

    visit(source);
  }

  return offenders;
}

describe('hard-coded UI text', () => {
  it('renders every label through a locale key', () => {
    expect(findHardcodedText(collectComponentFiles())).toEqual([]);
  });
});
