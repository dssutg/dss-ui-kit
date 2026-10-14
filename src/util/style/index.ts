import type { CSSProperties } from 'react';

/**
 * The CSS custom properties an inline style may set, keyed by their `--name`.
 *
 * `CSSProperties` declares only the standard properties, so an object literal setting a `--name`
 * fails the excess-property check when it is handed to a `style` prop; the template-literal key is
 * what admits every custom property name without loosening the standard ones.
 */
export type CSSCustomProperties = Record<`--${string}`, string | number>;

/**
 * An inline style that may carry CSS custom properties beside the standard ones.
 *
 * A component whose stylesheet reads a `--name` variable sets it in the same object as the rest of
 * the style; this is the type that object is annotated with, so it reaches the `style` prop without
 * a cast standing between the literal and the check.
 */
export type CSSStyleWithCustomProperties = CSSProperties & CSSCustomProperties;
