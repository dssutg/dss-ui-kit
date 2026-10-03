/**
 * The local date and time of a `Date`, split into the fields a form shows, with the month 1-based.
 *
 * Local, not UTC, and the month incremented: `getMonth()` is 0-based and a form's month field is not.
 * The seconds are there because a field with a seconds column needs them, not because they are usually
 * shown.
 */
export function getDateComponents(dateObject: Date = new Date()) {
  return {
    year: dateObject.getFullYear(),
    month: dateObject.getMonth() + 1,
    day: dateObject.getDate(),
    hours: dateObject.getHours(),
    minutes: dateObject.getMinutes(),
    seconds: dateObject.getSeconds(),
  };
}

export function hours24to12(hours = 0) {
  const ampm = hours >= 12 ? 'pm' : 'am';
  const wrappedHours = hours % 12;
  const hours12 = wrappedHours !== 0 ? wrappedHours : 12;

  return { hours: hours12, ampm };
}

/**
 * Weekday and month names, for the date formatters to render in a language.
 *
 * Indexed from Sunday and January respectively, because that is what `Date` reports and what every
 * caller of these arrays has to hand them.
 */
export interface DateNames {
  readonly weekdayNames: readonly string[];
  readonly monthNames: readonly string[];
}

/**
 * English names, used when a caller supplies none.
 *
 * A date formatted with these is still a correct date in a monolingual application, and it is the one
 * language a formatter can produce without being told: hardcoding a language here is what made a
 * Russian calendar render its months in English.
 */
export const defaultDateNames: DateNames = {
  weekdayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  monthNames: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
} as const;

/**
 * The names a calendar draws its own headings with.
 *
 * Separate from {@link DateNames} because a calendar needs the two forms a date format does not: the
 * abbreviated weekday, and whether the week starts on Sunday. A locale that starts its week on Monday
 * cannot be expressed as a set of names.
 */
export interface CalendarLocale {
  readonly isSundayFirstWeekDay: boolean;
  readonly monthNames: readonly string[];
  readonly weekdayNames: readonly string[];
}

/** The `strftime` format strings a locale dates in, named after the fields they show. */
export interface DateFormatLocale {
  /** Date and time, the default for a timestamp. */
  readonly format: string;
  /** Everything, for somewhere there is room to say all of it. */
  readonly verboseFormat: string;
  /** Time first, for a log that reads newest-first. */
  readonly timeFirst: string;
  readonly timeOnly: string;
  readonly dateOnly: string;
  readonly numericDateOnly: string;
  readonly hourMinuteOnly: string;
}

// See GNU date manual for date format specifiers
//
// To see the manual enter the following command in]
// a GNU/Linux distribution:
//
//   $ man 1 date
//
// Or visit this site:
//
//   https://man7.org/linux/man-pages/man1/date.1.html
//

/**
 * The name of a weekday, or an empty string if `DateNames` does not carry one for that day.
 *
 * `Date#getDay` returns 0 to 6 and `DateNames` is documented as starting at Sunday, so a name is
 * there for every day a `Date` can report. A name array too short to cover a real date is a
 * malformed locale object, and the question is what a formatter should do about one: throwing turns
 * a missing translation into an application that cannot render a clock, so the name degrades to
 * empty instead. The same answer serves for months.
 */
function getWeekdayName(names: DateNames, date: Date): string {
  return names.weekdayNames[date.getDay()] ?? '';
}

function getMonthName(names: DateNames, date: Date): string {
  return names.monthNames[date.getMonth()] ?? '';
}

export function minstrftime(
  format = '',
  date: Date = new Date(),
  names: DateNames = defaultDateNames,
) {
  type Padding = Readonly<{
    readPadChar: string;
    padChar: string;
    padFactor: number;
    isDefault: boolean;
  }>;

  const defaultPadding: Padding = {
    readPadChar: '',
    padChar: '0',
    padFactor: 1,
    isDefault: true,
  };

  function parsePadding(formatSpecifier: string) {
    const formatSpecifierHandlerMap: Readonly<Record<string, () => Readonly<Padding>>> = {
      // Pad with zeros
      '0': () => ({
        readPadChar: formatSpecifier,
        padChar: formatSpecifier,
        padFactor: 1,
        isDefault: false,
      }),

      // Do not pad
      '-': () => ({
        readPadChar: formatSpecifier,
        padChar: formatSpecifier,
        padFactor: 0,
        isDefault: false,
      }),

      // Pad with spaces. `%_d` is a real GNU strftime specifier, so this key is the character
      // itself rather than a name for it.
      // biome-ignore lint/style/useNamingConvention: this key is the GNU strftime `_` padding specifier, which `%_d` looks up by its character.
      _: () => ({
        readPadChar: formatSpecifier,
        padChar: ' ',
        padFactor: 1,
        isDefault: false,
      }),
    };

    const handler = formatSpecifierHandlerMap[formatSpecifier];

    return handler ? handler() : defaultPadding;
  }

  let result = '';
  let index = 0;

  while (index < format.length) {
    if (format[index] !== '%') {
      result = result + format[index];
      index = index + 1;
      continue;
    }

    index = index + 1;

    const paddingSpecifier = format[index];

    const padding =
      paddingSpecifier !== undefined ? parsePadding(paddingSpecifier) : defaultPadding;

    const { padChar, padFactor, readPadChar, isDefault: isDefaultPadding } = padding;

    if (!isDefaultPadding) {
      index = index + 1;
    }

    const formatHandlerMap: Readonly<Record<string, () => string>> = {
      F: () => minstrftime('%Y-%m-%d', date),
      D: () => minstrftime('%m/%d/%y', date),
      T: () => minstrftime('%H:%M:%S', date),
      R: () => minstrftime('%H:%M', date),
      r: () => minstrftime('%I:%M:%S %p', date),
      H: () =>
        date
          .getHours()
          .toString()
          .padStart(2 * padFactor, padChar),
      M: () =>
        date
          .getMinutes()
          .toString()
          .padStart(2 * padFactor, padChar),
      S: () =>
        date
          .getSeconds()
          .toString()
          .padStart(2 * padFactor, padChar),
      Y: () => date.getFullYear().toString(),
      y: () => (date.getFullYear() % 100).toString(),
      d: () =>
        date
          .getDate()
          .toString()
          .padStart(2 * padFactor, padChar),
      m: () => (date.getMonth() + 1).toString().padStart(2 * padFactor, padChar),
      w: () => date.getDay().toString(),
      I: () =>
        hours24to12(date.getHours())
          .hours.toString()
          .padStart(2 * padFactor, padChar),
      P: () => hours24to12(date.getHours()).ampm,
      p: () => hours24to12(date.getHours()).ampm.toUpperCase(),
      s: () => Math.floor(date.getTime() / 1000).toString(),
      u: () => date.getTime().toString(),
      A: () => getWeekdayName(names, date),
      a: () => getWeekdayName(names, date).slice(0, 3),
      B: () => getMonthName(names, date),
      b: () => getMonthName(names, date).slice(0, 3),
      '%': () => '%',
      t: () => '\t',
    };

    const formatSpecifier = format[index];

    const defaultChunkToAppend = `%${readPadChar}${formatSpecifier ?? ''}`;

    const chunkToAppend =
      formatSpecifier !== undefined
        ? (formatHandlerMap[formatSpecifier]?.() ?? defaultChunkToAppend)
        : defaultChunkToAppend;

    result = result + chunkToAppend;
    index = index + 1;
  }

  return result;
}

/**
 * The words a relative date is written with, as functions where a number appears.
 *
 * One interface rather than a message catalogue because these are templates with a number in them:
 * a locale that says "in 5 minutes" and "in 1 minute" has two different sentences, and a plural rule
 * over one string cannot produce both. `src/locales/en.tsx` and `ru.tsx` each define one.
 */
export interface DateLocale {
  daysAgo: (days: number) => string;
  yesterday: string;
  hoursAgo: (hours: number) => string;
  oneHourAgo: string;
  minutesAgo: (minutes: number) => string;
  oneMinuteAgo: string;
  secondsAgo: (seconds: number) => string;
  justThen: string;
  inSeconds: (seconds: number) => string;
  inOneMinute: string;
  inMinutes: (minutes: number) => string;
  inOneHour: string;
  inHours: (hours: number) => string;
  tomorrow: string;
  inDays: (days: number) => string;
}

const minute = 60;
const hour = minute * 60;
const day = hour * 24;

/**
 * A date written as how long ago it was, or how long until it is.
 *
 * Both directions come from the same {@link DateLocale}, and "today" is decided by
 * `relativeToDateObject` rather than by the system clock: a caller formatting a log for a different day
 * has to be able to say what day that is. The locale is a required argument for the same reason.
 */
export function formatRelativeDate(
  dateObject: Date,
  relativeToDateObject: Date,
  dateLocale: DateLocale,
) {
  const delta = Math.round((relativeToDateObject.getTime() - dateObject.getTime()) / 1000);

  // The locale is a required argument: choosing one here would mean choosing a language.
  const locale: DateLocale = dateLocale;

  // Both directions answer the same questions in the same order — is it a moment, is it within the
  // minute, is it exactly one hour, is it yesterday — and differ only in which locale method says so.
  // The questions are therefore listed once and each direction supplies its own phrasing, so an
  // interval cannot be changed for a past date without changing it for a future one too.
  const secondsOf = (seconds: number) => seconds;
  const wholeMinutes = (seconds: number) => Math.floor(seconds / minute);
  const wholeHours = (seconds: number) => Math.floor(seconds / hour);
  const wholeDays = (seconds: number) => Math.floor(seconds / day);
  const within = (limit: number) => (seconds: number) => seconds < limit;
  const isExactlyOneHour = (seconds: number) => wholeHours(seconds) === 1;

  function formatFutureDate(locale: DateLocale, delta: number) {
    const steps: readonly RelativeStep[] = [
      [within(30), locale.justThen],
      [within(minute), locale.inSeconds(secondsOf(delta))],
      [within(2 * minute), locale.inOneMinute],
      [within(hour), locale.inMinutes(wholeMinutes(delta))],
      [isExactlyOneHour, locale.inOneHour],
      [within(day), locale.inHours(wholeHours(delta))],
      [within(day * 2), locale.tomorrow],
    ];

    return firstMatchingStep(steps, delta) ?? locale.inDays(wholeDays(delta));
  }

  function formatPastDate(locale: DateLocale, delta: number) {
    const steps: readonly RelativeStep[] = [
      [within(30), locale.justThen],
      [within(minute), locale.secondsAgo(secondsOf(delta))],
      [within(2 * minute), locale.oneMinuteAgo],
      [within(hour), locale.minutesAgo(wholeMinutes(delta))],
      [isExactlyOneHour, locale.oneHourAgo],
      [within(day), locale.hoursAgo(wholeHours(delta))],
      [within(day * 2), locale.yesterday],
    ];

    return firstMatchingStep(steps, delta) ?? locale.daysAgo(wholeDays(delta));
  }

  const isFuture = delta < 0;

  // Both formatters work in a magnitude. The direction has already been chosen by the sign, so
  // handing either of them the signed delta would make every future interval answer as if it had
  // just happened.
  const magnitude = Math.abs(delta);
  const format = isFuture ? formatFutureDate : formatPastDate;

  return format(locale, magnitude);
}

/** One question about an interval, and the phrasing to use when the answer is yes. */
type RelativeStep = readonly [(seconds: number) => boolean, phrase: string];

/**
 * The phrasing for the first step the seconds satisfy.
 *
 * The steps are read in order and the first match wins, which is what keeps the intervals disjoint.
 * A step is a predicate rather than a threshold because one of them cannot be a threshold: "in one
 * hour" and "in N hours" are separate locale methods, and an interval that means "exactly one
 * hour" is not a range.
 */
function firstMatchingStep(steps: readonly RelativeStep[], seconds: number): string | undefined {
  for (const [isInInterval, phrase] of steps) {
    if (isInInterval(seconds)) {
      return phrase;
    }
  }

  return undefined;
}

export function getMillisecondsAsHMSUComponents(milliseconds?: number) {
  if (milliseconds === null || milliseconds === undefined || Number.isNaN(milliseconds)) {
    return null;
  }

  const SECOND_MILLISECONDS = 1000;
  const MINUTE_MILLISECONDS = 60 * SECOND_MILLISECONDS;
  const HOUR_MILLISECONDS = 60 * MINUTE_MILLISECONDS;

  const hours = Math.floor(milliseconds / HOUR_MILLISECONDS);
  const minutes = Math.floor((milliseconds % HOUR_MILLISECONDS) / MINUTE_MILLISECONDS);
  const seconds = Math.floor((milliseconds % MINUTE_MILLISECONDS) / SECOND_MILLISECONDS);
  const ms = milliseconds % SECOND_MILLISECONDS;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  const uuu = String(ms).padStart(3, '0');

  return { hh, mm, ss, uuu };
}

export function formatMillisecondsAsHMSU(
  milliseconds?: number,
  { millisecondsShown = true } = {},
): string {
  const components = getMillisecondsAsHMSUComponents(milliseconds);

  if (components === null) {
    return millisecondsShown ? '??:??:??.???' : '??:??:??';
  }

  const { hh, mm, ss, uuu } = components;

  return millisecondsShown ? `${hh}:${mm}:${ss}.${uuu}` : `${hh}:${mm}:${ss}`;
}

export function formatMillisecondsAsHM(milliseconds?: number): string {
  const components = getMillisecondsAsHMSUComponents(milliseconds);

  if (components === null) {
    return '??:??';
  }

  const { hh, mm } = components;

  return `${hh}:${mm}`;
}

export function isNowAfter(target: string) {
  const now = Date.now();
  const t = Date.parse(target);

  if (Number.isNaN(t)) {
    throw new Error('Invalid target date');
  }

  return now > t;
}
