import { type EffectCallback, useEffect } from 'react';

import { useGranularHook } from '@/lib/use_granular_hook';

export function useGranularEffect(
  effect: EffectCallback,
  primaryDeps: unknown[],
  secondaryDeps: unknown[],
) {
  return useGranularHook(useEffect, effect, primaryDeps, secondaryDeps);
}
