/**
 * Pluralization rules.
 *
 * How many forms a language has, and which one a count selects, is a property of the language rather
 * than of this library. The two shipped locales are implemented here because they are the ones the
 * library ships messages for; a consumer adding a language registers its own rules through
 * {@link registerPluralRule} so its messages pluralize correctly instead of falling back to English.
 */

/** Selects the form to use for a count, from a table of thresholds. */
export type PluralRule = (count: number) => number;

/** The rules for each locale the library knows about. */
const pluralRules = new Map<string, PluralRule>([
	[
		"en",
		// One form for exactly one, another for everything else.
		(count) => Number(count !== 1),
	],
	[
		"ru",
		(count) => {
			// One form for counts ending in 1 but not 11: 1, 21, 31.
			if (count % 10 === 1 && count % 100 !== 11) {
				return 0;
			}

			// A second form for counts ending in 2, 3 or 4, unless the tens also make it a teen:
			// 2, 3, 4, 22, 23, 24 but not 12, 13, 14.
			if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) {
				return 1;
			}

			// Everything else, including 0 and 5 through 20.
			return 2;
		},
	],
]);

/**
 * Registers the plural rules for a locale the library does not ship.
 *
 * Pass the primary language subtag, not a full locale tag, so `de-AT` resolves against `de`.
 */
export function registerPluralRule(locale: string, rule: PluralRule): void {
	pluralRules.set(primarySubtag(locale), rule);
}

function primarySubtag(locale: string): string {
	return locale.split("-")[0]?.toLowerCase() ?? "";
}

/**
 * Which plural form a count selects, zero-based.
 *
 * A locale with no registered rules falls back to the English rule, which is the right guess far more
 * often than the alternatives: it is correct for every language with a singular and a plural form,
 * which is most of them. A language that needs more is registered by the consumer.
 */
export function getPluralizationIndex(locale: string, count: number): number {
	const rule = pluralRules.get(primarySubtag(locale)) ?? pluralRules.get("en");
	return rule === undefined ? 0 : rule(count);
}
