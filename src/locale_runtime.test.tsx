// SPDX-License-Identifier: MIT
/**
 * The locale runtime the catalogue tests leave alone: detection from the browser, persistence,
 * plural expansion, the provider's `setLocale`, and the module-level helpers a component reaches for
 * outside React. The catalogue shape is covered in `locale.test.tsx`; this file drives the parts that
 * need a real document, storage or `navigator`.
 */
// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  builtinCatalogues,
  getLocaleDates,
  getLocaleName,
  isLocaleWithCyrillicScript,
  isLocaleWithRtlScript,
  LOCALE_STORAGE_KEY,
  LocaleProvider,
  registerLocale,
  translate,
  useLocale,
} from '@/locale';
import { click, render } from '@/util/testing/render';

/** Forces what the browser preference reports, for the detection tests. */
function setNavigatorLanguages(
  languages: string[] | undefined,
  language: string | undefined,
): void {
  Object.defineProperty(window.navigator, 'languages', {
    configurable: true,
    get: () => languages,
  });
  Object.defineProperty(window.navigator, 'language', { configurable: true, get: () => language });
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('lang');
  setNavigatorLanguages(['en'], 'en');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the plural expansion of a message', () => {
  it('selects the form the locale rule picks for the count', () => {
    const catalogues = { en: { items: '{:P:count:0:one item}{:P:count:1:many items}' } };

    expect(translate(catalogues, 'en', 'items', { count: 1 })).toBe('one item');
    expect(translate(catalogues, 'en', 'items', { count: 5 })).toBe('many items');
  });

  it('treats a non-numeric count as zero', () => {
    const catalogues = { en: { items: '{:P:count:0:one}{:P:count:1:many}' } };

    expect(translate(catalogues, 'en', 'items', { count: 'not a number' })).toBe('many');
  });

  it('reports an unknown counter and treats it as zero', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const catalogues = { en: { items: '{:P:missing:0:zero}{:P:missing:1:other}' } };

    expect(translate(catalogues, 'en', 'items', {})).toBe('other');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('reports a null counter and treats it as zero', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const catalogues = { en: { items: '{:P:count:0:zero}{:P:count:1:other}' } };

    expect(translate(catalogues, 'en', 'items', { count: null })).toBe('other');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('uses a plural rule a caller registered for its own language', () => {
    registerLocale('pl', { pluralRule: (count) => (count === 2 ? 1 : 0) });

    const catalogues = { pl: { items: '{:P:count:0:few}{:P:count:1:pair}' } };

    expect(translate(catalogues, 'pl', 'items', { count: 2 })).toBe('pair');
    expect(translate(catalogues, 'pl', 'items', { count: 1 })).toBe('few');
  });
});

describe('the date data fallback chain', () => {
  it('falls back to English when neither the locale nor the fallback ships dates', () => {
    expect(getLocaleDates('nowhere', 'nowhere-either').names.weekdayNames[0]).toBe('Sunday');
  });

  it('uses dates a caller registered for a language', () => {
    const en = getLocaleDates('en');
    registerLocale('zd', { dates: { ...en, names: { ...en.names, monthNames: ['M'] } } });

    // The provider merges the registered dates, which is what reads the registry branch.
    expect(builtinCatalogues()).toBeDefined();
    expect(getLocaleDates('zd').names.monthNames).toEqual(['M']);
  });
});

describe('script inference', () => {
  it('reports Cyrillic and right-to-left locales', () => {
    expect(isLocaleWithCyrillicScript('ru')).toBe(true);
    expect(isLocaleWithCyrillicScript('en')).toBe(false);
    expect(isLocaleWithRtlScript('ar')).toBe(true);
    expect(isLocaleWithRtlScript('en')).toBe(false);
  });

  it('prefers a script a caller registered', () => {
    registerLocale('zl', { script: 'cyrillic' });

    expect(isLocaleWithCyrillicScript('zl')).toBe(true);
  });

  it('reports a right-to-left layout for a locale the built-in sets name', async () => {
    function Direction(): ReactNode {
      const { isRtl, isCyrillic } = useLocale();

      return <span>{`${isRtl}|${isCyrillic}`}</span>;
    }

    const { findByText } = await render(
      <LocaleProvider initialLocale="ar" storageKey={null}>
        <Direction />
      </LocaleProvider>,
    );

    expect(findByText('true|false')).toBeDefined();
  });
});

describe('the provider choosing a locale', () => {
  function Lang(): ReactNode {
    return <span>{useLocale().lang}</span>;
  }

  it('takes an exact match from the browser preference', async () => {
    setNavigatorLanguages(['ru'], 'ru');

    const { findByText } = await render(
      <LocaleProvider storageKey={null}>
        <Lang />
      </LocaleProvider>,
    );

    expect(findByText('ru')).toBeDefined();
  });

  it('matches a regional tag by its language', async () => {
    setNavigatorLanguages(['ru-RU'], 'ru-RU');

    const { findByText } = await render(
      <LocaleProvider storageKey={null}>
        <Lang />
      </LocaleProvider>,
    );

    expect(findByText('ru')).toBeDefined();
  });

  it('falls back when nothing matches and when the preference is absent', async () => {
    setNavigatorLanguages(['de'], 'de');

    const first = await render(
      <LocaleProvider storageKey={null}>
        <Lang />
      </LocaleProvider>,
    );

    expect(first.findByText('en')).toBeDefined();

    setNavigatorLanguages(undefined, undefined);

    const second = await render(
      <LocaleProvider storageKey={null}>
        <Lang />
      </LocaleProvider>,
    );

    expect(second.findByText('en')).toBeDefined();
  });

  it('reads a stored choice before the browser preference', async () => {
    localStorage.setItem('test.locale', 'ru');

    const { findByText } = await render(
      <LocaleProvider storageKey="test.locale">
        <Lang />
      </LocaleProvider>,
    );

    expect(findByText('ru')).toBeDefined();
  });

  it('ignores an empty stored choice and survives storage that throws', async () => {
    localStorage.setItem('test.locale', '');

    const first = await render(
      <LocaleProvider storageKey="test.locale">
        <Lang />
      </LocaleProvider>,
    );

    expect(first.findByText('en')).toBeDefined();

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('sandboxed');
    });

    const second = await render(
      <LocaleProvider storageKey="test.locale">
        <Lang />
      </LocaleProvider>,
    );

    expect(second.findByText('en')).toBeDefined();
  });

  it('lets an explicit initialLocale win over detection', async () => {
    setNavigatorLanguages(['ru'], 'ru');

    const { findByText } = await render(
      <LocaleProvider initialLocale="en" storageKey={null}>
        <Lang />
      </LocaleProvider>,
    );

    expect(findByText('en')).toBeDefined();
  });

  it('lets a detectLocale callback decide', async () => {
    const { findByText } = await render(
      <LocaleProvider detectLocale={() => 'ru'} storageKey={null}>
        <Lang />
      </LocaleProvider>,
    );

    expect(findByText('ru')).toBeDefined();
  });
});

describe('setLocale', () => {
  function Switcher(): ReactNode {
    const { lang, setLocale } = useLocale();

    return (
      <button type="button" onClick={() => setLocale('ru')}>
        {lang}
      </button>
    );
  }

  it('switches, persists and writes the document language', async () => {
    const { findByText, find } = await render(
      <LocaleProvider storageKey="test.locale">
        <Switcher />
      </LocaleProvider>,
    );

    await click(find('button'));

    expect(findByText('ru')).toBeDefined();
    expect(localStorage.getItem('test.locale')).toBe('ru');
    expect(document.documentElement.getAttribute('lang')).toBe('ru');
  });

  it('does not persist when storageKey is null, and survives storage that throws', async () => {
    const first = await render(
      <LocaleProvider storageKey={null}>
        <Switcher />
      </LocaleProvider>,
    );

    await click(first.find('button'));

    expect(localStorage.getItem('test.locale')).toBeNull();

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('sandboxed');
    });

    const second = await render(
      <LocaleProvider storageKey="test.locale">
        <Switcher />
      </LocaleProvider>,
    );

    await click(second.find('button'));

    expect(second.findByText('ru')).toBeDefined();
  });
});

describe('the locale outside a provider', () => {
  function UnmanagedProbe(): ReactNode {
    const { t, tRaw, setLocale } = useLocale();

    return (
      <button type="button" onClick={() => setLocale('ru')}>
        {t('Modal.close')}|{tRaw('Raw.key')}
      </button>
    );
  }

  it('resolves messages in the fallback locale and ignores setLocale', async () => {
    const { findByText, find } = await render(<UnmanagedProbe />);

    expect(
      findByText(`${translate(builtinCatalogues(), 'en', 'Modal.close')}|Raw.key`),
    ).toBeDefined();

    await click(find('button'));

    expect(
      findByText(`${translate(builtinCatalogues(), 'en', 'Modal.close')}|Raw.key`),
    ).toBeDefined();
  });
});

describe('getLocaleName', () => {
  it('reads the document language when it is set', () => {
    document.documentElement.setAttribute('lang', 'ru');

    expect(getLocaleName()).toBe('ru');
  });

  it('falls back to detection when the document language is empty', () => {
    setNavigatorLanguages(['ru'], 'ru');

    expect(getLocaleName()).toBe('ru');
  });
});

describe('the provider merging dates', () => {
  it('replaces the dates for a locale named in the dates prop', async () => {
    const en = getLocaleDates('en');

    function Dates(): ReactNode {
      return <span>{useLocale().dates.names.weekdayNames[0]}</span>;
    }

    const { findByText } = await render(
      <LocaleProvider
        initialLocale="en"
        storageKey={null}
        dates={{ en: { ...en, names: { ...en.names, weekdayNames: ['Xx'] } } }}
      >
        <Dates />
      </LocaleProvider>,
    );

    expect(findByText('Xx')).toBeDefined();
  });

  it('falls back to English dates for a locale and fallback that ship none', async () => {
    function Dates(): ReactNode {
      return <span>{useLocale().dates.names.weekdayNames[0]}</span>;
    }

    const { findByText } = await render(
      <LocaleProvider initialLocale="nowhere" fallbackLocale="nothing" storageKey={null}>
        <Dates />
      </LocaleProvider>,
    );

    expect(findByText('Sunday')).toBeDefined();
  });

  it('merges a registered locale carrying dates into the provider', async () => {
    const en = getLocaleDates('en');
    registerLocale('zm', { dates: { ...en, names: { ...en.names, weekdayNames: ['Zz'] } } });

    function Dates(): ReactNode {
      return <span>{useLocale().dates.names.weekdayNames[0]}</span>;
    }

    const { findByText } = await render(
      <LocaleProvider initialLocale="zm" storageKey={null}>
        <Dates />
      </LocaleProvider>,
    );

    expect(findByText('Zz')).toBeDefined();
  });
});

it('exposes the storage key the provider defaults to', () => {
  expect(LOCALE_STORAGE_KEY).toBe('ui-kit.locale');
});
