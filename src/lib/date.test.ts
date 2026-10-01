import { describe, expect, it } from 'vitest';
import { type DateLocale, formatRelativeDate } from '@/lib/date';

/**
 * The phrases under test. Both directions are spelled out in one locale so that the interval
 * boundaries can be read as a table, and the wording a caller sees is asserted rather than read
 * back out of the locale file the code itself reads.
 */
const phrases: DateLocale = {
  justThen: 'just now',
  inSeconds: (seconds) => `in ${seconds} seconds`,
  inOneMinute: 'in a minute',
  inMinutes: (minutes) => `in ${minutes} minutes`,
  inOneHour: 'in an hour',
  inHours: (hours) => `in ${hours} hours`,
  tomorrow: 'tomorrow',
  inDays: (days) => `in ${days} days`,
  secondsAgo: (seconds) => `${seconds} seconds ago`,
  oneMinuteAgo: 'a minute ago',
  minutesAgo: (minutes) => `${minutes} minutes ago`,
  oneHourAgo: 'an hour ago',
  hoursAgo: (hours) => `${hours} hours ago`,
  yesterday: 'yesterday',
  daysAgo: (days) => `${days} days ago`,
};

describe('formatRelativeDate', () => {
  // The instant every interval is measured from.
  const now = new Date('2026-06-15T12:00:00Z');

  function formatIn(seconds: number): string {
    const target = new Date(now.getTime() + seconds * 1000);

    return formatRelativeDate(target, now, phrases);
  }

  describe('a date in the future', () => {
    it.each([
      [0, 'just now'],
      [29, 'just now'],
      [30, 'in 30 seconds'],
      [59, 'in 59 seconds'],
      [60, 'in a minute'],
      [119, 'in a minute'],
      [120, 'in 2 minutes'],
      [3599, 'in 59 minutes'],
      // "in an hour" covers the whole of the second hour, not just its first 30 minutes, because
      // it is answered by the hour count rounding down to one. "in 1 hours" is never said.
      [3600, 'in an hour'],
      [5399, 'in an hour'],
      [7199, 'in an hour'],
      [7200, 'in 2 hours'],
      [86_399, 'in 23 hours'],
      [86_400, 'tomorrow'],
      [172_800, 'in 2 days'],
    ])('formats %i seconds ahead as %s', (seconds, expected) => {
      expect(formatIn(seconds)).toBe(expected);
    });
  });

  describe('a date in the past', () => {
    it.each([
      [0, 'just now'],
      [29, 'just now'],
      [30, '30 seconds ago'],
      [59, '59 seconds ago'],
      [60, 'a minute ago'],
      [119, 'a minute ago'],
      [120, '2 minutes ago'],
      [3599, '59 minutes ago'],
      [3600, 'an hour ago'],
      [5399, 'an hour ago'],
      [7199, 'an hour ago'],
      [7200, '2 hours ago'],
      [86_399, '23 hours ago'],
      [86_400, 'yesterday'],
      [172_800, '2 days ago'],
    ])('formats %i seconds ago as %s', (seconds, expected) => {
      expect(formatIn(-seconds)).toBe(expected);
    });
  });

  // Sub-second differences round to zero in the caller, so both directions have to agree that a
  // difference too small to state is "just now" rather than a count of zero seconds.
  it('answers just now for a difference it cannot state', () => {
    expect(formatIn(0.4)).toBe('just now');
    expect(formatIn(-0.4)).toBe('just now');
  });
});
