import { iconPaths } from './index';

/**
 * One icon's geometry: the `d` attribute of a single `<path>`.
 *
 * A whole path rather than an SVG document, because `Icon` builds the `<svg>` and controls everything
 * about it — the viewBox, the accessibility attributes and the id the repeated copies share. What a
 * caller contributes is the shape; what the library does with it is not theirs to override.
 *
 * The coordinate system is the one every shipped icon is drawn in, 0 to 100 on both axes. An icon
 * exported from anywhere else will be scaled into that box rather than fitted to it, so an icon
 * exported at 24 by 24 will render correctly and one exported at 512 by 512 will overflow.
 */
export type IconPath = string;

/**
 * Icons a caller registered, by name.
 *
 * A separate map rather than an addition to the generated `iconPaths`, which is rewritten from the
 * source SVGs every time they are regenerated and would take a caller's icons with it.
 */
const registeredIcons = new Map<string, IconPath>();

/**
 * Adds an icon the library does not ship, or replaces the path of one it does.
 *
 * The application-wide way to add artwork; {@link Icon} is what renders it. Register before the first
 * render that names it, which in practice means at module scope: the name is resolved to a path on
 * every render, so an icon registered after a tree has already mounted appears on the next one.
 *
 * Replacing a shipped icon is allowed and is how an application matches artwork it did not commission.
 * A name registered with the same path twice is not an error — two modules contributing the same icon
 * is a fact about the application, not a mistake in it.
 *
 * The name is what a caller passes to `name` props, so it should read as the icon does and hold
 * nothing that has to be escaped: it is interpolated into a DOM id.
 */
export function registerIcon(name: string, path: IconPath): void {
  if (name === '') {
    throw new Error('An icon name cannot be empty: it is what names the icon in the DOM.');
  }

  registeredIcons.set(name, path);
}

/**
 * Adds several icons at once, from the shape an icon set is exported as.
 *
 * The map is the shape a generated icon set arrives in, which is the reason this exists rather than a
 * loop at the import site.
 */
export function registerIcons(icons: Readonly<Record<string, IconPath>>): void {
  for (const [name, path] of Object.entries(icons)) {
    registerIcon(name, path);
  }
}

/**
 * Removes a registered icon, reporting whether there was one.
 *
 * A shipped icon cannot be removed — it is data the library renders — so this only ever takes back
 * what {@link registerIcon} added. Call it to restore a shipped icon's own path over a replacement.
 */
export function unregisterIcon(name: string): boolean {
  return registeredIcons.delete(name);
}

/** The path `Icon` draws for a name, or `undefined` for a name neither source holds. */
export function getIconPath(name: string): IconPath | undefined {
  return registeredIcons.get(name) ?? (isShippedIconName(name) ? iconPaths[name] : undefined);
}

/** True when a name resolves to a path, from either source. */
export function hasIcon(name: string): boolean {
  return getIconPath(name) !== undefined;
}

/** Every name `Icon` can render, the shipped ones first and then the registered ones. */
export function getIconNames(): readonly string[] {
  return [...Object.keys(iconPaths), ...registeredIcons.keys()];
}

/**
 * Whether a name is one the generated data holds.
 *
 * A caller may hand over any string at all, so the shipped map is looked up through a guard rather
 * than indexed: typing it `Record<string, IconPath>` would answer for every string, including the
 * ones that hold no path.
 */
function isShippedIconName(name: string): name is keyof typeof iconPaths {
  return Object.hasOwn(iconPaths, name);
}
