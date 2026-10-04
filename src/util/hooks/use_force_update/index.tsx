import { useState } from 'react';

/**
 * Returns a function that re-renders the component, for state this library does not track.
 *
 * The honest use is a value held outside React that a component has to redraw from — a canvas already
 * drawn into, an animation outside the state system. For state that is this library's to keep, a hook
 * that holds it is better than a re-render.
 */
export function useForceUpdate(): () => void {
  const [, setTick] = useState(0);

  function forceUpdate() {
    setTick((t) => (t + 1) % Number.MAX_SAFE_INTEGER);
  }

  return forceUpdate;
}
