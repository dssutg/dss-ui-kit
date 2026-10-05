/**
 * The locale is the seam between what the library renders and what an operator reads, so these tests
 * are about who wins: the shipped catalogue, a locale a caller registered, or a `messages` prop passed
 * to one provider. They also pin the two ways a caller's own strings reach the screen — `t` for a key
 * the library owns, `tRaw` for one it does not.
 */
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  builtinCatalogues,
  getLocaleDates,
  LocaleProvider,
  type MessageCatalogue,
  mergeCatalogues,
  registerLocale,
  translate,
  useLocale,
} from '@/locale';
import { render } from '@/util/testing/render';

/**
 * Reads one locale's messages out of a catalogue map.
 *
 * The two rules in this repository disagree about how to read an index signature — Biome's
 * `useLiteralKeys` wants `map.en`, and TypeScript's `noPropertyAccessFromIndexSignature` wants
 * `map['en']` — so the read is narrowed once here instead of at every call site. `message` then does
 * the second hop by name, because a message key is not an identifier and has no dot form at all.
 */
function message(
  catalogues: Readonly<Record<string, MessageCatalogue>>,
  locale: string,
  key: string,
): string | undefined {
  return catalogues[locale]?.[key];
}

/** Renders a probe that reports what the locale gives it, so a test can read it back off the DOM. */
function LocaleProbe(): React.JSX.Element {
  const { lang, t, tRaw } = useLocale();

  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="overridden">{t('Modal.close')}</span>
      <span data-testid="untouched">{t('ConfirmationModal.confirm')}</span>
      <span data-testid="own">{tRaw('MyApp.title')}</span>
    </div>
  );
}

describe('a caller overriding one message', () => {
  it('keeps every other message of that locale', async () => {
    // The mistake this pins down is the one a spread at the locale level makes: the override lands
    // right and every other label on the panel comes out as its own key.
    const en = builtinCatalogues();

    const { find } = await render(
      <LocaleProvider
        initialLocale="en"
        storageKey={null}
        messages={{ en: { 'Modal.close': 'Dismiss' } }}
      >
        <LocaleProbe />
      </LocaleProvider>,
    );

    expect(find('[data-testid="overridden"]').textContent).toBe('Dismiss');
    expect(find('[data-testid="untouched"]').textContent).toBe(
      message(en, 'en', 'ConfirmationModal.confirm'),
    );
  });

  it('renders the shipped text for a message it did not name', async () => {
    const { find } = await render(
      <LocaleProvider initialLocale="en" storageKey={null}>
        <LocaleProbe />
      </LocaleProvider>,
    );

    const en = builtinCatalogues();

    expect(find('[data-testid="overridden"]').textContent).toBe(message(en, 'en', 'Modal.close'));
  });

  it('resolves a key the library does not own, through the catalogue the caller passed', async () => {
    // `t` is typed to the library's keys so a typo in one is a compile error; a caller's own keys go
    // through `tRaw`, and the two read the same merged catalogues.
    const { find } = await render(
      <LocaleProvider
        initialLocale="en"
        storageKey={null}
        messages={{ en: { 'MyApp.title': 'Connections' } }}
      >
        <LocaleProbe />
      </LocaleProvider>,
    );

    expect(find('[data-testid="own"]').textContent).toBe('Connections');
  });

  it('overrides a locale the library ships translations for', async () => {
    // The replacement is a marker rather than a translation: what is under test is that a caller's
    // catalogue wins for a locale that already has one, and `no-russian-text` keeps this file from
    // holding the Russian it would otherwise need to show the shipped value was the thing replaced.
    const { find } = await render(
      <LocaleProvider
        initialLocale="ru"
        storageKey={null}
        messages={{ ru: { 'Modal.close': 'caller override' } }}
      >
        <LocaleProbe />
      </LocaleProvider>,
    );

    expect(find('[data-testid="overridden"]').textContent).toBe('caller override');
  });

  it('leaves the shipped catalogues alone, so a second provider is not affected', async () => {
    const shipped = message(builtinCatalogues(), 'en', 'Modal.close');

    await render(
      <LocaleProvider
        initialLocale="en"
        storageKey={null}
        messages={{ en: { 'Modal.close': 'Dismiss' } }}
      >
        <LocaleProbe />
      </LocaleProvider>,
    );

    expect(message(builtinCatalogues(), 'en', 'Modal.close')).toBe(shipped);
  });
});

describe('a locale a caller registers', () => {
  it('renders a language the library does not ship, and falls back for what it left out', async () => {
    registerLocale('xx', { messages: { 'MyApp.title': 'Test title' } });

    const { find } = await render(
      <LocaleProvider initialLocale="xx" storageKey={null}>
        <LocaleProbe />
      </LocaleProvider>,
    );

    expect(find('[data-testid="lang"]').textContent).toBe('xx');
    expect(find('[data-testid="own"]').textContent).toBe('Test title');
  });

  it('keeps the shipped messages of the locale it adds to', () => {
    const shipped = message(builtinCatalogues(), 'en', 'Modal.close');

    registerLocale('en', { messages: { 'MyApp.title': 'Only my key' } });

    expect(message(builtinCatalogues(), 'en', 'Modal.close')).toBe(shipped);
    expect(message(builtinCatalogues(), 'en', 'MyApp.title')).toBe('Only my key');
  });

  it("gives a registered locale the caller's dates", () => {
    // Dates are a whole set rather than a set of keys, so this replaces rather than merges — which
    // is why the two are not documented the same way.
    const dates = getLocaleDates('en');

    registerLocale('xx', {
      dates: {
        ...dates,
        names: { ...dates.names, weekdayNames: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] },
      },
    });

    expect(getLocaleDates('xx').names.weekdayNames[0]).toBe('Su');
    expect(getLocaleDates('en').names.weekdayNames[0]).not.toBe('Su');
  });
});

describe('mergeCatalogues', () => {
  it('merges a message over the one already under that tag', () => {
    const merged = mergeCatalogues({ en: { one: 'One', two: 'Two' } }, { en: { two: 'DUE' } });

    expect(message(merged, 'en', 'one')).toBe('One');
    expect(message(merged, 'en', 'two')).toBe('DUE');
  });

  it('adds a tag that was not there before', () => {
    const merged = mergeCatalogues({ en: { one: 'One' } }, { de: { one: 'Eins' } });

    expect(message(merged, 'de', 'one')).toBe('Eins');
    expect(message(merged, 'en', 'one')).toBe('One');
  });

  it('leaves the catalogues it was given alone', () => {
    const base = { en: { one: 'One' } };

    mergeCatalogues(base, { en: { one: 'Uno' } });

    expect(message(base, 'en', 'one')).toBe('One');
  });
});

describe('translate', () => {
  it('falls back through the requested locale to the fallback locale', () => {
    const catalogues = { en: { only: 'Only English' }, ru: {} };

    expect(translate(catalogues, 'ru', 'only')).toBe('Only English');
  });

  it('substitutes a parameter into the message', () => {
    expect(translate({ en: { greet: 'Hello {name}' } }, 'en', 'greet', { name: 'Ada' })).toBe(
      'Hello Ada',
    );
  });

  it('renders a parameter the caller passed as nothing rather than as the placeholder text', () => {
    // `{name}` in front of an operator is a bug report from a bug report.
    const message = 'Hello {name} from {place}';

    expect(
      translate({ en: { greet: message } }, 'en', 'greet', { name: null, place: 'here' }),
    ).toBe('Hello  from here');
  });
});
