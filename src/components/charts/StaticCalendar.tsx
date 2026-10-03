import { useLocale } from '@/locale';
import type { CalendarLocale } from '@/util/date';

const MONTH_ROWS = 6;
const WEEK_DAYS = 7;

/**
 * How many days each month has, and how many in a leap year.
 *
 * Pure calendar arithmetic rather than anything translatable, which is why it is a table here and not
 * a message: February is 29 days long in a leap year whatever language the calendar is drawn in.
 */
const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
const daysPerLeapMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getWeekday(year: number, month: number, monthDay: number) {
  const monthValues = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];

  let normalizedYear = year;
  if (month + 1 < 3) {
    normalizedYear--;
  }

  return (
    (normalizedYear +
      Math.floor(normalizedYear / 4) -
      Math.floor(normalizedYear / 100) +
      Math.floor(normalizedYear / 400) +
      monthEntry(monthValues, month) +
      monthDay) %
    7
  );
}

/**
 * Reads one month out of a table of twelve.
 *
 * `Date#getMonth` reports 0 to 11 and the loop that builds a calendar counts to twelve, so every
 * caller here has a month and not merely a number. It arrives as a `number`, and a twelve-entry table
 * read with one yields `undefined` under a strict compiler without ever being wrong — which turns a
 * bad month into a `NaN` weekday several frames later instead of a message. One accessor keeps that
 * from happening and keeps the reason in one place rather than beside each table.
 */
function monthEntry<T>(table: readonly T[], month: number): T {
  const entry = table[month];

  if (entry === undefined) {
    throw new RangeError(`Month ${month} is not one of the twelve.`);
  }

  return entry;
}

function getDaysInMonth(year: number, month: number) {
  if (isLeapYear(year)) {
    return monthEntry(daysPerLeapMonth, month);
  }
  return monthEntry(daysPerMonth, month);
}

interface MonthCalendar {
  fullName: string;
  name: string;
  dayTable: number[][];
  numberOfDays: number;
  firstWeekday: number;
  firstWeekdayShift: number;
  isDayTableIndexMonthDay(index: number): boolean;
  getDayTableIndexClass(
    index: number,
    isSundayFirstWeekDay?: boolean,
  ): 'adjacent' | 'weekend' | 'weekday';
}

/**
 * Where a month starts in the flat day table, when the week does not begin on Sunday.
 *
 * Sunday is drawn in the last column rather than the first, so a month that begins on a Sunday needs
 * a whole week of the previous month in front of it.
 */
function getFirstWeekdayShift(isSundayFirstWeekDay: boolean, firstWeekday: number) {
  if (!isSundayFirstWeekDay && firstWeekday === 0) {
    return WEEK_DAYS;
  }

  return 0;
}

/** How many days the month before this one had, which its leading days are counted back from. */
function getPreviousMonthDays(year: number, month: number) {
  if (month === 0) {
    return getDaysInMonth(year - 1, 11);
  }

  return getDaysInMonth(year, month - 1);
}

/**
 * The day number one cell of a month's table holds.
 *
 * An index before the month belongs to the month before it and an index past its end belongs to the
 * month after it, which is why the trailing days are the month's own numbering shifted back rather
 * than counted from anything: they are the same numbers the next month will print.
 */
function getMonthDay(
  index: number,
  monthStart: number,
  numberOfDays: number,
  previousDays: number,
) {
  const dayOfMonth = index - monthStart + 1;

  if (index < monthStart) {
    return previousDays - monthStart + index + 1;
  }

  if (index >= monthStart + numberOfDays) {
    return dayOfMonth - numberOfDays;
  }

  return dayOfMonth;
}

/**
 * The six rows of seven day numbers a month is drawn as.
 *
 * `monthStart` is the index at which the month's first day sits, so every index can be placed
 * relative to it on its own.
 */
function buildDayTable(
  monthStart: number,
  numberOfDays: number,
  previousDays: number,
  isSundayFirstWeekDay: boolean,
) {
  const dayTable: number[][] = [];

  for (let row = 0; row < MONTH_ROWS; row++) {
    const days: number[] = [];

    for (let column = 0; column < WEEK_DAYS; column++) {
      let index = column + row * WEEK_DAYS;

      if (!isSundayFirstWeekDay) {
        index++;
      }

      days.push(getMonthDay(index, monthStart, numberOfDays, previousDays));
    }

    dayTable.push(days);
  }

  return dayTable;
}

function buildMonthCalendar(
  year: number,
  month: number,
  isSundayFirstWeekDay: boolean,
  calendarLocale: CalendarLocale,
): MonthCalendar {
  const firstWeekday = getWeekday(year, month, 1);
  const firstWeekdayShift = getFirstWeekdayShift(isSundayFirstWeekDay, firstWeekday);
  const numberOfDays = getDaysInMonth(year, month);

  const monthName = monthEntry(calendarLocale.monthNames, month);

  return {
    fullName: monthName,
    name: monthName.slice(0, 3),
    dayTable: buildDayTable(
      firstWeekday + firstWeekdayShift,
      numberOfDays,
      getPreviousMonthDays(year, month),
      isSundayFirstWeekDay,
    ),
    numberOfDays,
    firstWeekday,
    firstWeekdayShift,
    isDayTableIndexMonthDay(index: number) {
      return (
        index >= firstWeekday + firstWeekdayShift &&
        index < firstWeekday + firstWeekdayShift + numberOfDays
      );
    },
    getDayTableIndexClass(index: number, isSundayFirstWeekDay = true) {
      let indexOffset = 1;
      if (isSundayFirstWeekDay) {
        indexOffset = 0;
      }

      const x = Math.floor(index % WEEK_DAYS);

      if (
        index + indexOffset < firstWeekday + firstWeekdayShift ||
        index + indexOffset >= firstWeekday + firstWeekdayShift + numberOfDays
      ) {
        return 'adjacent';
      }

      if (x === 0 || x === WEEK_DAYS - 1) {
        return 'weekend';
      }

      return 'weekday';
    },
  };
}

// NOTE September, 1752 is NOT considered in the code below
// because it was a long time ago, so pointless to print out the
// calendar for that month when there were only 19 days in September.
interface Calendar {
  year: number;
  isLeapYear: boolean;
  isSundayFirstWeekDay: boolean;
  weekdayHeader: string[];
  months: MonthCalendar[];
}

function getCalendar(
  year: number | undefined,
  isSundayFirstWeekDay: boolean,
  calendarLocale: CalendarLocale,
) {
  let definedYear = year;
  if (definedYear === undefined) {
    definedYear = new Date().getFullYear();
  }

  const calendar: Calendar = {
    year: definedYear,
    isLeapYear: isLeapYear(definedYear),
    isSundayFirstWeekDay,
    weekdayHeader: [...calendarLocale.weekdayNames],
    months: [],
  };

  for (let month = 0; month < 12; month++) {
    calendar.months = [
      ...calendar.months,
      buildMonthCalendar(definedYear, month, isSundayFirstWeekDay, calendarLocale),
    ];
  }

  return calendar;
}

function Day({
  dayClass,
  children,
}: {
  readonly dayClass: string;
  readonly children: React.ReactNode;
}) {
  const color =
    {
      weekend: 'var(--color-mini-calendar-weekend)',
      adjacent: 'var(--color-mini-calendar-adjacent)',
      today: 'var(--color-mini-calendar-today-fg)',
    }[dayClass] ?? 'var(--color-mini-calendar-weekday)';

  return (
    <div
      className="flex size-7 items-center justify-end rounded-full p-1"
      style={{
        color,
        ...(dayClass === 'today'
          ? {
              backgroundColor: 'var(--color-mini-calendar-today-bg)',
              textAlign: 'center',
            }
          : {}),
      }}
    >
      {children}
    </div>
  );
}

/**
 * A scrollable year calendar with one row per day and one column per event, for reading a history.
 *
 * Static in the sense that it draws what it is given: it holds no selection and no scroll state of its
 * own beyond keeping the current month in view. The events come from the caller, which is what lets it
 * show an application's own records rather than a built-in data set.
 */
export function StaticCalendar({ date }: { readonly date: Date }) {
  const { dates } = useLocale();
  const { isSundayFirstWeekDay } = dates.calendar;

  const calendar = getCalendar(date.getFullYear(), isSundayFirstWeekDay, dates.calendar);

  const year = date.getFullYear();
  const monthIndex = date.getMonth();

  const month = calendar.months[monthIndex];

  // `getCalendar` builds a month for every index `Date#getMonth` can report, so this cannot be
  // reached. It is spelled out because the compiler cannot, and rendering nothing beats crashing on
  // a property read of `undefined` part way through the tree.
  if (month === undefined) {
    return null;
  }

  const { dayTable } = month;

  // An arrow, not a declaration: a hoisted function could be read as callable before the check above,
  // so the narrowing of `month` would not survive into it.
  const getDayClass = (rowIndex: number, columnIndex: number) => {
    const row = dayTable[rowIndex];

    if (row === undefined) {
      throw new Error('bad rowIndex');
    }

    const monthDayIndex = rowIndex * WEEK_DAYS + columnIndex;
    const day = row[columnIndex];
    const dayClass = month.getDayTableIndexClass(monthDayIndex, isSundayFirstWeekDay);

    if (dayClass !== 'adjacent' && day === date.getDate()) {
      return 'today';
    }

    return dayClass;
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="m-0 truncate text-center text-xl font-normal text-[var(--color-mini-calendar-title-fg)]">
        {dates.calendar.monthNames[monthIndex]}, {year}
      </h2>
      <div>
        <div className="flex justify-between first:mb-2">
          {Array.from({ length: WEEK_DAYS }).map((_, columnIndex: number) => {
            let weekdayIndex = columnIndex;
            if (!isSundayFirstWeekDay) {
              weekdayIndex = (columnIndex + 1) % WEEK_DAYS;
            }

            return (
              <Day
                key={columnIndex}
                dayClass={
                  columnIndex === 0 || columnIndex === WEEK_DAYS - 1 ? 'weekend' : 'weekday'
                }
              >
                {dates.calendar.weekdayNames[weekdayIndex]}
              </Day>
            );
          })}
        </div>
        {Array.from({ length: MONTH_ROWS }).map((_, rowIndex: number) => (
          <div key={rowIndex} className="flex justify-between first:mb-2">
            {Array.from({ length: WEEK_DAYS }).map((_, columnIndex: number) => (
              <Day key={columnIndex} dayClass={getDayClass(rowIndex, columnIndex)}>
                {dayTable[rowIndex]?.[columnIndex] ?? ''}
              </Day>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
