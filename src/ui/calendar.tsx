import { useCallback, useEffect, useRef, useState } from 'react';
import type { CalendarLocale } from '@/lib/date';
import { useEventListener } from '@/lib/use_event_listener';
import { useGranularEffect } from '@/lib/use_granular_effect';
import { getLocaleDates, useLocale } from '@/locale';

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
    const firstWeekday = getWeekday(definedYear, month, 1);

    let firstWeekdayShift = 0;
    if (!isSundayFirstWeekDay && firstWeekday === 0) {
      firstWeekdayShift = WEEK_DAYS;
    }

    const numberOfDays = getDaysInMonth(definedYear, month);

    const monthName = monthEntry(calendarLocale.monthNames, month);

    const monthCalendar: MonthCalendar = {
      fullName: monthName,
      name: monthName.slice(0, 3),
      dayTable: [],
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

    let previousDays = 0;
    if (month === 0) {
      previousDays = getDaysInMonth(definedYear - 1, 11);
    } else {
      previousDays = getDaysInMonth(definedYear, month - 1);
    }

    for (let y = 0; y < MONTH_ROWS; y++) {
      const row: number[] = [];
      for (let x = 0; x < WEEK_DAYS; x++) {
        let index = x + y * WEEK_DAYS;
        if (!calendar.isSundayFirstWeekDay) {
          index++;
        }
        let monthDay: number =
          index - (monthCalendar.firstWeekday + monthCalendar.firstWeekdayShift) + 1;
        if (index < monthCalendar.firstWeekday + monthCalendar.firstWeekdayShift) {
          monthDay =
            previousDays -
            (monthCalendar.firstWeekday + monthCalendar.firstWeekdayShift) +
            index +
            1;
        } else if (
          index >=
          monthCalendar.firstWeekday + monthCalendar.firstWeekdayShift + monthCalendar.numberOfDays
        ) {
          monthDay = monthDay - monthCalendar.numberOfDays;
        }
        row.push(monthDay);
      }
      monthCalendar.dayTable = [...monthCalendar.dayTable, row];
    }

    calendar.months = [...calendar.months, monthCalendar];
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

export function StaticCalendar({ date }: { readonly date: Date }) {
  const { lang } = useLocale();

  const { isSundayFirstWeekDay } = getLocaleDates(lang).calendar;

  const calendar = getCalendar(
    date.getFullYear(),
    isSundayFirstWeekDay,
    getLocaleDates(lang).calendar,
  );

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
        {getLocaleDates(lang).calendar.monthNames[monthIndex]}, {year}
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
                {getLocaleDates(lang).calendar.weekdayNames[weekdayIndex]}
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

export function MiniCalendar({
  visible,
  date,
  posX,
  posY,
  onClose,
}: {
  readonly visible: boolean;
  readonly date: Date;
  readonly posX: number;
  readonly posY: number;
  readonly onClose: () => void;
}) {
  const windowRef = useRef<HTMLDivElement>(null);

  const [curX, setCurX] = useState(posX);
  const [curY, setCurY] = useState(posY);

  // NOTE If you use a pop-up animation, this position correct
  // is not going to work properly because the pop-up affects
  // the transform scale and it in turn affects the size of
  // the window making it smaller than it is after the animation.
  // So this code will take a smaller window size until the animation
  // is done. So, if you really want to use it, compute the height
  // before the animation is started.
  useGranularEffect(
    () => {
      if (windowRef.current) {
        const { height } = windowRef.current.getBoundingClientRect();
        setCurX(posX);
        setCurY(Math.min(posY, window.innerHeight - height - 100));
      }
    },
    [windowRef, windowRef.current, posY, posX],
    [],
  );

  useEffect(() => {
    if (visible) {
      windowRef.current?.focus();
    }
  }, [visible]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        onClose();
      }
    },
    [onClose],
  );

  useEventListener('click', (e: MouseEvent) => {
    if (visible) {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  });

  return (
    <div
      ref={windowRef}
      tabIndex={0}
      onClick={onClose}
      className="fixed box-border w-60 select-none rounded-2xl bg-[var(--color-mini-calendar-bg)] p-4 shadow-lg shadow-black"
      style={{
        display: visible ? 'block' : 'none',
        top: curY,
        left: curX,
      }}
      onKeyDown={onKeyDown}
    >
      <StaticCalendar date={date} />
    </div>
  );
}
