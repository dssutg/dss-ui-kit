// SPDX-License-Identifier: MIT
/**
 * `useSyncScroll` keeps two scrollable elements at the same scroll position — two views of one
 * document side by side, mirroring the position and not the content. The suite drives real `scroll`
 * events in both directions, holds that an `enabled` set to false leaves both alone (and that
 * turning it back on is enough, because the subscription itself does not change), and covers the
 * missing-container case the hook has to survive quietly.
 */
// @vitest-environment jsdom

import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, test } from 'vitest';
import { render } from '@/util/testing/render';
import { useSyncScroll } from './';

/** The two elements a caller scrolls, mounted in the document so they are scrollable subjects. */
interface Scrollers {
  readonly first: HTMLDivElement;
  readonly second: HTMLDivElement;
}

/**
 * The scrollers are the caller's, created in the document before the probe renders: the hook takes
 * the elements themselves, not refs.
 */
function mountScrollers(): Scrollers {
  const first = document.createElement('div');
  const second = document.createElement('div');

  document.body.appendChild(first);
  document.body.appendChild(second);

  return { first, second };
}

function SyncScrollProbe({
  container1,
  container2,
  enabled,
}: {
  readonly container1: HTMLDivElement | null;
  readonly container2: HTMLDivElement | null;
  readonly enabled?: boolean | undefined;
}) {
  useSyncScroll({ container1, container2, enabled });

  return <div />;
}

/** Sends the scroll event the browser fires when an element is scrolled, without moving anything. */
function sendScroll(target: HTMLDivElement): void {
  act(() => {
    target.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
}

describe('useSyncScroll', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('mirrors the scroll of the first container into the second, enabled left at its default', async () => {
    const { first, second } = mountScrollers();

    await render(<SyncScrollProbe container1={first} container2={second} />);

    first.scrollTop = 42;
    sendScroll(first);

    expect(second.scrollTop).toBe(42);
  });

  test('mirrors the scroll of the second container into the first', async () => {
    const { first, second } = mountScrollers();

    await render(<SyncScrollProbe container1={first} container2={second} enabled={true} />);

    second.scrollTop = 7;
    sendScroll(second);

    expect(first.scrollTop).toBe(7);
  });

  test('leaves both containers alone while disabled, and syncs once enabled again', async () => {
    const { first, second } = mountScrollers();

    const view = await render(
      <SyncScrollProbe container1={first} container2={second} enabled={false} />,
    );

    first.scrollTop = 42;
    sendScroll(first);

    expect(second.scrollTop).toBe(0);

    second.scrollTop = 7;
    sendScroll(second);

    // The scroll on the second side mirrors back into the first while disabled — checked by it
    // holding the value it already had, unchanged by the disabled sync.
    expect(first.scrollTop).toBe(42);

    // Re-enabling is enough: the subscription does not change, only the callback's answer.
    await view.update(<SyncScrollProbe container1={first} container2={second} enabled={true} />);

    sendScroll(first);

    expect(second.scrollTop).toBe(42);
  });

  test('survives one of the two containers being missing', async () => {
    const { first, second } = mountScrollers();

    const view = await render(<SyncScrollProbe container1={first} container2={null} />);

    // The first side registers, but has nothing to mirror into: the scroll is a no-op.
    first.scrollTop = 30;
    sendScroll(first);

    expect(first.scrollTop).toBe(30);

    await view.update(<SyncScrollProbe container1={null} container2={second} />);

    // With the first container gone, the second side has no subscription at all.
    second.scrollTop = 31;
    sendScroll(second);

    expect(second.scrollTop).toBe(31);
    expect(first.scrollTop).toBe(30);
  });
});
