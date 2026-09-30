import {
	type CalendarLocale,
	type DateFormatLocale,
	type DateLocale,
	type DateNames,
} from "@/lib/date";
import { getPluralizationIndex } from "@/lib/pluralization";

/**
 * The date data every locale carries.
 *
 * Dates are not a flat set of messages: a format string, a month heading and a plural-aware phrase
 * are three different shapes, and a locale that ships only `Record<string, string>` cannot express
 * any of them. They are kept here, beside the messages, so that adding a language means writing one
 * file and not three.
 */
export interface LocaleDates {
	/** Names for the formatters: `%A`, `%B` and the calendar headings. */
	readonly names: DateNames;
	/** Names the calendar draws its own headings with. */
	readonly calendar: CalendarLocale;
	/** The `strftime` format strings a timestamp is rendered with. */
	readonly formats: DateFormatLocale;
	/** The phrases a relative timestamp is rendered as. */
	readonly relative: DateLocale;
}

export const enDates: LocaleDates = {
	names: {
		weekdayNames: [
			"Sunday",
			"Monday",
			"Tuesday",
			"Wednesday",
			"Thursday",
			"Friday",
			"Saturday",
		],
		monthNames: [
			"January",
			"February",
			"March",
			"April",
			"May",
			"June",
			"July",
			"August",
			"September",
			"October",
			"November",
			"December",
		],
	},
	calendar: {
		isSundayFirstWeekDay: true,
		monthNames: [
			"January",
			"February",
			"March",
			"April",
			"May",
			"June",
			"July",
			"August",
			"September",
			"October",
			"November",
			"December",
		],
		weekdayNames: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
	},
	formats: {
		format: "%m/%d/%Y %r",
		verboseFormat: "%b %-d, %Y (%a) %r",
		timeFirst: "%r, %b %-d, %Y (%a)",
		timeOnly: "%r",
		dateOnly: "%b %-d, %Y",
		numericDateOnly: "%F",
		hourMinuteOnly: "%I:%M %p",
	},
	relative: {
		daysAgo: (days) => `${days} days ago`,
		yesterday: "yesterday",
		hoursAgo: (hours) => `${hours} hours ago`,
		oneHourAgo: "1 hour ago",
		minutesAgo: (minutes) => `${minutes} minutes ago`,
		oneMinuteAgo: "a minute ago",
		secondsAgo: (seconds) => `${seconds} seconds ago`,
		justThen: "just then",
		inSeconds: (seconds) => `in ${seconds} seconds`,
		inOneMinute: "in a minute",
		inMinutes: (minutes) => `in ${minutes} minutes`,
		inOneHour: "in 1 hour",
		inHours: (hours) => `in ${hours} hours`,
		tomorrow: "tomorrow",
		inDays: (days) => `in ${days} days`,
	},
};

export const ruDates: LocaleDates = {
	names: {
		weekdayNames: [
			"воскресенье",
			"понедельник",
			"вторник",
			"среда",
			"четверг",
			"пятница",
			"суббота",
		],
		monthNames: [
			"январь",
			"февраль",
			"март",
			"апрель",
			"май",
			"июнь",
			"июль",
			"август",
			"сентябрь",
			"октябрь",
			"ноябрь",
			"декабрь",
		],
	},
	calendar: {
		isSundayFirstWeekDay: false,
		monthNames: [
			"Январь",
			"Февраль",
			"Март",
			"Апрель",
			"Май",
			"Июнь",
			"Июль",
			"Август",
			"Сентябрь",
			"Октябрь",
			"Ноябрь",
			"Декабрь",
		],
		weekdayNames: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
	},
	formats: {
		format: "%d.%m.%Y %T",
		verboseFormat: "%-d %b, %Y (%a) %T",
		timeFirst: "%T, %-d %b, %Y (%a)",
		timeOnly: "%T",
		dateOnly: "%-d %b, %Y",
		numericDateOnly: "%d.%m.%Y",
		hourMinuteOnly: "%H:%M",
	},
	relative: {
		daysAgo: (days) =>
			`${days} ${["день", "дня", "дней"][getPluralizationIndex("ru", days)]} назад`,
		yesterday: "вчера",
		hoursAgo: (hours) =>
			`${hours} час${["", "а", "ов"][getPluralizationIndex("ru", hours)]} назад`,
		oneHourAgo: "час назад",
		minutesAgo: (minutes) =>
			`${minutes} минут${["а", "ы", ""][getPluralizationIndex("ru", minutes)]} назад`,
		oneMinuteAgo: "минуту назад",
		secondsAgo: (seconds) =>
			`${seconds} секунд${["а", "ы", ""][getPluralizationIndex("ru", seconds)]} назад`,
		justThen: "только что",
		inSeconds: (seconds) =>
			`через ${seconds} секунд${["у", "ы", ""][getPluralizationIndex("ru", seconds)]}`,
		inOneMinute: "через минуту",
		inMinutes: (minutes) =>
			`через ${minutes} минут${["у", "ы", ""][getPluralizationIndex("ru", minutes)]}`,
		inOneHour: "через час",
		inHours: (hours) =>
			`через ${hours} час${["", "а", "ов"][getPluralizationIndex("ru", hours)]}`,
		tomorrow: "завтра",
		inDays: (days) =>
			`через ${days} ${["день", "дня", "дней"][getPluralizationIndex("ru", days)]}`,
	},
};

/** The date data per locale, keyed the same way the message catalogues are. */
export const builtinDates: Readonly<Record<string, LocaleDates>> = {
	en: enDates,
	ru: ruDates,
};
