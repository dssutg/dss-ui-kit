import { useCallback, useState } from 'react';
import { useForceUpdate } from '@/lib/use_force_update';
import { emitEvent, useEvent } from './event';

/**
 * The name of a feature flag.
 *
 * A library component should take a boolean prop for a toggleable behaviour. Feature flags are
 * convenient when the decision is global to the application and the component cannot know the
 * decision, but they are deliberately generic here: a consumer registers the flags it uses rather
 * than importing a list from the application.
 */
export type FeatureName = string;

/**
 * The payload of `ui-kit:feature-toggled`.
 *
 * Carries the flag as well as its new value, so a subscriber can tell a toggle of its own flag from
 * one of somebody else's without keeping a registry of what it subscribed to.
 */
export interface FeatureToggleEvent {
  readonly featureName: FeatureName;
  readonly enabled: boolean;
}

const featureFlags = new Map<FeatureName, boolean>();

const registry = new Set<FeatureName>();

/**
 * A flag as `registerFeatureFlag` takes it: the name, and the value it starts at.
 *
 * `defaultValue` is what the flag is until something sets it, and it is applied once — registering a
 * name that is already registered leaves whatever value it has now.
 */
export interface FeatureDescriptor {
  readonly name: FeatureName;
  readonly defaultValue?: boolean | undefined;
}

/**
 * Declares a flag, and gives it its default value the first time.
 *
 * Registering a name twice keeps the value it has, so a consumer can register its flags in more than
 * one place without a flag's value depending on which import ran last.
 */
export function registerFeatureFlag(descriptor: FeatureDescriptor): void {
  registry.add(descriptor.name);
  if (!featureFlags.has(descriptor.name)) {
    featureFlags.set(descriptor.name, descriptor.defaultValue ?? false);
  }
}

/**
 * Removes a flag and the value it holds.
 *
 * A subscriber to {@link useFeatureFlag} of a name that is no longer registered keeps the value it
 * last saw: unregistering does not emit a toggle.
 */
export function unregisterFeatureFlag(name: FeatureName): void {
  registry.delete(name);
  featureFlags.delete(name);
}

/**
 * Whether a flag is enabled now, without subscribing to it.
 *
 * `false` for a name that was never registered: a flag nobody declared is off, not an error.
 */
export function isFeatureEnabled(featureName: FeatureName): boolean {
  return featureFlags.get(featureName) ?? false;
}

/**
 * Sets a flag and emits `ui-kit:feature-toggled`, so every {@link useFeatureFlag} of that name
 * re-renders. Returns the value set.
 *
 * Unlike {@link registerFeatureFlag} this does not declare the flag: setting a name nobody registered
 * makes it enabled, and it disappears from {@link getAllFeatureFlags}.
 */
export function setFeatureEnabled(featureName: FeatureName, enabled: boolean): boolean {
  featureFlags.set(featureName, enabled);
  emitEvent('ui-kit:feature-toggled', { featureName, enabled });
  return enabled;
}

/** Flips a flag and returns its new value. Emits the same event {@link setFeatureEnabled} does. */
export function toggleFeature(featureName: FeatureName): boolean {
  return setFeatureEnabled(featureName, !isFeatureEnabled(featureName));
}

/**
 * Every registered flag and its current value, for a panel that renders them all.
 *
 * The order is registration order, and only names that went through {@link registerFeatureFlag} are
 * in it — see {@link setFeatureEnabled} for the case of a flag that was set without being declared.
 */
export function getAllFeatureFlags(): FeatureDescriptor[] {
  return [...registry].map((name) => ({
    name,
    defaultValue: featureFlags.get(name) ?? false,
  }));
}

/**
 * Reads a flag and re-renders the component when it is toggled.
 *
 * The value is read once on mount and then taken from the event, so a flag that is never registered
 * settles at `false` rather than at whatever a later `registerFeatureFlag` puts in the map.
 */
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
