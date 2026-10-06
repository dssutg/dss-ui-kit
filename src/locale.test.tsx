/**
 * The locale is the seam between what the library renders and what an operator reads, so these tests
 * are about who wins: the shipped catalogue, a locale a caller registered, or a `messages` prop passed
 * to one provider. They also pin that `t` resolves a key of the library's and one the caller declared
 * the same way, that `tRaw` is no different at runtime, and — at compile time — that `t` accepts only
 * declared keys.
 */
// @vitest-environment jsdom
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  type AnyMessageKey,
  builtinCatalogues,
  getLocaleDates,
  getLocaleDefinition,
  type LocaleContextValue,
  LocaleProvider,
  type MessageCatalogue,
  mergeCatalogues,
  registerLocale,
  translate,
  useLocale,
} from '@/locale';
import { render } from '@/util/testing/render';

/**
 * What a consumer declares for its own keys, in the form it takes inside this repository: the probe
 * and the merge tests below call `t` with these keys, so they are checked here the same way a
 * consumer's keys are checked in an application.
 */
declare module '@/locale' {
  interface CustomMessages {
    'MyApp.title': string;
    first: string;
    second: string;
    greeting: string;
  }
}

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
      <span data-testid="own-via-t">{t('MyApp.title')}</span>
      <span data-testid="unknown">{tRaw('Nothing.holds.this')}</span>
    </div>
  );
}

describe('the type t is checked against', () => {
  it('takes a declared key and nothing else', () => {
    // Compile-time assertions: they hold or fail under `deno task typecheck`, which is the gate
    // that runs before every commit. The first pins `t`'s parameter to the public union; the rest
    // are the property itself — a library key and a declared key compile, a typo and a bare string
    // do not.
    type TKey = Parameters<LocaleContextValue['t']>[0];

    expectTypeOf<TKey>().toEqualTypeOf<AnyMessageKey>();
    expectTypeOf<'Modal.close'>().toExtend<TKey>();
    expectTypeOf<'MyApp.title'>().toExtend<TKey>();
    expectTypeOf<'Modal.clsoe'>().not.toExtend<TKey>();
    expectTypeOf<string>().not.toExtend<TKey>();
  });
});

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
    // A key of a catalogue the caller passed is legal for `t` because the caller declared it in
    // `CustomMessages`, and `tRaw` needs no declaration — both read the same merged catalogues.
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
    expect(find('[data-testid="own-via-t"]').textContent).toBe('Connections');
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

describe('a key no catalogue holds', () => {
  it('comes back as the key itself rather than as an empty string', async () => {
    // An empty string is the one answer that helps nobody: it does not say which message is
    // missing, and it cannot be looked up.
    const { find } = await render(
      <LocaleProvider initialLocale="en" storageKey={null}>
        <LocaleProbe />
      </LocaleProvider>,
    );

    expect(find('[data-testid="unknown"]').textContent).toBe('Nothing.holds.this');
  });

  it('is returned the same way by t as by tRaw, so which one was called makes no difference', async () => {
    // Neither of the two may answer differently for a key nothing holds. A locale that carries no
    // catalogue at all standing in as the fallback is the sharpest case of it, and it is exactly the
    // case a caller translating only some messages runs into.
    registerLocale('xg', {});

    const { find } = await render(
      <LocaleProvider initialLocale="xg" fallbackLocale="xg" storageKey={null}>
        <LocaleProbe />
      </LocaleProvider>,
    );

    expect(find('[data-testid="overridden"]').textContent).toBe('Modal.close');
    expect(find('[data-testid="own-via-t"]').textContent).toBe('MyApp.title');
    expect(find('[data-testid="unknown"]').textContent).toBe('Nothing.holds.this');
  });

  it('is returned by translate for the same reason', () => {
    expect(translate({ en: { other: 'Other' } }, 'xx', 'Nothing.holds.this', null, 'xx')).toBe(
      'Nothing.holds.this',
    );
  });
});

describe('registering the same language twice', () => {
  it('keeps the messages of both registrations', () => {
    // The bug this pins down: the registry holds one definition per tag, so the second `set` dropped
    // the first outright and two modules registering part of one language left only one of them.
    registerLocale('xa', { messages: { first: 'First' } });
    registerLocale('xa', { messages: { second: 'Second' } });

    expect(message(builtinCatalogues(), 'xa', 'first')).toBe('First');
    expect(message(builtinCatalogues(), 'xa', 'second')).toBe('Second');
  });

  it("keeps one registration's messages when the other registered only dates", () => {
    const dates = getLocaleDates('en');

    registerLocale('xb', { messages: { greeting: 'Greeting' } });
    registerLocale('xb', {
      dates: { ...dates, names: { ...dates.names, monthNames: ['J', 'F'] } },
    });

    expect(message(builtinCatalogues(), 'xb', 'greeting')).toBe('Greeting');
    expect(getLocaleDates('xb').names.monthNames).toEqual(['J', 'F']);
  });

  it('keeps the script from a registration that did not mention one', () => {
    // A registration that says nothing about a field is not a statement that the field is unset.
    registerLocale('xc', { script: 'rtl' });
    registerLocale('xc', { messages: { greeting: 'Greeting' } });

    expect(getLocaleDefinition('xc')?.script).toBe('rtl');
  });

  it('lets a later registration answer a field the earlier one set', () => {
    registerLocale('xd', { script: 'cyrillic' });
    registerLocale('xd', { script: 'latin' });

    expect(getLocaleDefinition('xd')?.script).toBe('latin');
  });

  it('overrides a message rather than duplicating the key', () => {
    registerLocale('xe', { messages: { greeting: 'First' } });
    registerLocale('xe', { messages: { greeting: 'Second' } });

    expect(message(builtinCatalogues(), 'xe', 'greeting')).toBe('Second');
  });

  it('reports no messages for a locale registered without any', () => {
    registerLocale('xf', { script: 'latin' });

    // An empty `messages` would say the locale has translations where it has none, and a caller
    // checking what was registered would be told the wrong thing.
    expect(getLocaleDefinition('xf')?.messages).toBeUndefined();
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
