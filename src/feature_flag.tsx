import { useCallback, useState } from 'react';
import { emitEvent, useEvent } from '@/event';
import { useForceUpdate } from '@/lib/use_force_update';

/**
 * The name of a feature flag.
 *
 * A library component should take a boolean prop for a toggleable behaviour. Feature flags are
 * convenient when the decision is global to the application and the component cannot know the
 * decision, but they are deliberately generic here: a consumer registers the flags it uses rather
 * than importing a list from the application.
 */
export type FeatureName = string;

export interface FeatureToggleEvent {
  readonly featureName: FeatureName;
  readonly enabled: boolean;
}

const featureFlags = new Map<FeatureName, boolean>();

const registry = new Set<FeatureName>();

export interface FeatureDescriptor {
  readonly name: FeatureName;
  readonly defaultValue?: boolean | undefined;
}

export function registerFeatureFlag(descriptor: FeatureDescriptor): void {
  registry.add(descriptor.name);
  if (!featureFlags.has(descriptor.name)) {
    featureFlags.set(descriptor.name, descriptor.defaultValue ?? false);
  }
}

export function unregisterFeatureFlag(name: FeatureName): void {
  registry.delete(name);
  featureFlags.delete(name);
}

export function isFeatureEnabled(featureName: FeatureName): boolean {
  return featureFlags.get(featureName) ?? false;
}

export function setFeatureEnabled(featureName: FeatureName, enabled: boolean): boolean {
  featureFlags.set(featureName, enabled);
  emitEvent('ui-kit:feature-toggled', { featureName, enabled });
  return enabled;
}

export function toggleFeature(featureName: FeatureName): boolean {
  return setFeatureEnabled(featureName, !isFeatureEnabled(featureName));
}

export function getAllFeatureFlags(): FeatureDescriptor[] {
  return [...registry].map((name) => ({
    name,
    defaultValue: featureFlags.get(name) ?? false,
  }));
}

export function useFeatureFlag(featureName: FeatureName): boolean {
  const forceUpdate = useForceUpdate();
  const [enabled, setEnabled] = useState<boolean>(() => isFeatureEnabled(featureName));

  useEvent<FeatureToggleEvent>(
    'ui-kit:feature-toggled',
    useCallback(
      (event) => {
        // Every event on the bus arrives with a possibly-absent payload; only a toggle event
        // concerns this flag, and one without a payload is not one.
        if (event !== undefined && event.featureName === featureName) {
          setEnabled(event.enabled);
          forceUpdate();
        }
      },
      [featureName, forceUpdate],
    ),
  );

  return enabled;
}
