// SPDX-License-Identifier: MIT
/**
 * `useFullScreenChange` reports whether the document is in fullscreen, now and on every change — the
 * document's state, not the element's, because a chart that has to redraw on leaving fullscreen must
 * do so whatever element went in. The suite dispatches the document's own `fullscreenchange` events
 * and holds three things: both directions are reported, the callback is always the latest one given,
 * and listening stops with the component.
 */
// @vitest-environment jsdom

import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, test } from 'vitest';
import { render } from '@/util/testing/render';
import { useFullScreenChange } from './';

/** A receiver the probe's callbacks report into; swapped between renders to prove the latest wins. */
interface Receiver {
  push(isFullScreen: boolean): void;
}

function Probe({ receiver }: { readonly receiver: Receiver }) {
  useFullScreenChange((isFullScreen) => {
    receiver.push(isFullScreen);
  });

  return <div />;
}

/**
 * Sets the `fullscreenElement` jsdom does not implement, to the value the browser would report at
 * that moment. Restored by the `afterEach` below.
 */
function setFullScreenElement(value: Element | null): void {
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    value,
  });
}

/** Dispatches the event the browser fires when the fullscreen state changes. */
function dispatchFullScreenChange(): void {
  act(() => {
    document.dispatchEvent(new Event('fullscreenchange'));
  });
}

afterEach(() => {
  Reflect.deleteProperty(document, 'fullscreenElement');
});

describe('useFullScreenChange', () => {
  test('reports both entering and leaving fullscreen', async () => {
    const received: boolean[] = [];

    await render(<Probe receiver={{ push: (value) => received.push(value) }} />);

    // jsdom's document is never in fullscreen, so the same event covers both halves of the answer.
    dispatchFullScreenChange();

    expect(received).toEqual([false]);

    setFullScreenElement(document.documentElement);
    dispatchFullScreenChange();

    expect(received).toEqual([false, true]);

    setFullScreenElement(null);
    dispatchFullScreenChange();

    expect(received).toEqual([false, true, false]);
  });

  test('always reports to the latest callback given', async () => {
    const first: boolean[] = [];
    const second: boolean[] = [];

    const view = await render(
      <Probe
        receiver={{
          push: (value) => {
            first.push(value);
          },
        }}
      />,
    );

    dispatchFullScreenChange();

    expect(first).toEqual([false]);
    expect(second).toEqual([]);

    await view.update(
      <Probe
        receiver={{
          push: (value) => {
            second.push(value);
          },
        }}
      />,
    );

    dispatchFullScreenChange();

    expect(first).toEqual([false]);
    expect(second).toEqual([false]);

    setFullScreenElement(document.documentElement);
    dispatchFullScreenChange();

    expect(second).toEqual([false, true]);
  });

  test('stops listening once the component unmounts', async () => {
    const received: boolean[] = [];

    const view = await render(<Probe receiver={{ push: (value) => received.push(value) }} />);

    dispatchFullScreenChange();

    expect(received).toEqual([false]);

    view.unmount();
    dispatchFullScreenChange();

    expect(received).toEqual([false]);
  });
});
