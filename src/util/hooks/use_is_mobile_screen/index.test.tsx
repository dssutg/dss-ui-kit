/**
 * `useIsMobileScreen` answers whether the window is narrower than {@link minDesktopWidth} — a layout
 * decision read off the window's inner width and kept current on resize. The suite mounts on both
 * sides of the line, drives a real `resize` event across it in both directions, and holds that
 * listening ends when the component does.
 */
// @vitest-environment jsdom

import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { render } from '@/util/testing/render';
import { minDesktopWidth, useIsMobileScreen } from './';

function Probe() {
  const isMobileScreen = useIsMobileScreen();

  return <div data-testid="view">{String(isMobileScreen)}</div>;
}

describe('useIsMobileScreen', () => {
  const originalWidth = window.innerWidth;

  beforeEach(() => {
    window.innerWidth = originalWidth;
  });

  afterEach(() => {
    window.innerWidth = originalWidth;
  });

  test('reads the width at mount on the mobile side of the line', async () => {
    window.innerWidth = minDesktopWidth - 1;

    const view = await render(<Probe />);

    expect(view.textContent()).toBe('true');
  });

  test('reads the width at mount on the desktop side of the line', async () => {
    window.innerWidth = minDesktopWidth;

    const view = await render(<Probe />);

    expect(view.textContent()).toBe('false');
  });

  test('follows a resize from desktop to mobile and back', async () => {
    window.innerWidth = minDesktopWidth + 100;

    const view = await render(<Probe />);

    expect(view.textContent()).toBe('false');

    window.innerWidth = minDesktopWidth - 1;

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(view.textContent()).toBe('true');

    window.innerWidth = minDesktopWidth + 1;

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(view.textContent()).toBe('false');
  });

  test('stops following resize once the component unmounts', async () => {
    const removeListener = vi.spyOn(window, 'removeEventListener');

    const view = await render(<Probe />);

    window.innerWidth = minDesktopWidth - 1;

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(view.textContent()).toBe('true');

    view.unmount();

    // The listener is removed with the component: nothing subscribes to the window afterwards.
    expect(removeListener).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});
