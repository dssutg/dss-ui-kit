// SPDX-License-Identifier: MIT
// The data-* attributes a component forwards to the element it renders.

/**
 * The data-* attributes a caller may hand a component, keyed by their `data-*` name.
 *
 * A component that forwards data-* attributes extends its props with this type, collects everything
 * it does not name into a rest parameter and spreads that onto its element, so an attribute a caller
 * writes reaches the DOM it was meant for instead of being dropped between the props and the element.
 * The template-literal key keeps the forwarding type-safe the way `CSSCustomProperties` does for a
 * `--name` in an inline style: any `data-*` name is admitted, and anything else is still an error.
 */
export type DataAttributes = {
  readonly [key: `data-${string}`]: string | number | boolean | undefined;
};
