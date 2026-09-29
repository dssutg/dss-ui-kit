import { getPluralizationIndex } from "@/lib/pluralization";

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
	const ampm = hours >= 12 ? "pm" : "am";
	const wrappedHours = hours % 12;
	const hours12 = wrappedHours !== 0 ? wrappedHours : 12;

	return { hours: hours12, ampm };
}

export const weekdayNames = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
] as const;

export const monthNames = [
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
] as const;
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

export function minstrftime(format = "", date: Date = new Date()) {
	type Padding = Readonly<{
		readPadChar: string;
		padChar: string;
		padFactor: number;
		isDefault: boolean;
	}>;

	const defaultPadding: Padding = {
		readPadChar: "",
		padChar: "0",
		padFactor: 1,
		isDefault: true,
	};

	function parsePadding(formatSpecifier: string) {
		const formatSpecifierHandlerMap: Readonly<
			Record<string, () => Readonly<Padding>>
		> = {
			// Pad with zeros
			"0": () => ({
				readPadChar: formatSpecifier,
				padChar: formatSpecifier,
				padFactor: 1,
				isDefault: false,
			}),

			// Do not pad
			"-": () => ({
				readPadChar: formatSpecifier,
				padChar: formatSpecifier,
				padFactor: 0,
				isDefault: false,
			}),

			// Pad with spaces
			_: () => ({
				readPadChar: formatSpecifier,
				padChar: " ",
				padFactor: 1,
				isDefault: false,
			}),
		};

		const handler = formatSpecifierHandlerMap[formatSpecifier];

		return handler ? handler() : defaultPadding;
	}

	let result = "";
	let index = 0;

	while (index < format.length) {
		if (format[index] !== "%") {
			result = result + format[index];
			index = index + 1;
			continue;
		}

		index = index + 1;

		const paddingSpecifier = format[index];

		const padding =
			paddingSpecifier !== undefined
				? parsePadding(paddingSpecifier)
				: defaultPadding;

		const {
			padChar,
			padFactor,
			readPadChar,
			isDefault: isDefaultPadding,
		} = padding;

		if (!isDefaultPadding) {
			index = index + 1;
		}

		const formatHandlerMap: Readonly<Record<string, () => string>> = {
			F: () => minstrftime("%Y-%m-%d", date),
			D: () => minstrftime("%m/%d/%y", date),
			T: () => minstrftime("%H:%M:%S", date),
			R: () => minstrftime("%H:%M", date),
			r: () => minstrftime("%I:%M:%S %p", date),
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
			m: () =>
				(date.getMonth() + 1).toString().padStart(2 * padFactor, padChar),
			w: () => date.getDay().toString(),
			I: () =>
				hours24to12(date.getHours())
					.hours.toString()
					.padStart(2 * padFactor, padChar),
			P: () => hours24to12(date.getHours()).ampm,
			p: () => hours24to12(date.getHours()).ampm.toUpperCase(),
			s: () => Math.floor(date.getTime() / 1000).toString(),
			u: () => date.getTime().toString(),
			A: () => weekdayNames[date.getDay()]!,
			a: () => weekdayNames[date.getDay()]!.slice(0, 3),
			B: () => monthNames[date.getMonth()]!,
			b: () => monthNames[date.getMonth()]!.slice(0, 3),
			"%": () => "%",
			t: () => "\t",
		};

		const formatSpecifier = format[index];

		const defaultChunkToAppend = `%${readPadChar}${formatSpecifier ?? ""}`;

		const chunkToAppend =
			formatSpecifier !== undefined
				? (formatHandlerMap[formatSpecifier]?.() ?? defaultChunkToAppend)
				: defaultChunkToAppend;

		result = result + chunkToAppend;
		index = index + 1;
	}

	return result;
}

export const minstrftimeSubstitutionMaps = {
	en: {},
	ru: {
		Apr: "апреля",
		Aug: "августа",
		Dec: "декабря",
		Feb: "февраля",
		Fri: "Пт",
		Jan: "января",
		Jul: "июля",
		Jun: "июня",
		Mar: "марта",
		May: "мая",
		Mon: "Пн",
		Nov: "ноября",
		Oct: "октября",
		Sat: "Сб",
		Sep: "сентября",
		Sun: "Вс",
		Thu: "Чт",
		Tue: "Вт",
		Wed: "Ср",
	},
} as const;

export const dateFormatLocales = {
	en: {
		format: "%m/%d/%Y %r",
		verboseFormat: "%b %-d, %Y (%a) %r",
		timeFirst: "%r, %b %-d, %Y (%a)",
		timeOnly: "%r",
		dateOnly: "%b %-d, %Y",
		numericDateOnly: "%F",
		hourMinuteOnly: "%I:%M %p",
	},
	ru: {
		format: "%d.%m.%Y %T",
		verboseFormat: "%-d %b, %Y (%a) %T",
		timeFirst: "%T, %-d %b, %Y (%a)",
		timeOnly: "%T",
		dateOnly: "%-d %b, %Y",
		numericDateOnly: "%d.%m.%Y",
		hourMinuteOnly: "%H:%M",
	},
} as const;

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

export const relativeDateLocales = {
	en: {
		daysAgo: (days: number) => `${days} days ago`,
		yesterday: "yesterday",
		hoursAgo: (hours: number) => `${hours} hours ago`,
		oneHourAgo: "1 hour ago",
		minutesAgo: (minutes: number) => `${minutes} minutes ago`,
		oneMinuteAgo: "a minute ago",
		secondsAgo: (seconds: number) => `${seconds} seconds ago`,
		justThen: "just then",
		inSeconds: (seconds: number) => `in ${seconds} seconds`,
		inOneMinute: "in a minute",
		inMinutes: (minutes: number) => `in ${minutes} minutes`,
		inOneHour: "in 1 hour",
		inHours: (hours: number) => `in ${hours} hours`,
		tomorrow: "tomorrow",
		inDays: (days: number) => `in ${days} days`,
	},
	ru: {
		daysAgo: (days: number) =>
			`${days} ${["день", "дня", "дней"][getPluralizationIndex("ru", days)]} назад`,
		yesterday: "вчера",
		hoursAgo: (hours: number) =>
			`${hours} час${["", "а", "ов"][getPluralizationIndex("ru", hours)]} назад`,
		oneHourAgo: "час назад",
		minutesAgo: (minutes: number) =>
			`${minutes} минут${["а", "ы", ""][getPluralizationIndex("ru", minutes)]} назад`,
		oneMinuteAgo: "одну минуту назад",
		secondsAgo: (seconds: number) =>
			`${seconds} секунд${["а", "ы", ""][getPluralizationIndex("ru", seconds)]} назад`,
		justThen: "только что",
		inSeconds: (seconds: number) =>
			`через ${seconds} секунд${["у", "ы", ""][getPluralizationIndex("ru", seconds)]}`,
		inOneMinute: "через минуту",
		inMinutes: (minutes: number) =>
			`через ${minutes} минут${["у", "ы", ""][getPluralizationIndex("ru", minutes)]}`,
		inOneHour: "через час",
		inHours: (hours: number) =>
			`через ${hours} час${["", "а", "ов"][getPluralizationIndex("ru", hours)]}`,
		tomorrow: "завтра",
		inDays: (days: number) =>
			`через ${days} ${["день", "дня", "дней"][getPluralizationIndex("ru", days)]}`,
	},
} as const;

const minute = 60;
const hour = minute * 60;
const day = hour * 24;

// We call relative dates the dates that are relative to today.
// For example, if today is May 10, then May 9 is formatted
// as simply 'Yesterday'.
export function formatRelativeDate(
	dateObject: Date,
	relativeToDateObject: Date,
	dateLocale: DateLocale,
) {
	const delta = Math.round(
		(relativeToDateObject.getTime() - dateObject.getTime()) / 1000,
	);

	const locale: DateLocale = dateLocale ?? relativeDateLocales.en;

	function formatFutureDate(locale: DateLocale, delta: number) {
		const absDelta = Math.abs(delta);

		if (absDelta < 30) {
			return locale.justThen;
		}
		if (absDelta < minute) {
			return locale.inSeconds(absDelta);
		}
		if (absDelta < 2 * minute) {
			return locale.inOneMinute;
		}
		if (absDelta < hour) {
			return locale.inMinutes(Math.floor(absDelta / minute));
		}
		if (Math.floor(absDelta / hour) === 1) {
			return locale.inOneHour;
		}
		if (absDelta < day) {
			return locale.inHours(Math.floor(absDelta / hour));
		}
		if (absDelta < day * 2) {
			return locale.tomorrow;
		}

		return locale.inDays(Math.floor(absDelta / day));
	}

	function formatPastDate(locale: DateLocale, delta: number) {
		if (delta < 30) {
			return locale.justThen;
		}
		if (delta < minute) {
			return locale.secondsAgo(delta);
		}
		if (delta < 2 * minute) {
			return locale.oneMinuteAgo;
		}
		if (delta < hour) {
			return locale.minutesAgo(Math.floor(delta / minute));
		}
		if (Math.floor(delta / hour) === 1) {
			return locale.oneHourAgo;
		}
		if (delta < day) {
			return locale.hoursAgo(Math.floor(delta / hour));
		}
		if (delta < day * 2) {
			return locale.yesterday;
		}

		return locale.daysAgo(Math.floor(delta / day));
	}

	const isFuture = delta < 0;
	const format = isFuture ? formatFutureDate : formatPastDate;

	return format(locale, delta);
}

export function getMillisecondsAsHMSUComponents(milliseconds?: number) {
	if (
		milliseconds === null ||
		milliseconds === undefined ||
		Number.isNaN(milliseconds)
	) {
		return null;
	}

	const SECOND_MILLISECONDS = 1000;
	const MINUTE_MILLISECONDS = 60 * SECOND_MILLISECONDS;
	const HOUR_MILLISECONDS = 60 * MINUTE_MILLISECONDS;

	const hours = Math.floor(milliseconds / HOUR_MILLISECONDS);
	const minutes = Math.floor(
		(milliseconds % HOUR_MILLISECONDS) / MINUTE_MILLISECONDS,
	);
	const seconds = Math.floor(
		(milliseconds % MINUTE_MILLISECONDS) / SECOND_MILLISECONDS,
	);
	const ms = milliseconds % SECOND_MILLISECONDS;

	const hh = String(hours).padStart(2, "0");
	const mm = String(minutes).padStart(2, "0");
	const ss = String(seconds).padStart(2, "0");
	const uuu = String(ms).padStart(3, "0");

	return { hh, mm, ss, uuu };
}

export function formatMillisecondsAsHMSU(
	milliseconds?: number,
	{ millisecondsShown = true } = {},
): string {
	const components = getMillisecondsAsHMSUComponents(milliseconds);

	if (components === null) {
		return millisecondsShown ? "??:??:??.???" : "??:??:??";
	}

	const { hh, mm, ss, uuu } = components;

	return millisecondsShown ? `${hh}:${mm}:${ss}.${uuu}` : `${hh}:${mm}:${ss}`;
}

export function formatMillisecondsAsHM(milliseconds?: number): string {
	const components = getMillisecondsAsHMSUComponents(milliseconds);

	if (components === null) {
		return "??:??";
	}

	const { hh, mm } = components;

	return `${hh}:${mm}`;
}

export function isNowAfter(target: string) {
	const now = Date.now();
	const t = Date.parse(target);

	if (Number.isNaN(t)) {
		throw new Error("Invalid target date");
	}

	return now > t;
}
