import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectFiles, REPOSITORY_ROOT } from './util/source-tree.ts';

/**
 * The interface is localised, and localisation is the one thing this project does not leave to
 * discipline: the library ships in Russian *and* in English, so a translator has to be able to find
 * every string, and a Russian phrase pasted straight into a component is a string no translator can
 * reach and no second language can display.
 *
 * The rule this checks is therefore the strict form of the convention: Russian prose lives in
 * `src/locales/ru.tsx` and nowhere else, and everything else holds message keys — the only other
 * files that may carry Cyrillic are the ones holding data about a language itself, listed with
 * their reason below. It is checked here rather than left to review — this runs as part of
 * `deno task ci`.
 */

/** Extensions of the files a reader of this repository opens as text. */
const TEXT_EXTENSIONS = ['.css', '.html', '.json', '.md', '.ts', '.tsx', '.yaml', '.yml'];

/**
 * Files that are allowed to contain Cyrillic text, each for a stated reason.
 *
 * `ru.tsx` is the point: it is the catalogue a translator works from, so it is the one file that
 * exists to hold Russian. Every other exemption has to name data rather than prose — an exemption
 * with nothing in it is a hole waiting for the first paste.
 *
 * `lang-names.ts` holds endonyms keyed by ISO 639-1 code, so Abkhaz, Avar, Belarusian and the rest
 * are written in the script those languages are written in. That is a fact about a language, not a
 * phrase a translator reaches, and transliterating it would break the one thing the table is for.
 */
const ALLOWED_FILES = ['src/locales/ru.tsx', 'src/locales/lang-names.ts'];

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
  it('keeps Russian prose in the locale file and nowhere else', () => {
    expect(findRussianText()).toEqual([]);
  });
});
