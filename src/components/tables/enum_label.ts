// SPDX-License-Identifier: MIT
// The label an enum value is shown, searched and exported as.

import type { EnumOption } from './GeneralizedSearchModal';

/**
 * The label a `enum` value is shown, searched and exported as.
 *
 * The caller's own label when it has one, and the raw value when it does not, so a value added to
 * the caller's data is still visible before they list it in `options`.
 *
 * It lives here rather than beside `ControlledTable` because the table's panel, its search filter
 * and its property formatter all label enum values, and importing it from the component they render
 * would point those modules back at `ControlledTable` and close an import cycle.
 */
export function getEnumLabel(
  property: { readonly options: readonly EnumOption[] },
  value: string,
): string {
  return property.options.find((option) => option.value === value)?.label ?? value;
}
