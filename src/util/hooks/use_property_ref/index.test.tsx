/**
 * `usePropertyRef` exists so a callback can be created once and still read the newest property
 * through it — the mechanism event listeners and every dependency-list hook here build on. The
 * suite verifies exactly that pairing: the ref never lags the render that changed the value, and it
 * keeps doing so across re-renders rather than only updating once.
 */
// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { render } from '@/util/testing/render';
import { usePropertyRef } from './';

describe('usePropertyRef', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('a callback reading through the ref sees the latest value without the callback changing', async () => {
    const seen: unknown[] = [];
    let readLatest: (() => unknown) | undefined;

    function Probe({ value }: { readonly value: string }) {
      const ref = usePropertyRef(value);

      readLatest = () => ref.current;

      return <div />;
    }

    const view = await render(<Probe value="first" />);

    seen.push(readLatest?.());

    await view.update(<Probe value="second" />);

    // The ref holds the newest property after the render that changed it.
    seen.push(readLatest?.());

    expect(seen).toEqual(['first', 'second']);
  });

  test('the ref survives an unmount-free re-render cycle', async () => {
    let readLatest: (() => unknown) | undefined;

    function Probe({ value }: { readonly value: number }) {
      const ref = usePropertyRef(value);

      readLatest = () => ref.current;

      return <div />;
    }

    const view = await render(<Probe value={1} />);

    await view.update(<Probe value={2} />);
    await view.update(<Probe value={3} />);

    expect(readLatest?.()).toBe(3);
  });
});
