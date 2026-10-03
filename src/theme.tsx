import { useCallback, useEffect, useState } from 'react';
import { emitEvent, useEvent } from './event';

/**
 * The themes the library ships.
 *
 * A theme is data, not a build artefact: `--color-*` is resolved by CSS at runtime, so switching
 * theme is a `data-theme` attribute on `<body>` and nothing recompiles. A consumer that wants a theme
 * the library does not ship declares the custom properties itself and adds the name to
 * {@link registerTheme} before using it.
 */
export const builtinThemeNames = ['dark', 'light', 'acme', 'indigo', 'purple'] as const;

/**
 * One of the names in {@link builtinThemeNames}.
 *
 * Narrower than {@link ThemeName}: a value of this type is a theme the library ships, so a consumer
 * can exhaustively switch over it. Use it where the library's own themes are the whole set — a
 * documentation page, a test — and {@link ThemeName} everywhere else.
 */
export type BuiltinThemeName = (typeof builtinThemeNames)[number];

/**
 * A theme name, which may be one the consumer registered rather than one the library ships.
 */
export type ThemeName = string;

/** The swatch shown for a theme in a theme picker. */
export interface ThemeDescriptor {
  readonly name: ThemeName;
  /** A CSS colour, used as the picker's tile. Not a design token: it is a literal fill. */
  readonly tileColor: string;
}

/**
 * The shipped themes, with the swatch a picker shows for each.
 *
 * `dark` and `light` are the themes the library is written and tested against; the rest exist to show
 * that the token system survives a palette the library did not design, and a consumer that wants only
 * some of them imports only the CSS for the ones it uses.
 */
export const builtinThemes: readonly ThemeDescriptor[] = [
  { name: 'dark', tileColor: '#222222' },
  { name: 'light', tileColor: '#dedede' },
  { name: 'acme', tileColor: '#ffffea' },
  { name: 'indigo', tileColor: '#6b67bb' },
  { name: 'purple', tileColor: '#a967bb' },
];

const registeredThemes = new Map<ThemeName, ThemeDescriptor>(
  builtinThemes.map((theme) => [theme.name, theme]),
);

/** The theme used when nothing else applies, and the fallback for an unknown name. */
export const defaultTheme: ThemeName = 'dark';

/**
 * Adds a theme the library does not ship.
 *
 * Registering a name only tells the library that the name is real; the custom properties that make
 * it look like anything are the consumer's CSS, because the library cannot know what a consumer's
 * brand looks like.
 */
export function registerTheme(theme: ThemeDescriptor): void {
  registeredThemes.set(theme.name, theme);
}

/** Every known theme, the built-in ones first. */
export function getAllThemes(): readonly ThemeDescriptor[] {
  return [...registeredThemes.values()];
}

/**
 * Whether a string names a theme that is registered, which is what makes it safe to put in the
 * document attribute: an unknown name resolves to no stylesheet and the page renders unstyled.
 */
export function isThemeName(name: string): name is ThemeName {
  return registeredThemes.has(name);
}

/** The key the current theme is persisted under. Configurable so two libraries can coexist. */
export const THEME_STORAGE_KEY = 'ui-kit.theme';

/** The attribute the current theme is written to. Tailwind and the theme CSS both read this. */
export const THEME_ATTRIBUTE = 'data-theme';

/**
 * The theme currently applied, read from storage and then from the document.
 *
 * Storage wins so that a theme the operator chose survives a reload even if the document attribute
 * has not been written yet. An unrecognised name falls back to {@link defaultTheme} rather than
 * leaving the document in a state no stylesheet matches.
 */
export function getCurrentTheme(): ThemeName {
  const stored = readStoredTheme();
  if (stored !== null) {
    return stored;
  }

  const fromDocument = document.body?.getAttribute(THEME_ATTRIBUTE);
  if (fromDocument !== null && fromDocument !== undefined && isThemeName(fromDocument)) {
    return fromDocument;
  }

  return defaultTheme;
}

function readStoredTheme(): ThemeName | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored !== null && isThemeName(stored) ? stored : null;
  } catch {
    // Storage is unavailable in a private window or a sandboxed frame. The document attribute
    // is still a valid source, so this is not worth failing over.
    return null;
  }
}

/**
 * Applies a theme: the document attribute the CSS keys off, storage so it survives a reload, and an
 * event so anything that cached the old value updates.
 */
export function setTheme(themeName: ThemeName): void {
  document.body?.setAttribute(THEME_ATTRIBUTE, themeName);

  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeName);
  } catch {
    // As above: a theme that cannot be persisted is still a theme that is applied.
  }

  emitEvent('ui-kit:theme-changed', { themeName });
}

/**
 * The current theme, kept in step with changes made anywhere in the application.
 *
 * A component that only needs to re-render on a theme change should read this rather than reading the
 * document itself, so that a programmatic `setTheme` from outside React is picked up too.
 */
export function useTheme(): ThemeName {
  const [theme, setThemeState] = useState<ThemeName>(getCurrentTheme);

  useEvent<{ themeName: ThemeName }>(
    'ui-kit:theme-changed',
    useCallback((event) => {
      if (event !== undefined) {
        setThemeState(event.themeName);
      }
    }, []),
  );

  // The document attribute is the source of truth for the CSS, and another tab can change it.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) {
        return;
      }
      setThemeState(getCurrentTheme());
    };

    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return theme;
}
