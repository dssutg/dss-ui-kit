/**
 * `useTimeout` is the mechanism under debounces and any deferred-hide behaviour: the suite holds it
 * to run its callback exactly once on the fake clock, stay inert on a `null` delay, and answer
 * `clear` and `reset` — the two controls the debouncing callers need. Fake timers are what the tests
 * drive the contract on, since the callback fires on a later turn.
 */
// @vitest-environment jsdom

import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { render } from '@/util/testing/render';
import { useTimeout } from './';

/**
 * The suite renders a probe component that exposes the hook's `clear` and `reset` as buttons,
 * because those returns are part of the contract and cannot be reached from an effect that only
 * schedules a timeout. Timed-out state lives in a module variable so it survives across renders.
 */
let timedOut = false;

function TimeoutProbe({ delay }: { readonly delay: number | null }) {
  const { clear, reset } = useTimeout(() => {
    timedOut = true;
  }, delay);

  return (
    <div>
      <button type="button" data-testid="clear" onClick={() => clear()}>
        clear
      </button>
      <button type="button" data-testid="reset" onClick={() => reset()}>
        reset
      </button>
    </div>
  );
}

describe('useTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
    timedOut = false;
  });

  test('runs the callback once after the delay', async () => {
    vi.useFakeTimers();

    await render(<TimeoutProbe delay={100} />);

    await act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(timedOut).toBe(true);

    await act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(timedOut).toBe(true);
  });

  test('never runs when delay is null', async () => {
    vi.useFakeTimers();

    await render(<TimeoutProbe delay={null} />);

    await act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(timedOut).toBe(false);
  });

  test('clear cancels a scheduled run', async () => {
    vi.useFakeTimers();

    const view = await render(<TimeoutProbe delay={100} />);
    const clearButton = view.findByText('clear');

    act(() => {
      clearButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(timedOut).toBe(false);
  });

  test('reset restarts the delay', async () => {
    vi.useFakeTimers();

    const view = await render(<TimeoutProbe delay={100} />);

    await act(() => {
      vi.advanceTimersByTime(60);
    });

    const resetButton = view.findByText('reset');
    act(() => {
      resetButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await act(() => {
      vi.advanceTimersByTime(60);
    });

    expect(timedOut).toBe(false);

    await act(() => {
      vi.advanceTimersByTime(60);
    });

    expect(timedOut).toBe(true);
  });
});
