/**
 * `useGranularHook` gives a hook two dependency lists: the primary list re-runs it, the secondary
 * list only keeps the values it reads fresh. The suite pins the split on `useGranularEffect` and
 * proves the mechanism carries over to another hook (`useEffect`) unchanged, because the wrapper is
 * generic over the hook it is given.
 */
// @vitest-environment jsdom

import { useEffect } from 'react';
import { describe, expect, test } from 'vitest';
import { useGranularEffect } from '@/util/hooks/use_granular_effect';
import { render } from '@/util/testing/render';
import { useGranularHook } from './';

let effectRuns: string[];

function GranularProbe({
  primary,
  secondary,
}: {
  readonly primary: number;
  readonly secondary: number;
}) {
  useGranularEffect(
    () => {
      effectRuns.push(`primary:${primary} secondary:${secondary}`);
    },
    [primary],
    [secondary],
  );

  return <div />;
}

function GranularMemoProbe({
  primary,
  secondary,
}: {
  readonly primary: number;
  readonly secondary: number;
}) {
  const memoized = useGranularHook(
    useEffect,
    () => {
      effectRuns.push(`memo primary:${primary} secondary:${secondary}`);
    },
    [primary],
    [secondary],
  );

  void memoized;

  return <div />;
}

function PlainEffectProbe({
  primary,
  secondary,
}: {
  readonly primary: number;
  readonly secondary: number;
}) {
  useEffect(() => {
    effectRuns.push(`plain primary:${primary} secondary:${secondary}`);
  }, [primary, secondary]);

  return <div />;
}

describe('useGranularHook', () => {
  test('the primary list decides whether the effect re-runs', async () => {
    effectRuns = [];

    const view = await render(<GranularProbe primary={1} secondary={1} />);

    expect(effectRuns).toEqual(['primary:1 secondary:1']);

    // The primary dependency changed: the effect re-runs.
    await view.update(<GranularProbe primary={2} secondary={1} />);

    expect(effectRuns).toEqual(['primary:1 secondary:1', 'primary:2 secondary:1']);
  });

  test('a secondary change does not re-run the effect', async () => {
    // The secondary list is what the effect reads rather than reacts to: a change there must not
    // re-run the effect, which is the whole point of having two lists.
    effectRuns = [];

    const view = await render(<GranularProbe primary={1} secondary={1} />);

    await view.update(<GranularProbe primary={1} secondary={2} />);

    expect(effectRuns).toEqual(['primary:1 secondary:1']);
  });

  test('wraps another hook the same way', async () => {
    effectRuns = [];

    const view = await render(<GranularMemoProbe primary={1} secondary={1} />);

    expect(effectRuns).toEqual(['memo primary:1 secondary:1']);

    await view.update(<GranularMemoProbe primary={2} secondary={1} />);

    expect(effectRuns).toEqual(['memo primary:1 secondary:1', 'memo primary:2 secondary:1']);
    void PlainEffectProbe;
  });
});
