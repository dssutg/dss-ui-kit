// SPDX-License-Identifier: MIT
// A ref that always holds the newest value of a property.

import { type MutableRefObject, useEffect, useRef } from 'react';

/**
 * A ref that always holds the current value of a property, for a callback that must read the newest
 * one without being re-created.
 *
 * This is what a hook with a dependency list builds its callback ref out of: an event listener attached
 * once and reading the newest closure through a ref is not the same as re-attaching it on every
 * render.
 *
 * The value is never absent — the ref starts out holding what it was given — so `current` is the
 * property itself rather than the `T | null` the ref's own type would otherwise say.
 */
export function usePropertyRef<T>(property: T): MutableRefObject<T> {
  const ref = useRef(property);

  useEffect(() => {
    ref.current = property;
  }, [property]);

  return ref;
}
