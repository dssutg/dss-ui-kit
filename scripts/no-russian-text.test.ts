import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectFiles, REPOSITORY_ROOT } from './lib/source-tree.ts';

/**
 * The interface is localised, and localisation is the one thing this project does not leave to
 * discipline: the library ships in Russian *and* in English, so a translator has to be able to find
 * every string, and a Russian phrase pasted straight into a component is a string no translator can
 * reach and no second language can display.
 *
 * The rule this checks is therefore the strict form of the convention: Russian text lives in
 * `src/locales/ru.tsx` and nowhere else, and everything else holds message keys. It is checked here
 * rather than left to review — this runs as part of `deno task ci`.
 */

/** Extensions of the files a reader of this repository opens as text. */
const TEXT_EXTENSIONS = ['.css', '.html', '.json', '.md', '.ts', '.tsx', '.yaml', '.yml'];

/**
 * Files that are allowed to contain Russian text, each for a stated reason.
 *
 * The locale is the point. The glossary in `AGENTS.md` names the Russian domain terms the
 * component and message-key vocabulary inherits, and it has to be able to spell them. Nothing else
 * is exempt — not the README, not the changelog, not a component.
 */
const ALLOWED_FILES = ['src/locales/ru.tsx', 'AGENTS.md'];

/** Any Cyrillic letter, in any of the languages written in it. */
const CYRILLIC = /\p{Script=Cyrillic}/u;

/** The first Cyrillic letter in a text, so a failure names the character and not just the file. */
function firstCyrillicLetter(text: string): string {
  return CYRILLIC.exec(text)?.[0] ?? '';
}

/** Every text file that contains a Cyrillic letter and is not allowed to. */
function findRussianText(): string[] {
  const offenders: string[] = [];

  for (const path of collectFiles()) {
    if (!TEXT_EXTENSIONS.some((extension) => path.endsWith(extension))) continue;
    if (ALLOWED_FILES.includes(path)) continue;

    const text = readFileSync(join(REPOSITORY_ROOT, path), 'utf8');
    const line = text.split('\n').find((candidate) => CYRILLIC.test(candidate));

    if (line !== undefined) {
      offenders.push(`${path}: ${line.trim()} (${firstCyrillicLetter(line)})`);
    }
  }

  return offenders;
}

describe('repository policy', () => {
  it('keeps Russian text in the locale file and the glossary only', () => {
    expect(findRussianText()).toEqual([]);
  });
});
