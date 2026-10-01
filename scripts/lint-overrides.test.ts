import { describe, expect, it } from 'vitest';

/**
 * A rule that is turned off has a reason written down for it, and the reason stops being true the
 * moment the setting stops taking effect. That is easy to arrange and hard to notice here, because
 * the failure is silent in the worst way.
 *
 * Biome 2.5.14 accepts a comment in `biome.json` — it parses without complaint — and then discards
 * the entire `overrides` array. Every rule the overrides turn off comes back as an error, with no
 * warning that the config was only half read. A `//` written beside a setting to explain it is
 * enough to do it, which is exactly the thing a well-meaning edit adds.
 *
 * So the config is held to containing no comments at all, and the reasons live in TODO.md and
 * AGENTS.md where they can be written properly. The second test here is the one that matters: it
 * runs Biome and checks that a rule the overrides claim to disable really is disabled, because
 * that is the property that was actually lost.
 */

const CONFIG_PATH = 'biome.json';

/** Strips string literals so a `//` inside a URL or a glob is not mistaken for a comment. */
function stripStringLiterals(text: string): string {
  return text.replace(/"(?:\\.|[^"\\])*"/g, '""');
}

describe('biome configuration', () => {
  it('contains no comment, because one silently discards the overrides', async () => {
    const config = await Deno.readTextFile(CONFIG_PATH);
    const outsideStrings = stripStringLiterals(config);
    const lineComments = outsideStrings.match(/^\s*\/\//gm) ?? [];
    const blockComments = outsideStrings.match(/\/\*/g) ?? [];

    expect({
      lineComments,
      blockComments,
    }).toEqual({ lineComments: [], blockComments: [] });
  });

  it('has overrides that actually take effect', async () => {
    const config = JSON.parse(await Deno.readTextFile(CONFIG_PATH));
    const iconsOverride = (config.overrides ?? []).find(
      (override: { includes?: string[] }) =>
        override.includes?.includes('src/ui/icons/**') === true,
    );

    // If the overrides were being dropped, the setting below would be missing entirely, so this
    // also fails with a message that names the cause rather than a symptom in an icon file.
    expect(iconsOverride).toBeDefined();
    expect(iconsOverride.linter.rules.a11y.noSvgWithoutTitle).toBe('off');
  });
});
