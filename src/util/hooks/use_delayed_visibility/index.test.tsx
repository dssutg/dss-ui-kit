/**
 * `useDelayedVisibility` decides whether something should be shown yet: the answer turns true only
 * once `trigger` has held for the given delay, so a spinner does not flash over a request that
 * finishes quickly. Hiding is immediate — nothing lingers after the trigger drops. The suite drives
 * both halves on the fake clock: appearing is a timed act, hiding happens on the turn the trigger
 * drops, and the pending show is cancelled if the trigger or the component goes away first.
 */
// @vitest-environment jsdom

import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { render } from '@/util/testing/render';
import { useDelayedVisibility } from './';

/**
 * A probe that renders the hook's answer into the DOM, so a test reads what a caller would show
 * rather than reaching into the hook.
 */
function Probe({ trigger, delay }: { readonly trigger: boolean; readonly delay: number }) {
  const isVisible = useDelayedVisibility(trigger, delay);

  return <div data-testid="view">{String(isVisible)}</div>;
}

describe('useDelayedVisibility', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('stays hidden for as long as the trigger is false', async () => {
    vi.useFakeTimers();

    const view = await render(<Probe trigger={false} delay={100} />);

    expect(view.textContent()).toBe('false');

    await act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(view.textContent()).toBe('false');
  });

  test('shows only once the trigger has held for the whole delay', async () => {
    vi.useFakeTimers();

    const view = await render(<Probe trigger={false} delay={100} />);

    await view.update(<Probe trigger={true} delay={100} />);

    expect(view.textContent()).toBe('false');

    await act(() => {
      vi.advanceTimersByTime(99);
    });

    expect(view.textContent()).toBe('false');

    await act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(view.textContent()).toBe('true');
  });

  test('hides on the turn the trigger drops, canceling a show that never happened', async () => {
    vi.useFakeTimers();

    const view = await render(<Probe trigger={false} delay={100} />);

    await view.update(<Probe trigger={true} delay={100} />);
    await act(() => {
      vi.advanceTimersByTime(50);
    });

    await view.update(<Probe trigger={false} delay={100} />);

    expect(view.textContent()).toBe('false');

    // The show timer was cleared with the effect, so the later turn on the clock finds nothing.
    await act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(view.textContent()).toBe('false');
  });

  test('hides immediately once shown, when the trigger drops', async () => {
    vi.useFakeTimers();

    const view = await render(<Probe trigger={false} delay={50} />);

    await view.update(<Probe trigger={true} delay={50} />);
    await act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(view.textContent()).toBe('true');

    await view.update(<Probe trigger={false} delay={50} />);

    expect(view.textContent()).toBe('false');
  });

  test('restarts the wait when the delay changes while the trigger holds', async () => {
    vi.useFakeTimers();

    const view = await render(<Probe trigger={false} delay={100} />);

    await view.update(<Probe trigger={true} delay={100} />);
    await act(() => {
      vi.advanceTimersByTime(50);
    });

    await view.update(<Probe trigger={true} delay={300} />);
    await act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(view.textContent()).toBe('false');

    await act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(view.textContent()).toBe('true');
  });

  test('clears the pending show when the component unmounts', async () => {
    vi.useFakeTimers();

    const view = await render(<Probe trigger={false} delay={100} />);

    await view.update(<Probe trigger={true} delay={100} />);

    expect(vi.getTimerCount()).toBe(1);

    view.unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
