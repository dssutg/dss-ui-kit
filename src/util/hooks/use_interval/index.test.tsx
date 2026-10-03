// @vitest-environment jsdom

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

  if (immediate) {
    useImmediateInterval(tick, delay);
  } else {
    useInterval(tick, delay);
  }

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

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(tickCount).toBe(3);
  });

  test('stops when delay is null and restarts when it is a number again', async () => {
    vi.useFakeTimers();

    const view = await render(<IntervalProbe delay={100} />);
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(tickCount).toBe(1);

    await view.update(<IntervalProbe delay={null} />);
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(tickCount).toBe(1);

    await view.update(<IntervalProbe delay={100} />);
    await act(async () => {
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

    await render(<IntervalProbe delay={100} immediate />);

    expect(tickCount).toBe(1);

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(tickCount).toBe(4);
  });

  test('does nothing when delay is null, not even the immediate call', async () => {
    vi.useFakeTimers();

    await render(<IntervalProbe delay={null} immediate />);

    expect(tickCount).toBe(0);
  });
});
