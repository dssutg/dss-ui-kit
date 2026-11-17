// SPDX-License-Identifier: MIT
// The published alias of ControlledTable, kept for existing imports.

import { ControlledTable, type ControlledTableProps } from './ControlledTable';

/**
 * {@link ControlledTable} under the name this table was first published as.
 *
 * The two take the same props and draw the same thing; new code should use `ControlledTable`, whose
 * name says what it is, and this wrapper exists so an existing import keeps working.
 */
export type ControlledFilterableTableProps<T, C extends string> = ControlledTableProps<T, C>;

/**
 * The published name of {@link ControlledTable}, kept so an existing import keeps resolving.
 *
 * Deprecated in favour of `ControlledTable`, which says in its name that the caller holds the search
 * text. This is a wrapper rather than an alias so the two can be told apart in a stack trace; every
 * prop, including `data-*`, travels through untouched.
 */
export function ControlledFilterableTable<T, C extends string>(
  props: ControlledTableProps<T, C>,
): React.JSX.Element {
  return <ControlledTable {...props} />;
}
