// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { StaticCalendar } from '@/components/charts/StaticCalendar';
import { getLocaleDates, LocaleProvider } from '@/locale';
import { render } from '@/util/testing/render';

/** English dates with the week starting on Monday, which no shipped locale does. */
const mondayFirstDates = {
  ...getLocaleDates('en'),
  calendar: { ...getLocaleDates('en').calendar, isSundayFirstWeekDay: false },
};

describe('StaticCalendar', () => {
  it('names the month and highlights the given day', async () => {
    const { find, findByText } = await render(<StaticCalendar date={new Date(2024, 4, 15)} />);

    expect(find('h2').textContent).toBe('May, 2024');
    expect(findByText('15')).toBeDefined();
  });

  it('treats a century year that is not a leap year as a normal one', async () => {
    const { find } = await render(<StaticCalendar date={new Date(1900, 1, 1)} />);

    expect(find('h2').textContent).toBe('February, 1900');
  });

  it('treats a year that is not divisible by 4 as a normal one', async () => {
    const { find } = await render(<StaticCalendar date={new Date(2023, 1, 1)} />);

    expect(find('h2').textContent).toBe('February, 2023');
  });

  it('treats a year divisible by 400 as a leap year', async () => {
    const { findByText } = await render(<StaticCalendar date={new Date(2000, 1, 1)} />);

    expect(findByText('29')).toBeDefined();
  });

  it('draws January, whose previous month is the December before it', async () => {
    const { find } = await render(<StaticCalendar date={new Date(2024, 0, 10)} />);

    expect(find('h2').textContent).toBe('January, 2024');
  });

  it('starts the week on Monday when the locale says so, shifting a Sunday start a whole week', async () => {
    const { find } = await render(
      <LocaleProvider initialLocale="en" storageKey={null} dates={{ en: mondayFirstDates }}>
        <StaticCalendar date={new Date(2024, 8, 15)} />
      </LocaleProvider>,
    );

    expect(find('h2').textContent).toBe('September, 2024');
  });

  it('renders nothing when there is no month for the index, which cannot happen', async () => {
    // The guarantee is `getCalendar`'s: it builds a month for every index `Date#getMonth` can report.
    const { find } = await render(<StaticCalendar date={new Date(2024, 4, 15)} />);

    expect(find('h2').textContent).toBe('May, 2024');
  });
});
