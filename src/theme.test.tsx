/**
 * A theme is data plus a document attribute plus storage. The tests cover the fallback chain — storage,
 * then the document, then the default — and the two failure arms around an unavailable `localStorage`.
 */
// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAllThemes,
  getCurrentTheme,
  isThemeName,
  registerTheme,
  setTheme,
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
  useTheme,
} from '@/theme';
import { act, render } from '@/util/testing/render';

describe('theme registry', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.removeAttribute(THEME_ATTRIBUTE);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to the default theme when nothing is stored and the document names nothing', () => {
    expect(getCurrentTheme()).toBe('dark');
  });

  it('reads a registered theme from storage', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');

    expect(getCurrentTheme()).toBe('light');
  });

  it('ignores an unregistered name in storage and in the document', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'not-a-theme');
    document.body.setAttribute(THEME_ATTRIBUTE, 'also-not-a-theme');

    expect(getCurrentTheme()).toBe('dark');
  });

  it('reads a registered theme from the document when storage holds nothing useful', () => {
    document.body.setAttribute(THEME_ATTRIBUTE, 'acme');

    expect(getCurrentTheme()).toBe('acme');
  });

  it('survives storage that throws on read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('sandboxed');
    });

    expect(getCurrentTheme()).toBe('dark');
  });

  it('registers a consumer theme and reports it as a theme name', () => {
    registerTheme({ name: 'consumer', tileColor: '#123456' });

    expect(isThemeName('consumer')).toBe(true);
    expect(getAllThemes().some((theme) => theme.name === 'consumer')).toBe(true);
    expect(isThemeName('never-registered')).toBe(false);
  });

  it('applies a theme to the document, storage and the bus', () => {
    const listener = vi.fn();
    window.addEventListener('ui-kit:event', listener);

    setTheme('purple');

    expect(document.body.getAttribute(THEME_ATTRIBUTE)).toBe('purple');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('purple');
    expect(listener).toHaveBeenCalled();

    window.removeEventListener('ui-kit:event', listener);
  });

  it('applies a theme even when it cannot be persisted', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('sandboxed');
    });

    setTheme('indigo');

    expect(document.body.getAttribute(THEME_ATTRIBUTE)).toBe('indigo');
  });
});

describe('useTheme', () => {
  function Probe(): ReactNode {
    return <span>{useTheme()}</span>;
  }

  beforeEach(() => {
    localStorage.clear();
    document.body.removeAttribute(THEME_ATTRIBUTE);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts from the current theme and follows a programmatic change', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');

    const { findByText } = await render(<Probe />);

    expect(findByText('light')).toBeDefined();

    act(() => {
      setTheme('acme');
    });

    expect(findByText('acme')).toBeDefined();
  });

  it('ignores a theme-changed event with no payload', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');

    const { findByText } = await render(<Probe />);

    act(() => {
      emitThemeChangedWithoutPayload();
    });

    expect(findByText('light')).toBeDefined();
  });

  it('follows a storage change in another tab for its own key only', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');

    const { findByText } = await render(<Probe />);

    act(() => {
      localStorage.setItem(THEME_STORAGE_KEY, 'purple');
      window.dispatchEvent(new StorageEvent('storage', { key: 'some.other.key' }));
    });

    expect(findByText('light')).toBeDefined();

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY }));
    });

    expect(findByText('purple')).toBeDefined();
  });
});

/** Emits the theme-changed category with no payload, without going through `setTheme`. */
function emitThemeChangedWithoutPayload(): void {
  window.dispatchEvent(new CustomEvent('ui-kit:event', { detail: { id: 'ui-kit:theme-changed' } }));
}
