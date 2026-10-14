/**
 * Feature flags are a registry with an event on top. The tests drive the registry directly and the
 * hook through rendered components, because the hook's whole job is to re-render on a toggle it did
 * not perform itself.
 */
// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { emitEvent } from '@/event';
import {
  getAllFeatureFlags,
  isFeatureEnabled,
  registerFeatureFlag,
  setFeatureEnabled,
  toggleFeature,
  unregisterFeatureFlag,
  useFeatureFlag,
} from '@/feature_flag';
import { act, render } from '@/util/testing/render';

describe('feature flag registry', () => {
  it('gives a flag its default only the first time it is registered', () => {
    registerFeatureFlag({ name: 'flag:defaulted', defaultValue: true });
    registerFeatureFlag({ name: 'flag:defaulted', defaultValue: false });

    expect(isFeatureEnabled('flag:defaulted')).toBe(true);

    unregisterFeatureFlag('flag:defaulted');
  });

  it('defaults an unspecified flag to off', () => {
    registerFeatureFlag({ name: 'flag:unspecified' });

    expect(isFeatureEnabled('flag:unspecified')).toBe(false);

    unregisterFeatureFlag('flag:unspecified');
  });

  it('reports an unregistered flag as off', () => {
    expect(isFeatureEnabled('flag:never-registered')).toBe(false);
  });

  it('sets, toggles and returns the value, and emits a toggle event', () => {
    const listener = vi.fn();
    window.addEventListener('ui-kit:event', listener);

    expect(setFeatureEnabled('flag:set', true)).toBe(true);
    expect(isFeatureEnabled('flag:set')).toBe(true);
    expect(toggleFeature('flag:set')).toBe(false);

    const detail = listener.mock.calls[0]?.[0] as CustomEvent<{ id: string; data: unknown }>;
    expect(detail.detail).toEqual({
      id: 'ui-kit:feature-toggled',
      data: { featureName: 'flag:set', enabled: true },
    });

    window.removeEventListener('ui-kit:event', listener);
    unregisterFeatureFlag('flag:set');
  });

  it('lists only registered flags, with their current values, in registration order', () => {
    registerFeatureFlag({ name: 'flag:a', defaultValue: true });
    registerFeatureFlag({ name: 'flag:b', defaultValue: false });

    const listed = getAllFeatureFlags().filter((flag) => flag.name.startsWith('flag:'));

    expect(listed).toEqual([
      { name: 'flag:a', defaultValue: true },
      { name: 'flag:b', defaultValue: false },
    ]);

    unregisterFeatureFlag('flag:a');
    unregisterFeatureFlag('flag:b');
  });

  it('removes a flag and its value', () => {
    registerFeatureFlag({ name: 'flag:gone', defaultValue: true });
    unregisterFeatureFlag('flag:gone');

    expect(isFeatureEnabled('flag:gone')).toBe(false);
    expect(getAllFeatureFlags().some((flag) => flag.name === 'flag:gone')).toBe(false);
  });
});

describe('useFeatureFlag', () => {
  function Probe({ name }: { readonly name: string }): ReactNode {
    const enabled = useFeatureFlag(name);

    return <span>{enabled ? 'on' : 'off'}</span>;
  }

  it('reads the flag on mount and re-renders when it is toggled', async () => {
    registerFeatureFlag({ name: 'flag:hook', defaultValue: true });

    const { findByText } = await render(<Probe name="flag:hook" />);

    expect(findByText('on')).toBeDefined();

    act(() => {
      setFeatureEnabled('flag:hook', false);
    });

    expect(findByText('off')).toBeDefined();

    unregisterFeatureFlag('flag:hook');
  });

  it('ignores a toggle of another flag and a payloadless event', async () => {
    registerFeatureFlag({ name: 'flag:hook', defaultValue: true });

    const { findByText } = await render(<Probe name="flag:hook" />);

    act(() => {
      setFeatureEnabled('flag:other', false);
      emitEvent('ui-kit:feature-toggled');
    });

    expect(findByText('on')).toBeDefined();

    unregisterFeatureFlag('flag:hook');
    unregisterFeatureFlag('flag:other');
  });
});
