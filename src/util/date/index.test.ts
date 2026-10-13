/**
 * The date helpers feed form fields and clock renders, so the suite holds the pieces the components
 * assemble UI from: 1-based field components, the strftime subset `minstrftime` implements with its
 * padding specifiers, the duration formatters that answer an unknown-time placeholder rather
 * than throwing on absent input, and the relative-date wording a locale supplies for both
 * directions of a time difference.
 */
import { describe, expect, test } from 'vitest';
import {
  type DateLocale,
  defaultDateNames,
  formatMillisecondsAsHM,
  formatMillisecondsAsHMSU,
  formatRelativeDate,
  getDateComponents,
  getMillisecondsAsHMSUComponents,
  hours24to12,
  isNowAfter,
  minstrftime,
} from './';

describe('getDateComponents', () => {
  test('splits a date into form fields with the month 1-based', () => {
    const components = getDateComponents(new Date(2024, 0, 15, 10, 30, 45));

    expect(components).toEqual({
      year: 2024,
      month: 1,
      day: 15,
      hours: 10,
      minutes: 30,
      seconds: 45,
    });
  });

  test('reports December as month twelve, not eleven', () => {
    expect(getDateComponents(new Date(2024, 11, 31)).month).toBe(12);
  });
});

describe('hours24to12', () => {
  test('converts a 24-hour clock into 12-hour plus am/pm', () => {
    expect(hours24to12(0)).toEqual({ hours: 12, ampm: 'am' });
    expect(hours24to12(9)).toEqual({ hours: 9, ampm: 'am' });
    expect(hours24to12(12)).toEqual({ hours: 12, ampm: 'pm' });
    expect(hours24to12(13)).toEqual({ hours: 1, ampm: 'pm' });
    expect(hours24to12(23)).toEqual({ hours: 11, ampm: 'pm' });
  });
});

/**
 * The format is whatever a format string asks for, and the contract includes what it does not do:
 * an unknown specifier survives as written rather than being swallowed, because a format the library
 * does not know is a caller's string, not its own.
 */
describe('minstrftime', () => {
  // Fixed so the output is stable; 2024-01-05 was a Friday.
  const date = new Date(2024, 0, 5, 14, 7, 9);

  test('formats a date with %F', () => {
    expect(minstrftime('%F', date)).toBe('2024-01-05');
  });

  test('formats a time with %T and %R', () => {
    expect(minstrftime('%T', date)).toBe('14:07:09');
    expect(minstrftime('%R', date)).toBe('14:07');
  });

  test('formats a 12-hour clock with %I and %p', () => {
    expect(minstrftime('%r', date)).toBe('02:07:09 PM');
  });

  test('formats a numeric date with %D', () => {
    expect(minstrftime('%D', date)).toBe('01/05/24');
  });

  test('writes the weekday number with %w', () => {
    expect(minstrftime('%w', date)).toBe('5');
  });

  test('writes the lower-case half-day with %P', () => {
    expect(minstrftime('%P', date)).toBe('pm');
  });

  test('writes epoch seconds and the raw millisecond timestamp with %s and %u', () => {
    // A UTC-anchored date keeps both expectations independent of the machine's time zone.
    const fixed = new Date('2024-01-05T14:07:09Z');

    expect(minstrftime('%s', fixed)).toBe('1704463629');
    expect(minstrftime('%u', fixed)).toBe('1704463629000');
  });

  test('pads with zeroes by default and not at all with the - specifier', () => {
    expect(minstrftime('%d', date)).toBe('05');
    expect(minstrftime('%-d', date)).toBe('5');
  });

  test('pads with zeroes by an explicitly written 0 specifier', () => {
    // `%0d` selects the zero-padding handler outright instead of falling through the default.
    expect(minstrftime('%0d', date)).toBe('05');
  });

  test('pads with spaces with the _ specifier', () => {
    expect(minstrftime('%_d', date)).toBe(' 5');
  });

  test('writes names from the locale it is given', () => {
    expect(minstrftime('%A %B', date)).toBe('Friday January');
    expect(minstrftime('%a %b', date)).toBe('Fri Jan');
  });

  test('takes a different name set', () => {
    const names = {
      weekdayNames: ['nedele', 'pondeli', 'utery', 'streda', 'ctvrtek', 'patek', 'sobota'],
      monthNames: [
        'leden',
        'unor',
        'brezen',
        'duben',
        'kveten',
        'cerven',
        'cervenec',
        'srpen',
        'zari',
        'rijen',
        'listopad',
        'prosinec',
      ],
    };

    expect(minstrftime('%A %B', date, names)).toBe('patek leden');
  });

  test('writes a literal percent with %%', () => {
    expect(minstrftime('%%', date)).toBe('%');
  });

  test('writes a tab with %t', () => {
    expect(minstrftime('%t', date)).toBe('\t');
  });

  test('leaves an unknown specifier as it was written', () => {
    expect(minstrftime('%Q', date)).toBe('%Q');
  });

  test('leaves a bare percent at the end of the format as it was written', () => {
    expect(minstrftime('100%', date)).toBe('100%');
  });

  test('degrades a name outside the name arrays to empty rather than failing', () => {
    // A malformed locale is not allowed to stop a clock from rendering.
    expect(minstrftime('%A', date, { weekdayNames: [], monthNames: [] })).toBe('');
    expect(minstrftime('%B', date, { weekdayNames: [], monthNames: [] })).toBe('');
  });
});

describe('defaultDateNames', () => {
  test('carries a name for every weekday and month', () => {
    expect(defaultDateNames.weekdayNames).toHaveLength(7);
    expect(defaultDateNames.monthNames).toHaveLength(12);
  });
});

describe('getMillisecondsAsHMSUComponents', () => {
  test('splits milliseconds into padded fields', () => {
    expect(getMillisecondsAsHMSUComponents(3_723_005)).toEqual({
      hh: '01',
      mm: '02',
      ss: '03',
      uuu: '005',
    });
  });

  test('returns null for absent or non-numeric input', () => {
    expect(getMillisecondsAsHMSUComponents(undefined)).toBeNull();
    expect(getMillisecondsAsHMSUComponents(Number.NaN)).toBeNull();
  });
});

/**
 * The duration formatters render stopwatches and timers, where a measurement that has not arrived
 * yet still has to show something stable instead of `NaN` in the middle of a panel.
 */
describe('formatMillisecondsAsHMSU', () => {
  test('formats with milliseconds by default', () => {
    expect(formatMillisecondsAsHMSU(61_002)).toBe('00:01:01.002');
  });

  test('formats without milliseconds when they are not wanted', () => {
    expect(formatMillisecondsAsHMSU(61_002, { millisecondsShown: false })).toBe('00:01:01');
  });

  test('formats absent input as an unknown time rather than throwing', () => {
    expect(formatMillisecondsAsHMSU(undefined)).toBe('??:??:??.???');
    expect(formatMillisecondsAsHMSU(undefined, { millisecondsShown: false })).toBe('??:??:??');
  });
});

describe('formatMillisecondsAsHM', () => {
  test('formats minutes and seconds only', () => {
    expect(formatMillisecondsAsHM(61_002)).toBe('00:01');
  });

  test('formats absent input as an unknown time rather than throwing', () => {
    expect(formatMillisecondsAsHM(undefined)).toBe('??:??');
  });
});

describe('isNowAfter', () => {
  test('answers whether a moment is already past', () => {
    expect(isNowAfter('2000-01-01T00:00:00Z')).toBe(true);
  });

  test('rejects an unparseable target rather than answering wrongly', () => {
    expect(() => isNowAfter('not a date')).toThrow('Invalid target date');
  });
});

/**
 * A locale with a distinct phrase per step, so each assertion names the exact step the interval
 * selected and a boundary that landed on the wrong one cannot hide behind a near miss.
 */
const relativeLocale: DateLocale = {
  daysAgo: (days) => `${days}d ago`,
  yesterday: 'yesterday',
  hoursAgo: (hours) => `${hours}h ago`,
  oneHourAgo: 'an hour ago',
  minutesAgo: (minutes) => `${minutes}m ago`,
  oneMinuteAgo: 'a minute ago',
  secondsAgo: (seconds) => `${seconds}s ago`,
  justThen: 'just then',
  inSeconds: (seconds) => `in ${seconds}s`,
  inOneMinute: 'in a minute',
  inMinutes: (minutes) => `in ${minutes}m`,
  inOneHour: 'in an hour',
  inHours: (hours) => `in ${hours}h`,
  tomorrow: 'tomorrow',
  inDays: (days) => `in ${days}d`,
};

/**
 * Both directions of the difference answer the same questions in the same order, so the boundaries
 * are paired: each step is asserted just inside it and just outside it, and the first step an
 * interval matches decides the phrase.
 */
describe('formatRelativeDate', () => {
  const relativeTo = new Date('2024-06-10T12:00:00Z');
  const secondsBefore = (seconds: number) => new Date(relativeTo.getTime() - seconds * 1_000);
  const secondsAfter = (seconds: number) => new Date(relativeTo.getTime() + seconds * 1_000);

  test('writes the past, one step per interval', () => {
    // Within 30 seconds either way reads as "just then".
    expect(formatRelativeDate(secondsBefore(0), relativeTo, relativeLocale)).toBe('just then');
    expect(formatRelativeDate(secondsBefore(29), relativeTo, relativeLocale)).toBe('just then');
    expect(formatRelativeDate(secondsBefore(30), relativeTo, relativeLocale)).toBe('30s ago');
    expect(formatRelativeDate(secondsBefore(59), relativeTo, relativeLocale)).toBe('59s ago');
    expect(formatRelativeDate(secondsBefore(60), relativeTo, relativeLocale)).toBe('a minute ago');
    expect(formatRelativeDate(secondsBefore(119), relativeTo, relativeLocale)).toBe('a minute ago');
    expect(formatRelativeDate(secondsBefore(120), relativeTo, relativeLocale)).toBe('2m ago');
    expect(formatRelativeDate(secondsBefore(3_599), relativeTo, relativeLocale)).toBe('59m ago');
    expect(formatRelativeDate(secondsBefore(3_600), relativeTo, relativeLocale)).toBe(
      'an hour ago',
    );
    expect(formatRelativeDate(secondsBefore(7_199), relativeTo, relativeLocale)).toBe(
      'an hour ago',
    );
    expect(formatRelativeDate(secondsBefore(7_200), relativeTo, relativeLocale)).toBe('2h ago');
    expect(formatRelativeDate(secondsBefore(86_399), relativeTo, relativeLocale)).toBe('23h ago');
    expect(formatRelativeDate(secondsBefore(86_400), relativeTo, relativeLocale)).toBe('yesterday');
    expect(formatRelativeDate(secondsBefore(172_799), relativeTo, relativeLocale)).toBe(
      'yesterday',
    );
    expect(formatRelativeDate(secondsBefore(172_800), relativeTo, relativeLocale)).toBe('2d ago');
  });

  test('writes the future with the same steps', () => {
    expect(formatRelativeDate(secondsAfter(29), relativeTo, relativeLocale)).toBe('just then');
    expect(formatRelativeDate(secondsAfter(30), relativeTo, relativeLocale)).toBe('in 30s');
    expect(formatRelativeDate(secondsAfter(59), relativeTo, relativeLocale)).toBe('in 59s');
    expect(formatRelativeDate(secondsAfter(60), relativeTo, relativeLocale)).toBe('in a minute');
    expect(formatRelativeDate(secondsAfter(119), relativeTo, relativeLocale)).toBe('in a minute');
    expect(formatRelativeDate(secondsAfter(120), relativeTo, relativeLocale)).toBe('in 2m');
    expect(formatRelativeDate(secondsAfter(3_599), relativeTo, relativeLocale)).toBe('in 59m');
    expect(formatRelativeDate(secondsAfter(3_600), relativeTo, relativeLocale)).toBe('in an hour');
    expect(formatRelativeDate(secondsAfter(7_199), relativeTo, relativeLocale)).toBe('in an hour');
    expect(formatRelativeDate(secondsAfter(7_200), relativeTo, relativeLocale)).toBe('in 2h');
    expect(formatRelativeDate(secondsAfter(86_399), relativeTo, relativeLocale)).toBe('in 23h');
    expect(formatRelativeDate(secondsAfter(86_400), relativeTo, relativeLocale)).toBe('tomorrow');
    expect(formatRelativeDate(secondsAfter(172_799), relativeTo, relativeLocale)).toBe('tomorrow');
    expect(formatRelativeDate(secondsAfter(172_800), relativeTo, relativeLocale)).toBe('in 2d');
  });
});
