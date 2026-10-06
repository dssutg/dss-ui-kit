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

/** What the first group of `pattern` matches in `text`, dropping a group that did not participate. */
function captured(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)].flatMap((match) => (match[1] === undefined ? [] : [match[1]]));
}

/**
 * The stylesheet a consumer gets, assembled the way `src/css/index.css` assembles it: the entry
 * itself plus every file its `@import` lines name. A file that nothing imports does not ship, so it
 * is not read here either.
 */
function stylesheetSource(): string {
  const entry = readFileSync(join(REPOSITORY_ROOT, 'src/css/index.css'), 'utf8');
  const imported = captured(entry, /@import\s+"\.\/([^"]+)"/g).map((path) =>
    readFileSync(join(REPOSITORY_ROOT, 'src/css', path), 'utf8'),
  );

  return [entry, ...imported].join('\n');
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
 * An animation utility a component renders has to be declared by the package for the reason a
 * colour does: `.animate-ripple` is generated only if the config names it, and a class nothing
 * declares is a component that renders without its animation in every consuming application — a
 * spinner that does not spin, a circle that appears at full size and vanishes instead of one that
 * expands.
 *
 * Every source file is scanned rather than one component, so a component that starts rendering an
 * undeclared animation is caught where it is written instead of when someone notices it not moving.
 * A declaration lives in one of two places: the preset, which makes it a utility a content scan
 * finds, or the stylesheet, which makes it a rule every importer gets.
 */
describe('animation utilities', () => {
  /**
   * The animations Tailwind declares itself. The preset extends the default theme rather than
   * replacing it, so these survive without an entry here and belong in this comparison.
   */
  const TAILWIND_ANIMATIONS = ['bounce', 'ping', 'pulse', 'spin'];

  /** Every `animate-*` utility name the sources render, without the prefix. */
  function renderedAnimations(): Set<string> {
    const source = collectFiles('src')
      .filter((path) => path.endsWith('.ts') || path.endsWith('.tsx'))
      .map((path) => readFileSync(join(REPOSITORY_ROOT, path), 'utf8'))
      .join('\n');

    return new Set(captured(source, /animate-([a-z0-9-]+)/g));
  }

  /** Every `.animate-*` rule the stylesheet declares by hand, without the prefix. */
  function handwrittenAnimations(): string[] {
    return captured(stylesheetSource(), /\.animate-([a-z0-9-]+)\s*\{/g);
  }

  it('declares every animation utility the sources render', () => {
    const rendered = renderedAnimations();

    expect(rendered.size).toBeGreaterThan(0);

    const declared = [
      ...Object.keys(uiKitPreset.theme.extend.animation),
      ...TAILWIND_ANIMATIONS,
      ...handwrittenAnimations(),
    ];

    expect([...rendered].filter((name) => !declared.includes(name))).toEqual([]);
  });

  it('runs each animation the preset declares under a keyframe of the same name', () => {
    // The value is the animation shorthand, so the keyframe it names is what the class resolves to;
    // a renamed keyframe leaves the class declared, generated and doing nothing.
    const keyframes = new Set(Object.keys(uiKitPreset.theme.extend.keyframes));
    const declared = Object.keys(uiKitPreset.theme.extend.animation).filter(
      (name) => !TAILWIND_ANIMATIONS.includes(name),
    );

    expect(declared.filter((name) => !keyframes.has(name))).toEqual([]);
  });

  it('pairs every hand-written animation with the keyframe it runs', () => {
    // The first token of an `animation` shorthand is the keyframe it names. Both directions are
    // compared: an animation with no keyframe does nothing, and a keyframe nothing runs is dead CSS
    // in every stylesheet that ships it.
    const stylesheet = stylesheetSource();
    const running = captured(stylesheet, /animation:\s*([a-z-]+)/g);
    const defined = captured(stylesheet, /@keyframes\s+([a-z-]+)/g);

    expect(running.length).toBeGreaterThan(0);

    expect(running.filter((name) => !defined.includes(name))).toEqual([]);
    expect(defined.filter((name) => !running.includes(name))).toEqual([]);
  });
});
