import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { colorTokens, uiKitPreset } from '@/tailwind_preset';
import { collectFiles, REPOSITORY_ROOT } from './util/source-tree.ts';

/**
 * The token map and the theme files have to describe the same set of custom properties.
 *
 * `src/tailwind_preset.ts` is the map a consuming application imports, and `src/css/themes/dark.css`
 * is the only file that defines every `--color-*` property. Nothing makes the two agree: a token added
 * to the CSS and not to the map compiles, builds, passes every other test and produces a class name
 * that resolves to nothing in a consumer's stylesheet — an unstyled component, discovered in someone
 * else's application. A token left in the map after its property is deleted is the same defect in the
 * other direction, and it is the one that survives a rename, because renaming a property leaves the
 * old map entry pointing at a variable nothing defines.
 *
 * So the two sets are compared rather than trusted; how many tokens exist is not asserted at all,
 * because a count in a test is one more line to edit every time the palette changes and buys no
 * guarantee the comparison above does not already give.
 */

/** The one theme file that defines every token; the others are partial overrides. */
const COMPLETE_THEME = 'src/css/themes/dark.css';

/** Every `--color-*` custom property a theme file declares, without the prefix. */
function themeTokens(path: string): string[] {
  const text = readFileSync(join(REPOSITORY_ROOT, path), 'utf8');

  return [...text.matchAll(/--color-([a-z0-9-]+)\s*:/g)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );
}

/**
 * The tokens the other four themes override, so a token removed from the complete theme and left
 * behind in a partial one is reported rather than silently dropped from the comparison.
 */
function partialThemeTokens(): string[] {
  const complete = new Set(themeTokens(COMPLETE_THEME));

  return collectFiles('src/css/themes')
    .filter((path) => path !== COMPLETE_THEME)
    .flatMap(themeTokens)
    .filter((token) => !complete.has(token));
}

describe('design tokens', () => {
  it('maps every custom property the complete theme declares', () => {
    const missing = themeTokens(COMPLETE_THEME).filter(
      (token) => !Object.hasOwn(colorTokens, token),
    );

    expect(missing).toEqual([]);
  });

  it('maps nothing the theme files do not declare', () => {
    // A name that is not a valid identifier has to be read with brackets, so the entries are
    // collected as pairs rather than reached through the index type.
    const declared = new Set([...themeTokens(COMPLETE_THEME), ...partialThemeTokens()]);

    const stale = Object.keys(colorTokens).filter((token) => !declared.has(token));

    expect(stale).toEqual([]);
  });

  it('names each custom property in its own entry', () => {
    // `{ bda: 'var(--color-bda)' }` is what makes the class name and the variable one fact. A value
    // pointing at a different property is a token that looks right in the config and is not.
    const mismatched = Object.entries(colorTokens).filter(
      ([token, value]) => value !== `var(--color-${token})`,
    );

    expect(mismatched).toEqual([]);
  });

  it('leaves no custom property behind in a partial theme', () => {
    expect(partialThemeTokens()).toEqual([]);
  });
});

/**
 * An animation utility a component renders has to be declared by the preset for the reason a colour
 * does: `.animate-ripple` is generated only if the config names it, and a class nothing declares is
 * a component that renders without its animation in every consuming application — here, a circle
 * that appears at full size and vanishes instead of one that expands.
 *
 * `Ripple` is the component this was found on, so it is the one named here; another component that
 * renders `animate-*` without a declaration belongs in the same list.
 */
describe('animation utilities', () => {
  it('declares an animation for the utility Ripple renders', () => {
    const source = readFileSync(
      join(REPOSITORY_ROOT, 'src/components/feedback/Ripple.tsx'),
      'utf8',
    );
    const rendered = [...source.matchAll(/animate-([a-z0-9-]+)/g)].flatMap((match) =>
      match[1] === undefined ? [] : [match[1]],
    );

    expect(rendered.length).toBeGreaterThan(0);

    const declared = Object.keys(uiKitPreset.theme.extend.animation);

    expect(rendered.filter((name) => !declared.includes(name))).toEqual([]);
  });
});
