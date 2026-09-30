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

export function minstrftime(
	format = "",
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
			A: () => names.weekdayNames[date.getDay()]!,
			a: () => names.weekdayNames[date.getDay()]!.slice(0, 3),
			B: () => names.monthNames[date.getMonth()]!,
			b: () => names.monthNames[date.getMonth()]!.slice(0, 3),
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

	// The locale is a required argument: choosing one here would mean choosing a language.
	const locale: DateLocale = dateLocale;

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
