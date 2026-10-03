import type { CalendarLocale, DateFormatLocale, DateLocale, DateNames } from '@/util/date';

/**
 * The date data every locale carries.
 *
 * Dates are not a flat set of messages: a format string, a calendar heading and a plural-aware
 * phrase are three different shapes, and a catalogue that holds only `Record<string, string>` cannot
 * express any of them. Each locale therefore exports the structured half beside its flat half — `en`
 * and `enDates`, `ru` and `ruDates` — so adding a language means writing one file and not three.
 *
 * The strings themselves live with the locale they belong to: `src/locales/en.tsx` and
 * `src/locales/ru.tsx`, and nowhere else. This module holds only the shape they share.
 */
export interface LocaleDates {
  /** Names for the formatters: `%A`, `%B` and `%x`. */
  readonly names: DateNames;
  /** Names the calendar draws its own headings with. */
  readonly calendar: CalendarLocale;
  /** The `strftime` format strings a timestamp is rendered with. */
  readonly formats: DateFormatLocale;
  /** The phrases a relative timestamp is rendered as. */
  readonly relative: DateLocale;
}
