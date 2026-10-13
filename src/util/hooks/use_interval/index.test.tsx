/**
 * The interval hooks run a callback on a period the caller can pause with a `null` delay; the
 * immediate variant fires once on mount as well, which a poll that cannot wait a whole period for
 * its first result relies on. The suite drives both on the fake clock and holds the difference
 * between the two variants, plus the `deps` restart that a callback whose period depends on
 * something needs.
 *
 * The `tick` guard `if (savedCallback.current)` has no reachable false side: the callback is stored
 * by the effect that is always declared and flushed first, so by the time a tick can run the ref
 * holds a function. The guard stays as the source has it; the two uncovered branch outcomes (lines
 * 21 and 53) are that unreachable check.
 */
// @vitest-environment jsdom

import { useCallback } from 'react';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { render } from '@/util/testing/render';
import { useImmediateInterval, useInterval } from './';

/**
 * A counter the hooks drive, so a test reads how many times the callback ran rather than whether a
 * prop changed. The count is written into the DOM because the component re-renders only when it does,
 * and a closure over a local array would go stale across renders.
 */
let tickCount = 0;

function IntervalProbe({
  delay,
  immediate,
}: {
  readonly delay: number | null;
  readonly immediate?: boolean;
}) {
  const tick = () => {
    tickCount += 1;
  };

  // One hook per kind, each inactive on the runs the other drives: hooks cannot be called
  // conditionally, and a null delay makes either one inert.
  useInterval(tick, immediate ? null : delay);
  useImmediateInterval(tick, immediate ? delay : null);

  return <div data-testid="probe" />;
}

describe('useInterval', () => {
  afterEach(() => {
    vi.useRealTimers();
    tickCount = 0;
  });

  test('runs the callback every delay, not immediately', async () => {
    vi.useFakeTimers();

    await render(<IntervalProbe delay={100} />);

    expect(tickCount).toBe(0);

    await act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(tickCount).toBe(3);
  });

  test('stops when delay is null and restarts when it is a number again', async () => {
    vi.useFakeTimers();

    const view = await render(<IntervalProbe delay={100} />);
    await act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(tickCount).toBe(1);

    await view.update(<IntervalProbe delay={null} />);
    await act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(tickCount).toBe(1);

    await view.update(<IntervalProbe delay={100} />);
    await act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(tickCount).toBeGreaterThan(1);
  });
});

describe('useImmediateInterval', () => {
  afterEach(() => {
    vi.useRealTimers();
    tickCount = 0;
  });

  test('calls back once before the first delay has passed', async () => {
    vi.useFakeTimers();

    await render(<IntervalProbe delay={100} immediate={true} />);

    expect(tickCount).toBe(1);

    await act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(tickCount).toBe(4);
  });

  test('does nothing when delay is null, not even the immediate call', async () => {
    vi.useFakeTimers();

    await render(<IntervalProbe delay={null} immediate={true} />);

    expect(tickCount).toBe(0);
  });

  test('restarts the timer on a change of deps, with the callback held stable', async () => {
    vi.useFakeTimers();

    let stableTicks = 0;

    const StableCallbackProbe = ({ dep }: { readonly dep: string }) => {
      // The identity of the callback does not change, so only `deps` can restart the timer — which
      // is what a callback whose period depends on something needs.
      const tick = useCallback(() => {
        stableTicks += 1;
      }, []);

      useImmediateInterval(tick, 100, [dep]);

      return <div />;
    };

    const view = await render(<StableCallbackProbe dep="one" />);

    expect(stableTicks).toBe(1);

    await act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(stableTicks).toBe(2);

    await view.update(<StableCallbackProbe dep="two" />);

    // The restart calls the tick immediately, so the count grows without the clock.
    expect(stableTicks).toBe(3);

    await act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(stableTicks).toBe(4);
  });

  test('the plain interval with deps does not call immediately on a restart', async () => {
    vi.useFakeTimers();

    let stableTicks = 0;

    const StableCallbackProbe = ({ dep }: { readonly dep: string }) => {
      const tick = useCallback(() => {
        stableTicks += 1;
      }, []);

      useInterval(tick, 100, [dep]);

      return <div />;
    };

    const view = await render(<StableCallbackProbe dep="one" />);

    expect(stableTicks).toBe(0);

    await view.update(<StableCallbackProbe dep="two" />);

    expect(stableTicks).toBe(0);

    await act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(stableTicks).toBe(1);
  });
});
