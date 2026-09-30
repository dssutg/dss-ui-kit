import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getPluralizationIndex } from '@/lib/pluralization';
import { substituteStringByMap } from '@/lib/record';
import type { LocaleDates } from '@/locales/dates';
import { en, enDates } from '@/locales/en';
import { ru, ruDates } from '@/locales/ru';

/**
 * The locales the library ships translations for.
 *
 * A UI library that only ships its own component strings still has to pick a set, and shipping both
 * keeps every message the library renders translatable without a consumer writing the library's
 * strings for them.
 */
export const supportedLocales = ['en', 'ru'] as const;

/**
 * The date data each shipped locale carries.
 *
 * Held here rather than in `src/locales/dates.ts` because the strings belong to the locale that
 * speaks them, and a locale without messages would then have no file of its own to put them in.
 */
const builtinDates: Readonly<Record<string, LocaleDates>> = {
  en: enDates,
  ru: ruDates,
};

/**
 * A locale name.
 *
 * The shipped locales are a literal union, but a consumer adding a language is not a type error: the
 * `string` arm is what makes `LocaleProvider initialLocale="de"` legal. A consumer that supplies its
 * own catalogue also supplies the pluralization rules, so a language the library has never seen still
 * formats its counts correctly.
 */
export type LocaleName = (typeof supportedLocales)[number] | (string & {});

export function isSupportedLocale(name: string): name is (typeof supportedLocales)[number] {
  return (supportedLocales as readonly string[]).includes(name);
}

/** The locale used when the browser asks for one the library does not ship. */
export const fallbackLocale = 'en';

/** A message catalogue: every key the library renders, mapped to its translation. */
export type MessageCatalogue = Record<string, string>;

/**
 * The keys the library renders, derived from the English catalogue.
 *
 * Deriving from a value rather than declaring a union of string literals means a key exists because a
 * message was added, not because a type was edited, and a key that is used but never defined is a
 * compile error at the point of use.
 */
export type MessageKey = keyof typeof en;

/** Parameters substituted into a message, referenced as `{name}` in the text. */
export type MessageParameters = Record<string, string | number | boolean | null | undefined>;

/**
 * The catalogues the library ships.
 *
 * English is the source of the key set; the others are typed against it, so a message missing from a
 * translation is a type error rather than a blank label on a panel someone is reading.
 */
export const builtinCatalogues: Readonly<Record<string, MessageCatalogue>> = { en, ru };

/**
 * The date data for a locale, falling back to the fallback locale.
 *
 * Dates are looked up separately from messages because they are not messages: a format string and a
 * month heading are structured data, and a component that has to reach for them should be handed the
 * whole set rather than assembling it from a key lookup.
 */
export function getLocaleDates(locale: LocaleName): LocaleDates {
  return builtinDates[locale] ?? builtinDates[fallbackLocale]!;
}

/** The key the chosen locale is persisted under. Configurable so two libraries can coexist. */
export const LOCALE_STORAGE_KEY = 'ui-kit.locale';

/**
 * Replaces one `{name}` placeholder per parameter.
 *
 * A parameter that is absent or `undefined` becomes an empty string rather than the literal text
 * `{name}`, so a missing value never reaches an operator as a template.
 */
function substituteParameters(
  template: string,
  parameters: MessageParameters | null | undefined,
): string {
  if (!parameters) {
    return template;
  }

  const substitutionMap: Record<string, string> = {};
  for (const [key, value] of Object.entries(parameters)) {
    substitutionMap[`{${key}}`] = value === null || value === undefined ? '' : String(value);
  }

  return substituteStringByMap(template, substitutionMap);
}

/**
 * Expands the pluralization placeholders in a message.
 *
 * The syntax is `{:(P):counter:index:form}`: a message may carry one placeholder per plural form, and
 * exactly one survives. `index` is the form number the locale's rules select for `counter`. A counter
 * that is not a parameter is reported and treated as zero rather than silently producing an empty
 * string, because a message that renders as nothing is harder to notice than a console line.
 */
function expandPluralForms(
  template: string,
  locale: LocaleName,
  parameters: MessageParameters | null | undefined,
): string {
  if (!template.includes('{:(P):')) {
    return template;
  }

  return template.replace(
    /{:(P):([A-Za-z_]\w*):(\d+):([\s\S]*?)}/g,
    (_match, counter: string, index: string, form: string) => {
      const rawCount = parameters?.[counter];

      if (rawCount === undefined || rawCount === null) {
        console.error(
          `Unknown pluralization parameter "${counter}" in message; treating the count as 0.`,
        );
      }

      const count = Number(rawCount ?? 0) || 0;
      const selectedForm = getPluralizationIndex(locale, count);

      return parseInt(index, 10) === selectedForm ? form : '';
    },
  );
}

/**
 * Looks a message up in a set of catalogues.
 *
 * Resolution falls back through the requested locale, then the fallback locale, then the key itself,
 * so a message that exists in neither still renders something identifiable instead of `undefined`.
 */
export function translate(
  catalogues: Readonly<Record<string, MessageCatalogue>>,
  locale: LocaleName,
  key: string,
  parameters?: MessageParameters | null,
): string {
  const catalogue = catalogues[locale];
  const message = catalogue?.[key] ?? catalogues[fallbackLocale]?.[key] ?? key;

  const substituted = substituteParameters(message, parameters);
  return expandPluralForms(substituted, locale, parameters);
}

export interface LocaleContextValue {
  /** The locale in effect. */
  readonly lang: LocaleName;
  /**
   * Resolves a message the library renders.
   *
   * Returns an empty string for an absent key rather than throwing: a component must render while a
   * consumer's catalogue is still being filled in, and a panel that throws is worse than a blank
   * label. The key is not echoed back, because that would put a raw key in front of an operator.
   */
  readonly t: (key: MessageKey, parameters?: MessageParameters | null) => string;
  /** Resolves an arbitrary string, for a message a consumer added to its own catalogue. */
  readonly tRaw: (key: string, parameters?: MessageParameters | null) => string;
  /** Switches the locale and persists the choice. */
  readonly setLocale: (locale: LocaleName) => void;
  /** True when the locale is written right to left. */
  readonly isRtl: boolean;
  /** True when the locale uses a non-Latin script, which some components lay out differently. */
  readonly isCyrillic: boolean;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/** Locales written right to left. Extends as a consumer adds a language. */
const RTL_LANGUAGES = new Set(['ar', 'fa', 'he', 'ur', 'yi']);

/** Locales written in the Cyrillic script, which affects plural rules and some component layouts. */
const CYRILLIC_LANGUAGES = new Set(['be', 'bg', 'kk', 'ky', 'mk', 'mn', 'ru', 'sr', 'tg', 'uk']);

function primaryLanguageSubtag(locale: LocaleName): string {
  return locale.split('-')[0]?.toLowerCase() ?? '';
}

export interface LocaleProviderProps {
  readonly children: ReactNode;
  /**
   * The locale to start in. Defaults to the browser's preference when it is one the library ships,
   * and to the fallback locale otherwise.
   */
  readonly initialLocale?: LocaleName;
  /**
   * Extra or replacement messages, merged over the shipped catalogues.
   *
   * This is how a consumer translates the library into a language it does not ship, and how it
   * overrides an individual string without forking the library. A consumer still adds its own keys
   * here; the library never needs to know about them.
   */
  readonly messages?: Readonly<Record<string, MessageCatalogue>>;
  /** Persist the chosen locale under this key. Pass `null` to not persist it at all. */
  readonly storageKey?: string | null;
}

function detectInitialLocale(storageKey: string | null): LocaleName {
  if (storageKey !== null) {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null && stored !== '') {
        return stored;
      }
    } catch {
      // Storage may be unavailable; the browser preference below is still usable.
    }
  }

  const preferred = globalThis.navigator?.languages ?? [globalThis.navigator?.language];
  for (const candidate of preferred) {
    if (candidate === undefined) {
      continue;
    }
    const exact = supportedLocales.find((locale) => locale === candidate);
    if (exact !== undefined) {
      return exact;
    }
    const byLanguage = supportedLocales.find(
      (locale) => primaryLanguageSubtag(locale) === primaryLanguageSubtag(candidate),
    );
    if (byLanguage !== undefined) {
      return byLanguage;
    }
  }

  return fallbackLocale;
}

/**
 * Supplies the locale to every component below it.
 *
 * Wrap the application once. Without a provider the components still render, in the fallback locale:
 * a component library that throws when it is mounted inside a test or a Storybook story is a
 * component library nobody can use.
 */
export function LocaleProvider({
  children,
  initialLocale,
  messages,
  storageKey = LOCALE_STORAGE_KEY,
}: LocaleProviderProps) {
  const [lang, setLang] = useState<LocaleName>(
    () => initialLocale ?? detectInitialLocale(storageKey),
  );

  const catalogues = useMemo<Readonly<Record<string, MessageCatalogue>>>(() => {
    if (messages === undefined) {
      return builtinCatalogues;
    }
    return { ...builtinCatalogues, ...messages };
  }, [messages]);

  const setLocale = useCallback(
    (nextLocale: LocaleName) => {
      setLang(nextLocale);

      if (storageKey !== null) {
        try {
          localStorage.setItem(storageKey, nextLocale);
        } catch {
          // A locale that cannot be persisted is still a locale that is applied.
        }
      }

      // The document language matters for the browser's own hyphenation and for assistive
      // technology, and the library is what knows which locale it just switched to.
      document.documentElement?.setAttribute('lang', nextLocale);
    },
    [storageKey],
  );

  useEffect(() => {
    document.documentElement?.setAttribute('lang', lang);
  }, [lang]);

  const tRaw = useCallback(
    (key: string, parameters?: MessageParameters | null) =>
      translate(catalogues, lang, key, parameters),
    [catalogues, lang],
  );

  const t = useCallback(
    (key: MessageKey, parameters?: MessageParameters | null) => tRaw(key, parameters),
    [tRaw],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      lang,
      t,
      tRaw,
      setLocale,
      isRtl: RTL_LANGUAGES.has(primaryLanguageSubtag(lang)),
      isCyrillic: CYRILLIC_LANGUAGES.has(primaryLanguageSubtag(lang)),
    }),
    [lang, t, tRaw, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

const unmanagedContextValue: LocaleContextValue = {
  lang: fallbackLocale,
  t: (key, parameters) => translate(builtinCatalogues, fallbackLocale, key, parameters),
  tRaw: (key, parameters) => translate(builtinCatalogues, fallbackLocale, key, parameters),
  setLocale: () => {
    // Outside a provider there is no locale state to change. Silently doing nothing keeps a
    // component that offers a language switch from crashing when it is rendered standalone.
  },
  isRtl: false,
  isCyrillic: false,
};

/**
 * The locale, and the function that resolves the messages a component renders.
 *
 * Returns the fallback locale rather than throwing when no {@link LocaleProvider} is above it, so a
 * single component can be rendered on its own — in a test, a documentation example or a design
 * review — without the whole application around it. A switch rendered this way will not do anything,
 * which is the lesser evil next to a component that cannot be looked at.
 */
export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext) ?? unmanagedContextValue;
}

/**
 * The current locale outside React.
 *
 * Reads the document's `lang` attribute, which {@link LocaleProvider} keeps in step with the value it
 * holds, and falls back to the stored preference.
 */
export function getLocaleName(): LocaleName {
  const fromDocument = document.documentElement?.getAttribute('lang');
  if (fromDocument !== null && fromDocument !== undefined && fromDocument !== '') {
    return fromDocument;
  }

  return detectInitialLocale(LOCALE_STORAGE_KEY);
}

/** True when the locale is written in the Cyrillic script. */
export function isLocaleWithCyrillicScript(locale: LocaleName): boolean {
  return CYRILLIC_LANGUAGES.has(primaryLanguageSubtag(locale));
}

/** True when the locale is written right to left. */
export function isLocaleWithRtlScript(locale: LocaleName): boolean {
  return RTL_LANGUAGES.has(primaryLanguageSubtag(locale));
}
