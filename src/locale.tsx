import {
  createContext,
  type JSX,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { LocaleDates } from '@/locales/dates';
import { en, enDates } from '@/locales/en';
import { ru, ruDates } from '@/locales/ru';
import type { PluralRule } from '@/util/pluralization';
import { getPluralizationIndex, registerPluralRule } from '@/util/pluralization';
import { substituteStringByMap } from '@/util/record';

// Re-exported so a component can name the shape of a locale's dates without reaching into the locale
// files themselves, which are the one layer a component may not import.
export type { LocaleDates };

/**
 * The locales the library ships translations for.
 *
 * A set and not the whole answer: a caller adds any language it likes through
 * {@link registerLocale} or `LocaleProvider messages`, and the library renders it.
 */
export const supportedLocales = ['en', 'ru'] as const;

/**
 * One of the locales the library ships data for.
 *
 * Distinct from {@link LocaleName}, which is every locale a caller may ask for: this is the set the
 * library answers for on its own, and the key of the built-in data tables.
 */
export type BuiltinLocaleName = (typeof supportedLocales)[number];

/** The date data each shipped locale carries. */
const builtinDates: Readonly<Record<BuiltinLocaleName, LocaleDates>> = {
  en: enDates,
  ru: ruDates,
};

/**
 * A locale name.
 *
 * The shipped locales are a literal union, and the `string` arm is what makes `initialLocale="de"`
 * legal — a language the library has never heard of is a supported locale, not a type error.
 */
export type LocaleName = (typeof supportedLocales)[number] | (string & {});

/** The locale used when nothing else applies, and the last resort for an unknown name. */
export const fallbackLocale: LocaleName = 'en';

/** A message catalogue: message keys mapped to their translation. */
export type MessageCatalogue = Record<string, string>;

/** The writing system a locale uses, which some components lay out differently. */
export type LocaleScript = 'latin' | 'cyrillic' | 'rtl';

/**
 * Everything the library needs to render a language it does not ship.
 *
 * Each part is optional because a caller may have some of it and not the rest: messages without
 * plural rules fall back to the English rule, and plural rules without dates leave the calendars on
 * the fallback locale's data.
 */
export interface LocaleDefinition {
  /** Translations of the library's messages. Merged over the shipped catalogues. */
  readonly messages?: MessageCatalogue | undefined;
  /** The names, formats and relative phrases the date components render with. */
  readonly dates?: LocaleDates | undefined;
  /** The writing system, for right-to-left and non-Latin layout. */
  readonly script?: LocaleScript | undefined;
  /** Which plural form a count selects, for messages that carry more than one form. */
  readonly pluralRule?: PluralRule | undefined;
}

/** Locales registered by a caller, keyed by their primary language subtag. */
const registeredLocales = new Map<string, LocaleDefinition>();

/**
 * Adds a language the library does not ship, or overrides the parts of one it does.
 *
 * Registered by the primary language subtag, so `de-AT` resolves against `de`. This is the
 * application-wide way to add a language; {@link LocaleProvider} takes the same definition as a prop
 * for a caller that would rather not touch global state.
 *
 * Registering the same language twice merges with what is there rather than replacing it, because
 * more than one module may register part of a language: `{ en: { save: 'Store' } }` from one and
 * `{ en: { cancel: 'Abbrechen' } }` from another give a language with both, where replacing would
 * leave one of them with nothing. `dates` is the exception, because a half-specified set of month
 * names and format strings is not a set of dates.
 */
export function registerLocale(locale: LocaleName, definition: LocaleDefinition): void {
  const tag = primaryLanguageSubtag(locale);

  registeredLocales.set(tag, mergeDefinition(registeredLocales.get(tag), definition));

  if (definition.pluralRule !== undefined) {
    registerPluralRule(locale, definition.pluralRule);
  }
}

/**
 * Combines a new definition with what is already registered under the same language.
 *
 * The registry holds one definition per language tag, so a second registration used to replace the
 * first outright — and two modules each registering part of one language left only whichever came
 * last. Merging is what makes registering from two places safe, and it follows the same rules as
 * {@link LocaleProvider}'s props: messages merge one at a time, `dates` replaces because a month name
 * and a format string are read together, and `script` and `pluralRule` are single values for which
 * the later registration is simply the current answer.
 */
function mergeDefinition(
  existing: LocaleDefinition | undefined,
  definition: LocaleDefinition,
): LocaleDefinition {
  if (existing === undefined) {
    return definition;
  }

  const combined: LocaleDefinition = { ...existing, ...definition };

  if (existing.messages === undefined || definition.messages === undefined) {
    // One side had no messages, so the spread above already carried the side that did. Saying so is
    // the point: adding an empty `messages` would make a locale look like it had translations where
    // it has none.
    return combined;
  }

  return { ...combined, messages: mergeMessages(existing.messages, definition.messages) };
}

/** The definition registered for a locale, or `undefined` when nothing registered one. */
export function getLocaleDefinition(locale: LocaleName): LocaleDefinition | undefined {
  return registeredLocales.get(primaryLanguageSubtag(locale));
}

/** The catalogues a registered locale contributed, under the locale's own tag. */
function registeredCatalogues(): Record<string, MessageCatalogue> {
  const catalogues: Record<string, MessageCatalogue> = {};
  for (const [locale, definition] of registeredLocales) {
    if (definition.messages !== undefined) {
      catalogues[locale] = definition.messages;
    }
  }
  return catalogues;
}

/**
 * Merges a caller's catalogues over the library's, one message at a time.
 *
 * Per message rather than per locale, and that is the whole point: `messages={{ en: { a: 'A' } }}` is
 * how a caller overrides one string, and merging per locale would drop every other key the locale
 * held — so the one string that was overridden would come out right and every other label on the
 * panel would come out as its key.
 */
export function mergeCatalogues(
  base: Readonly<Record<string, MessageCatalogue>>,
  overrides: Readonly<Record<string, MessageCatalogue>>,
): Readonly<Record<string, MessageCatalogue>> {
  const merged: Record<string, MessageCatalogue> = { ...base };

  for (const [locale, catalogue] of Object.entries(overrides)) {
    merged[locale] = mergeMessages(merged[locale] ?? {}, catalogue);
  }

  return merged;
}

/**
 * Merges one locale's messages over another's, which is the single rule {@link mergeCatalogues} and
 * {@link registerLocale} both need.
 */
function mergeMessages(
  base: Readonly<MessageCatalogue>,
  overrides: Readonly<MessageCatalogue>,
): MessageCatalogue {
  return { ...base, ...overrides };
}

/**
 * The keys the library renders, derived from the English catalogue.
 *
 * Deriving from a value rather than declaring a union of string literals means a key exists because a
 * message was added, not because a type was edited: a catalogue typed `Record<MessageKey, string>` is
 * a translation of this one, or it does not compile. {@link AnyMessageKey} widens the set for the one
 * signature that has to take a caller's keys too.
 */
export type MessageKey = keyof typeof en;

/**
 * A key {@link LocaleContextValue.t} resolves: one the library ships, or one the caller added.
 *
 * The `string` arm is what makes a caller's own key legal — the library cannot know the keys of a
 * catalogue it has never seen — and `MessageKey` stays the named arm, so the library's keys are the
 * ones autocomplete offers first and a caller still reads the union rather than a bare `string`.
 *
 * The same pattern as {@link LocaleName}, for the same reason: a language the library has never
 * heard of is a supported locale rather than a type error, and a message of a catalogue it has
 * never seen is a resolvable key rather than a type error too.
 */
export type AnyMessageKey = MessageKey | (string & {});

/** Parameters substituted into a message, referenced as `{name}` in the text. */
export type MessageParameters = Record<string, string | number | boolean | null | undefined>;

/**
 * The catalogues the library renders with: the shipped ones, then whatever a caller registered.
 *
 * English is the source of the key set; a shipped translation is typed against it, so a message
 * missing from one is a type error rather than a blank label on a panel someone is reading. A caller's
 * catalogue is typed `Record<string, string>`, because a language the library has never seen is
 * allowed to translate more or fewer keys than the library renders.
 */
export function builtinCatalogues(): Readonly<Record<string, MessageCatalogue>> {
  return mergeCatalogues(SHIPPED_CATALOGUES, registeredCatalogues());
}

const SHIPPED_CATALOGUES: Readonly<Record<string, MessageCatalogue>> = { en, ru };

/**
 * The date data for a locale, falling back to the fallback locale.
 *
 * Dates are not messages: a format string and a month heading are structured data, so a locale
 * carries them beside its messages as a whole set rather than as keys. The chain is the registered
 * locale, the shipped locale, the fallback locale, then English as the last resort.
 */
export function getLocaleDates(
  locale: LocaleName,
  fallback: LocaleName = fallbackLocale,
): LocaleDates {
  return (
    getLocaleDefinition(locale)?.dates ??
    getBuiltinDates(locale) ??
    getBuiltinDates(fallback) ??
    builtinDates.en
  );
}

/** The shipped dates for a locale, or `undefined` for one the library ships no data for. */
function getBuiltinDates(locale: LocaleName): LocaleDates | undefined {
  // A caller may ask for any locale name at all, so the table is looked up through a guard rather than
  // indexed. Typing it `Record<string, LocaleDates>` would answer for every string, including the ones
  // that ship nothing.
  return isBuiltinLocaleName(locale) ? builtinDates[locale] : undefined;
}

/** The shipped and registered date data, for the provider to merge a caller's dates over. */
function builtinCataloguesDates(): Readonly<Record<string, LocaleDates>> {
  const dates: Record<string, LocaleDates> = { ...builtinDates };

  for (const [locale, definition] of registeredLocales) {
    if (definition.dates !== undefined) {
      dates[locale] = definition.dates;
    }
  }

  return dates;
}

function isBuiltinLocaleName(locale: string): locale is BuiltinLocaleName {
  return supportedLocales.some((name) => name === locale);
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
  fallback: LocaleName = fallbackLocale,
): string {
  const message = catalogues[locale]?.[key] ?? catalogues[fallback]?.[key] ?? key;

  return expandPluralForms(substituteParameters(message, parameters), locale, parameters);
}

/**
 * What {@link useLocale} returns: the locale in effect, its date data, and the two ways to resolve a
 * message.
 *
 * `t` and `tRaw` differ in their name and in nothing else: both resolve a message the same way,
 * down to returning an unknown key as itself, and both accept a key of the library's and a key the
 * caller added to its own catalogue. `t` names the library's keys, so they are the ones autocomplete
 * offers; `tRaw` is the name that claims nothing about where the key came from.
 */
export interface LocaleContextValue {
  /** The locale in effect. */
  readonly lang: LocaleName;
  /** The names, formats and relative phrases the date components render with. */
  readonly dates: LocaleDates;
  /**
   * Resolves a message, whether the library rendered it or the caller added it to a catalogue.
   *
   * A key no catalogue holds comes back as the key itself, which is what {@link translate} does and
   * what {@link LocaleContextValue.tRaw} does: a caller must not get a different answer for the same
   * missing string depending on which of the two it reached for. The key is worth showing because it
   * names the message that is missing — an operator seeing `Modal.close` knows to tell someone, where
   * a blank button tells nobody anything and cannot be looked up.
   */
  readonly t: (key: AnyMessageKey, parameters?: MessageParameters | null) => string;
  /**
   * Resolves an arbitrary string, under a name that says nothing about where the key came from.
   *
   * Behaves exactly as {@link LocaleContextValue.t}, including returning an unknown key as-is. The
   * two differ in their name only, and both are kept because a caller may have written against
   * either.
   */
  readonly tRaw: (key: string, parameters?: MessageParameters | null) => string;
  /** Switches the locale and persists the choice. */
  readonly setLocale: (locale: LocaleName) => void;
  /** True when the locale is written right to left. */
  readonly isRtl: boolean;
  /** True when the locale is written in a non-Latin script, which some components lay out differently. */
  readonly isCyrillic: boolean;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/** Locales written right to left. A locale registered as `rtl` joins them. */
const RTL_LANGUAGES = new Set(['ar', 'fa', 'he', 'ur', 'yi']);

/** Locales written in the Cyrillic script, which affects plural rules and some layouts. */
const CYRILLIC_LANGUAGES = new Set(['be', 'bg', 'kk', 'ky', 'mk', 'mn', 'ru', 'sr', 'tg', 'uk']);

/** The script a locale is written in, registered first and inferred from the built-in sets second. */
function getLocaleScript(locale: LocaleName): LocaleScript | undefined {
  const registered = getLocaleDefinition(locale)?.script;
  if (registered !== undefined) {
    return registered;
  }

  const language = primaryLanguageSubtag(locale);
  if (RTL_LANGUAGES.has(language)) {
    return 'rtl';
  }
  return CYRILLIC_LANGUAGES.has(language) ? 'cyrillic' : undefined;
}

function primaryLanguageSubtag(locale: LocaleName): string {
  return locale.split('-')[0]?.toLowerCase() ?? '';
}

/** A language the library renders with: one it ships, or one a caller registered. */
function knownLocales(): readonly string[] {
  return [...supportedLocales, ...registeredLocales.keys()];
}

/**
 * What {@link LocaleProvider} takes.
 *
 * Every prop has a working default: with no props beyond `children` the provider detects the
 * browser's locale, uses the shipped catalogues, and persists the operator's choice under
 * {@link LOCALE_STORAGE_KEY}. The `messages` and `dates` props are how a consumer translates the
 * library without registering a locale, and a single message override does not require copying a
 * whole catalogue.
 */
export interface LocaleProviderProps {
  readonly children: ReactNode;
  /**
   * The locale to start in. Defaults to the browser's preference when the library can render it, and
   * to the fallback locale otherwise.
   */
  readonly initialLocale?: LocaleName | undefined;
  /**
   * Messages by locale, merged over the shipped catalogues one message at a time.
   *
   * This is how a caller translates the library into any language, and how it overrides a single
   * string without forking the library: a locale listed here keeps every message it already had and
   * takes the ones named here instead. Its own keys are welcome — the library never needs to know
   * about them, and {@link LocaleContextValue.t} resolves them beside its own.
   *
   * A caller's catalogue wins over a registered one for the same locale, because it is the more
   * specific of the two: a prop was passed to this provider, the registry was set up by the module
   * that imported it first.
   */
  readonly messages?: Readonly<Record<string, MessageCatalogue>> | undefined;
  /**
   * Date data by locale, replacing the shipped data for the locales named here.
   *
   * Replacing rather than merging is the shape of the thing: a month name and a format string are
   * read together by the date components, and half a locale's dates is not a locale's dates. A
   * language with no dates here renders the fallback locale's month names and format strings.
   */
  readonly dates?: Readonly<Record<string, LocaleDates>> | undefined;
  /** The locale a missing message or a missing date falls back to. Defaults to {@link fallbackLocale}. */
  readonly fallbackLocale?: LocaleName | undefined;
  /** Decides the initial locale. Defaults to the browser's preference, then the stored choice. */
  readonly detectLocale?: (() => LocaleName | undefined) | undefined;
  /** Persist the chosen locale under this key. Pass `null` to not persist it at all. */
  readonly storageKey?: string | null | undefined;
}

function readStoredLocale(storageKey: string | null): string | null {
  if (storageKey === null) {
    return null;
  }
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored !== null && stored !== '') {
      return stored;
    }
    return null;
  } catch {
    // Storage may be unavailable; the browser preference is still usable.
    return null;
  }
}

/** The best locale the library can render for a candidate, by exact tag and then by language. */
function matchLocaleFromCandidate(candidate: string): LocaleName | null {
  const languages = knownLocales();
  const exact = languages.find((locale) => locale === candidate);
  if (exact !== undefined) {
    return exact;
  }

  const language = primaryLanguageSubtag(candidate);
  return languages.find((locale) => primaryLanguageSubtag(locale) === language) ?? null;
}

function detectLocaleFromPreferences(): LocaleName {
  const preferred = globalThis.navigator?.languages ?? [globalThis.navigator?.language];
  for (const candidate of preferred) {
    if (candidate === undefined) {
      continue;
    }
    const matched = matchLocaleFromCandidate(candidate);
    if (matched !== null) {
      return matched;
    }
  }
  return fallbackLocale;
}

function detectInitialLocale(storageKey: string | null): LocaleName {
  const stored = readStoredLocale(storageKey);
  if (stored !== null) {
    return stored;
  }
  return detectLocaleFromPreferences();
}

/**
 * Supplies the locale to every component below it.
 *
 * Wrap the application once. Without a provider the components still render, in the fallback locale:
 * a component library that throws when it is mounted inside a test or a design review is a component
 * library nobody can use.
 */
export function LocaleProvider({
  children,
  initialLocale,
  messages,
  dates,
  fallbackLocale: fallback = fallbackLocale,
  detectLocale,
  storageKey = LOCALE_STORAGE_KEY,
}: LocaleProviderProps): JSX.Element {
  const [lang, setLang] = useState<LocaleName>(() => {
    const detected = detectLocale?.() ?? detectInitialLocale(storageKey);
    return initialLocale ?? detected;
  });

  const catalogues = useMemo<Readonly<Record<string, MessageCatalogue>>>(
    () => mergeCatalogues(builtinCatalogues(), messages ?? {}),
    [messages],
  );

  const localeDates = useMemo<Readonly<Record<string, LocaleDates>>>(
    () => ({ ...builtinCataloguesDates(), ...dates }),
    [dates],
  );

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

      // The document language matters for the browser's hyphenation and for assistive technology,
      // and the library is what knows which locale it just switched to.
      document.documentElement?.setAttribute('lang', nextLocale);
    },
    [storageKey],
  );

  useEffect(() => {
    document.documentElement?.setAttribute('lang', lang);
  }, [lang]);

  const tRaw = useCallback(
    (key: string, parameters?: MessageParameters | null) =>
      translate(catalogues, lang, key, parameters, fallback),
    [catalogues, lang, fallback],
  );

  const t = useCallback(
    (key: AnyMessageKey, parameters?: MessageParameters | null) => tRaw(key, parameters),
    [tRaw],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      lang,
      dates: localeDates[lang] ?? localeDates[fallback] ?? builtinDates.en,
      t,
      tRaw,
      setLocale,
      isRtl: getLocaleScript(lang) === 'rtl',
      isCyrillic: getLocaleScript(lang) === 'cyrillic',
    }),
    [lang, localeDates, fallback, t, tRaw, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

const unmanagedContextValue: LocaleContextValue = {
  lang: fallbackLocale,
  dates: builtinDates.en,
  t: (key, parameters) => translate(builtinCatalogues(), fallbackLocale, key, parameters),
  tRaw: (key, parameters) => translate(builtinCatalogues(), fallbackLocale, key, parameters),
  setLocale: () => {
    // Outside a provider there is no locale state to change. Doing nothing silently keeps a component
    // that offers a language switch from crashing when it is rendered on its own.
  },
  isRtl: false,
  isCyrillic: false,
};

/**
 * The locale, and the function that resolves the messages a component renders.
 *
 * Returns the fallback locale rather than throwing when no {@link LocaleProvider} is above it, so a
 * single component can be rendered on its own without the whole application around it. A switch
 * rendered this way does nothing, which is the lesser evil next to a component that cannot be looked
 * at.
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
  return getLocaleScript(locale) === 'cyrillic';
}

/** True when the locale is written right to left. */
export function isLocaleWithRtlScript(locale: LocaleName): boolean {
  return RTL_LANGUAGES.has(primaryLanguageSubtag(locale));
}
