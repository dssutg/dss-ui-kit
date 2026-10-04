import { type RefObject, useEffect, useRef } from 'react';

/**
 * A ref that always holds the current value of a property, for a callback that must read the newest
 * one without being re-created.
 *
 * This is what a hook with a dependency list builds its callback ref out of: an event listener attached
 * once and reading the newest closure through a ref is not the same as re-attaching it on every
 * render.
 */
export function usePropertyRef<T>(property: T): RefObject<T> {
  const ref = useRef(property);

  useEffect(() => {
    ref.current = property;
  }, [property]);

  return ref;
}
