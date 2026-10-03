// @vitest-environment jsdom

import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { render } from '@/util/testing/render';
import { useDebounce } from './';

let calls: number[] = [];

function DebounceProbe({
  delay,
  change,
  shouldCallOnUnmount,
}: {
  readonly delay: number | null;
  readonly change: number;
  readonly shouldCallOnUnmount?: boolean;
}) {
  useDebounce(
    () => {
      calls.push(change);
    },
    delay,
    [change],
    { shouldCallOnUnmount },
  );

  return <div />;
}

describe('useDebounce', () => {
  afterEach(() => {
    vi.useRealTimers();
    calls = [];
  });

  test('does not call on mount', async () => {
    vi.useFakeTimers();

    await render(<DebounceProbe delay={100} change={1} />);

    await act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(calls).toEqual([]);
  });

  test('calls once after the dependencies have stopped changing', async () => {
    vi.useFakeTimers();

    const view = await render(<DebounceProbe delay={100} change={1} />);

    await view.update(<DebounceProbe delay={100} change={2} />);
    await act(() => {
      vi.advanceTimersByTime(50);
    });

    await view.update(<DebounceProbe delay={100} change={3} />);
    await act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(calls).toEqual([3]);
  });

  test('never calls when delay is null', async () => {
    vi.useFakeTimers();

    const view = await render(<DebounceProbe delay={null} change={1} />);

    await view.update(<DebounceProbe delay={null} change={2} />);
    await act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(calls).toEqual([]);
  });

  test('the callback runs once when a component with a pending debounce unmounts', async () => {
    vi.useFakeTimers();

    const view = await render(<DebounceProbe delay={100} change={1} shouldCallOnUnmount />);

    await view.update(<DebounceProbe delay={100} change={2} shouldCallOnUnmount />);
    view.unmount();

    expect(calls).toEqual([2]);
  });

  test('an unmount without shouldCallOnUnmount discards the pending call', async () => {
    vi.useFakeTimers();

    const view = await render(<DebounceProbe delay={100} change={1} />);

    await view.update(<DebounceProbe delay={100} change={2} />);
    view.unmount();

    expect(calls).toEqual([]);
  });
});
