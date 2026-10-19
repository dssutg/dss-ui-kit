// SPDX-License-Identifier: MIT
// The calendar grid's navigation, marking and clicked-day reports.
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { MiniCalendar } from '@/components/charts/MiniCalendar';
import { click, render } from '@/util/testing/render';

/**
 * The size the testing setup stubs every element to, which is what the popup's own height reads as.
 * `window.innerHeight` is the jsdom default of 768, so the clamp is `768 - 768 - 100 = -100`.
 */
const STUBBED_HEIGHT = 768;
const CLAMPED_TOP = -(STUBBED_HEIGHT - STUBBED_HEIGHT + 100);

describe('MiniCalendar', () => {
  it('shows the calendar of the date it is given, and reports a click of its own as a close', async () => {
    const onClose = vi.fn();
    const { find } = await render(
      <MiniCalendar
        visible={true}
        date={new Date(2024, 7, 20)}
        posX={40}
        posY={50}
        onClose={onClose}
      />,
    );

    // The popup is one button: a click anywhere on it closes it, and `StaticCalendar` renders the
    // month it was handed inside.
    expect(find('h2').textContent).toBe('August, 2024');
    expect(find('button').getAttribute('aria-label')).toBe('Close');

    await click(find('button'));

    // The click the popup receives bubbles to the window listener, which is the only handler that
    // closes it, so a click on the popup is reported once.
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('takes the focus when it becomes visible, and lets it go when it is hidden', async () => {
    const onClose = vi.fn();
    const hidden = (
      <MiniCalendar
        visible={false}
        date={new Date(2024, 7, 20)}
        posX={40}
        posY={50}
        onClose={onClose}
      />
    );
    const visible = (
      <MiniCalendar
        visible={true}
        date={new Date(2024, 7, 20)}
        posX={40}
        posY={50}
        onClose={onClose}
      />
    );

    const { find, update } = await render(hidden);

    const button = find('button');

    // Hidden, the popup is off screen and asks for no keyboard.
    expect(button.style.display).toBe('none');
    expect(document.activeElement).not.toBe(button);

    await update(visible);

    expect(button.style.display).toBe('block');
    expect(document.activeElement).toBe(button);
  });

  it('clamps its top so it stays above the bottom edge, and follows a new position', async () => {
    const onClose = vi.fn();
    const first = (
      <MiniCalendar
        visible={true}
        date={new Date(2024, 7, 20)}
        posX={40}
        posY={50}
        onClose={onClose}
      />
    );
    const moved = (
      <MiniCalendar
        visible={true}
        date={new Date(2024, 7, 20)}
        posX={120}
        posY={2000}
        onClose={onClose}
      />
    );

    const { find, update } = await render(first);

    const button = find('button');

    // The stubbed element height and the jsdom viewport are both tall enough that a popup asked for
    // below the last 100 pixels lands on the clamp instead.
    expect(button.style.top).toBe(`${CLAMPED_TOP}px`);
    expect(button.style.left).toBe('40px');

    await update(moved);

    expect(button.style.left).toBe('120px');
    expect(button.style.top).toBe(`${CLAMPED_TOP}px`);
  });

  it('closes on Escape, and only on Escape', async () => {
    const onClose = vi.fn();
    const { find } = await render(
      <MiniCalendar
        visible={true}
        date={new Date(2024, 7, 20)}
        posX={40}
        posY={50}
        onClose={onClose}
      />,
    );

    const button = find('button');

    const press = (code: string): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', { code, bubbles: true });
      button.dispatchEvent(event);

      return event;
    };

    press('Enter');
    expect(onClose).not.toHaveBeenCalled();

    press('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from a click anywhere on the window while it is open, and stops the click from going further', async () => {
    const onClose = vi.fn();
    await render(
      <MiniCalendar
        visible={true}
        date={new Date(2024, 7, 20)}
        posX={40}
        posY={50}
        onClose={onClose}
      />,
    );

    // The window is the last node a click travels to, so the only behaviour visible from here is
    // the close and the event stopped from being used by the page it travelled from.
    const event = click(document.body);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('ignores a click on the window while it is hidden, rather than closing behind its caller', async () => {
    const onClose = vi.fn();
    const { find } = await render(
      <MiniCalendar
        visible={false}
        date={new Date(2024, 7, 20)}
        posX={40}
        posY={50}
        onClose={onClose}
      />,
    );

    const event = click(document.body);

    expect(onClose).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    expect(find('button').style.display).toBe('none');
  });
});
