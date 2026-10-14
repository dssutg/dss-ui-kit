// SPDX-License-Identifier: MIT
/**
 * `useWindowSize` reports the window's inner size, read during the first render so it is correct
 * immediately, and updated on every resize. The suite mounts with a known size, drives a real
 * `resize` event with changed dimensions, and holds that listening stops with the component.
 */
// @vitest-environment jsdom

import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { render } from '@/util/testing/render';
import { useWindowSize } from './';

function Probe() {
  const size = useWindowSize();

  return <div data-testid="view">{`${size.width} ${size.height}`}</div>;
}

describe('useWindowSize', () => {
  const originalWidth = window.innerWidth;
  const originalHeight = window.innerHeight;

  beforeEach(() => {
    window.innerWidth = originalWidth;
    window.innerHeight = originalHeight;
  });

  afterEach(() => {
    window.innerWidth = originalWidth;
    window.innerHeight = originalHeight;
  });

  test('reads the size at first render, before any resize', async () => {
    window.innerWidth = 640;
    window.innerHeight = 480;

    const view = await render(<Probe />);

    expect(view.textContent()).toBe('640 480');
  });

  test('follows a resize with new dimensions', async () => {
    window.innerWidth = 640;
    window.innerHeight = 480;

    const view = await render(<Probe />);

    expect(view.textContent()).toBe('640 480');

    window.innerWidth = 1280;
    window.innerHeight = 720;

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(view.textContent()).toBe('1280 720');
  });

  test('stops following resize once the component unmounts', async () => {
    window.innerWidth = 640;
    window.innerHeight = 480;

    const removeListener = vi.spyOn(window, 'removeEventListener');

    const view = await render(<Probe />);

    expect(view.textContent()).toBe('640 480');

    view.unmount();

    expect(removeListener).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});
