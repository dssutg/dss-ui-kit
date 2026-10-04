import { type EffectCallback, useEffect } from 'react';
import { useGranularHook } from '@/util/hooks/use_granular_hook';

/**
 * `useEffect` with two dependency lists: one that decides whether the effect re-runs, and one that
 * does not.
 *
 * This is the whole reason the hook exists. An effect that reads a value through a ref — a canvas
 * element, a listener callback — has nothing to list that changes with it, and listing the ref anyway
 * re-runs the effect on every render for nothing. Anything in the secondary list is for the effect to
 * read, not to react to; listing a value there that the effect depends on is a stale-closure bug the
 * hook cannot see.
 */
export function useGranularEffect(
  effect: EffectCallback,
  primaryDeps: unknown[],
  secondaryDeps: unknown[],
): unknown {
  return useGranularHook(useEffect, effect, primaryDeps, secondaryDeps);
}
