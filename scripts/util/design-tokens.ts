import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { collectFiles, REPOSITORY_ROOT } from './source-tree.ts';

/**
 * Reads the `--color-*` custom properties a theme file declares.
 *
 * The token map in `src/tailwind_preset.ts` and the theme files have to name the same set of
 * properties, and the set a release ships is part of the package's contract, so the reading lives
 * here rather than in the test alone: `design-tokens.test.ts` compares it, and
 * `update-design-token-baseline.ts` records it.
 */

/** The one theme file that defines every token; the others are partial overrides. */
export const COMPLETE_THEME = 'src/css/themes/dark.css';

/** Every `--color-*` custom property a theme file declares, without the prefix. */
export function themeTokens(path: string): string[] {
  const text = readFileSync(join(REPOSITORY_ROOT, path), 'utf8');

  return [...text.matchAll(/--color-([a-z0-9-]+)\s*:/g)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );
}

/**
 * The tokens the other themes override, so a token removed from the complete theme and left behind
 * in a partial one is reported rather than silently dropped from the comparison.
 */
export function partialThemeTokens(): string[] {
  const complete = new Set(themeTokens(COMPLETE_THEME));

  return collectFiles('src/css/themes')
    .filter((path) => path !== COMPLETE_THEME)
    .flatMap(themeTokens)
    .filter((token) => !complete.has(token));
}

/** Every token the package declares, from the complete theme and the partial overrides, sorted. */
export function declaredTokens(): string[] {
  return [...new Set([...themeTokens(COMPLETE_THEME), ...partialThemeTokens()])].sort();
}
