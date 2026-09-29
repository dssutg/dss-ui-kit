import { useCallback } from "react";
import {
	type BCPType,
	globalState,
	onGlobalStateUpdate,
	useAppState,
} from "@/def";
import { emitTypedEvent } from "@/event";
import { getPluralizationIndex } from "@/lib/pluralization";
import { substituteStringByMap } from "@/lib/record";
import type {
	LocaleKey,
	LocaleKeyWithParameters,
	LocaleKeyWithoutParameters,
	LocaleParameters,
} from "@/locale_schema";
import { en } from "@/locales/en";
import { ru } from "@/locales/ru";

export const validLocales = ["en", "ru"] as const;

export type LocaleName = (typeof validLocales)[number];

export function isValidLocale(localeName: string): localeName is LocaleName {
	return new Set<string>(validLocales).has(localeName);
}

export const fallBackLocale: LocaleName = "ru";

export function getLocaleName() {
	return globalState.locale.lang;
}

export const allLocales: Readonly<
	Record<LocaleName, Record<LocaleKey, string>>
> = {
	en,
	ru,
};

export const locale = allLocales;

export function getTranslation<K extends LocaleKeyWithoutParameters>(
	localeKey: K | "" | undefined | null,
	parameters?: null,
): string;

export function getTranslation<K extends LocaleKeyWithParameters>(
	localeKey: K | "" | undefined | null,
	parameters: LocaleParameters[K],
): string;

export function getTranslation<K extends LocaleKey>(
	localeKey: K | "" | undefined | null,
	parameters: K extends LocaleKey ? LocaleParameters[K] : null,
): string {
	if (localeKey === undefined || localeKey === null || localeKey === "") {
		return "";
	}

	const lang = getLocaleName();

	const title =
		locale[lang]?.[localeKey] ?? locale[fallBackLocale][localeKey] ?? localeKey;

	const substitutionMap: Record<string, string> = {};

	if (parameters) {
		for (const key in parameters) {
			substitutionMap[`{${key}}`] = (
				(parameters as Record<string, string>)[key] ?? ""
			).toString();
		}
	}

	const expanded = substituteStringByMap(title, substitutionMap);

	const final = expanded.replace(
		/{:(P):([A-Z_a-z]\w*):(\d+):(.*?)}/g,
		(_match, _mode, counter, index, form) => {
			const count = (parameters as Record<string, string>)?.[counter];

			if (count === undefined) {
				console.error(
					`Unknown parameter ${counter} in locale key ${localeKey}`,
				);
			}

			let localeName = fallBackLocale;
			if (locale[lang] !== undefined) {
				localeName = lang;
			}

			const pluralizationIndex = getPluralizationIndex(
				localeName,
				Number(count ?? 0) || 0,
			);

			if (parseInt(index, 10) !== pluralizationIndex) {
				return "";
			}

			return form;
		},
	);

	return final;
}

export function isLocaleWithCyrillicScript(locale: LocaleName) {
	return locale === "ru";
}

const keyCountMap: Record<string, number> = {};

for (const [, keys] of Object.entries(allLocales)) {
	for (const key of Object.keys(keys)) {
		keyCountMap[key] = (keyCountMap[key] ?? 0) + 1;
	}
}

const localeCount = Object.keys(allLocales).length;

for (const [key, count] of Object.entries(keyCountMap)) {
	if (count !== localeCount) {
		console.warn(`Key ${key} is not present in all locales`);
	}
}

const bcpTypeToLocaleKeyMap: Record<BCPType, LocaleKeyWithoutParameters> = {
	standard: "bcpTitleStandard",
	main: "bcpTitleMain",
	backup: "bcpTitleBackup",
};

export function getBCPTypeTitle(bcpType: BCPType) {
	return getTranslation(bcpTypeToLocaleKeyMap[bcpType]);
}

export function useLocale() {
	const lang: LocaleName = useAppState((s) => s.locale.lang);

	const L = locale[lang];

	// biome-ignore lint: lint/correctness/useExhaustiveDependencies: need to update t reference to reflect lang change
	const t: typeof getTranslation = useCallback(
		// biome-ignore lint: lint/suspicious/noExplicitAny
		(localeKey: any, parameters: any) => getTranslation(localeKey, parameters),
		[lang],
	);

	// biome-ignore lint: lint/correctness/useExhaustiveDependencies: need to update t reference to reflect lang change
	const tCfg = useCallback(
		(localeSubKey: string) =>
			getTranslation(`cfg.${localeSubKey}` as LocaleKeyWithoutParameters, null),
		[lang],
	);

	return { L, t, tCfg, lang, locale, fallBackLocale };
}

export function alterLocale(localeName: LocaleName) {
	globalState.locale = { ...globalState.locale, lang: localeName };
	onGlobalStateUpdate();

	localStorage.setItem("locale", localeName);
	emitTypedEvent("SETTINGS_UPDATE", null);

	document.documentElement.setAttribute("lang", localeName);
}

export const localeTitles = {
	aa: "Afaraf",
	ab: "Аҧсуа",
	af: "Afrikaans",
	am: "አማርኛ",
	ar: "العربية",
	as: "অসমীয়া",
	av: "Авар",
	ay: "Aymara",
	az: "Azərbaycanca",
	ba: "Башҡортса",
	be: "Беларуская",
	bg: "Български",
	bm: "Bamanankan",
	bn: "বাংলা",
	br: "Breton",
	bs: "Bosanski",
	ca: "Català",
	ce: "Нохчийн",
	ch: "Chamorro",
	co: "Corsu",
	cs: "Čeština",
	cv: "Чӑваш",
	cy: "Cymraeg",
	da: "Dansk",
	de: "Deutsch",
	el: "Ελληνικά",
	en: "English",
	eo: "Esperanto",
	es: "Español",
	et: "Eesti",
	eu: "Euskara",
	fi: "Suomi",
	fo: "Føroyskt",
	fr: "Français",
	gl: "Galego",
	gu: "ગુજરાતી",
	he: "עברית",
	hi: "हिन्दी",
	hr: "Hrvatski",
	hu: "Magyar",
	hy: "Հայերեն",
	id: "Bahasa Indonesia",
	ig: "Igbo",
	is: "Íslenska",
	it: "Italiano",
	ja: "日本語",
	jv: "Basa Jawa",
	ka: "ქართული",
	km: "ភាសាខ្មែរ",
	kn: "ಕನ್ನಡ",
	ko: "한국어",
	ku: "Kurdî",
	la: "Latina",
	lb: "Lëtzebuergesch",
	li: "Limburgs",
	lt: "Lietuvių",
	lv: "Latviešu",
	mk: "Македонски",
	ml: "മലയാളം",
	mn: "Монгол",
	mr: "मराठी",
	ms: "Bahasa Melayu",
	mt: "Malti",
	ne: "नेपाली",
	nl: "Nederlands",
	ny: "Chichewa",
	or: "ଓଡ଼ିଆ",
	pa: "ਪੰਜਾਬੀ",
	pl: "Polski",
	pt: "Português",
	ro: "Română",
	ru: "Русский",
	si: "සිංහල",
	sk: "Slovenčina",
	sl: "Slovenščina",
	sq: "Shqip",
	su: "Basa Sunda",
	sv: "Svenska",
	sw: "Swahili",
	ta: "தமிழ்",
	te: "తెలుగు",
	th: "ไทย",
	tl: "Tagalog",
	tr: "Türkçe",
	uk: "Українська",
	vi: "Tiếng Việt",
	xh: "isiXhosa",
	yi: "ייִדיש",
	zh: "中文",
	zu: "isiZulu",
};
