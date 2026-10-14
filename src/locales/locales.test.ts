/**
 * The locale data files: the shipped catalogues and dates, and the language endonyms. The catalogues
 * are exercised through `locale.test.tsx`; this file reaches the parts no component calls yet — the
 * relative-phrase functions in the shipped `dates` — so the data is not covered only where a
 * component happens to render it.
 */
import { describe, expect, it } from 'vitest';
import { en, enDates } from '@/locales/en';
import { langNames } from '@/locales/lang-names';
import { ru, ruDates } from '@/locales/ru';

describe('the shipped catalogues', () => {
  it('hold the same keys, so a missing translation is not an empty label', () => {
    expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort());
  });
});

describe('the English relative phrases', () => {
  it('builds each phrase', () => {
    const { relative } = enDates;

    expect(relative.daysAgo(3)).toBe('3 days ago');
    expect(relative.yesterday).toBe('yesterday');
    expect(relative.hoursAgo(3)).toBe('3 hours ago');
    expect(relative.oneHourAgo).toBe('1 hour ago');
    expect(relative.minutesAgo(3)).toBe('3 minutes ago');
    expect(relative.oneMinuteAgo).toBe('a minute ago');
    expect(relative.secondsAgo(3)).toBe('3 seconds ago');
    expect(relative.justThen).toBe('just then');
    expect(relative.inSeconds(3)).toBe('in 3 seconds');
    expect(relative.inOneMinute).toBe('in a minute');
    expect(relative.inMinutes(3)).toBe('in 3 minutes');
    expect(relative.inOneHour).toBe('in 1 hour');
    expect(relative.inHours(3)).toBe('in 3 hours');
    expect(relative.tomorrow).toBe('tomorrow');
    expect(relative.inDays(3)).toBe('in 3 days');
  });
});

describe('the Russian relative phrases', () => {
  it('builds each phrase with the count it was given', () => {
    const { relative } = ruDates;

    // Asserted through the count rather than the wording, because the wording is Russian and this
    // file is outside the two the Cyrillic check allows. Each function interpolates its argument, so
    // the count appearing is what says the body ran.
    expect(relative.daysAgo(3)).toContain('3');
    expect(relative.hoursAgo(3)).toContain('3');
    expect(relative.minutesAgo(3)).toContain('3');
    expect(relative.secondsAgo(3)).toContain('3');
    expect(relative.inSeconds(3)).toContain('3');
    expect(relative.inMinutes(3)).toContain('3');
    expect(relative.inHours(3)).toContain('3');
    expect(relative.inDays(3)).toContain('3');

    for (const phrase of [
      relative.yesterday,
      relative.oneHourAgo,
      relative.oneMinuteAgo,
      relative.justThen,
      relative.inOneMinute,
      relative.inOneHour,
      relative.tomorrow,
    ]) {
      expect(typeof phrase).toBe('string');
    }
  });
});

describe('the language names', () => {
  it('names a language by the endonym a speaker recognises', () => {
    expect(langNames.en).toBe('English');
    expect(langNames.fr).toBe('Français');
    expect(langNames.de).toBe('Deutsch');
  });
});
