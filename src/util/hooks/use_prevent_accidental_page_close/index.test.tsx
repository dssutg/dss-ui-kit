// SPDX-License-Identifier: MIT
/**
 * `usePreventAccidentalPageClose` asks the browser to confirm before the page closes, while
 * `enabled` holds. The message is the browser's own, so the only thing a test can assert is the
 * intercept itself: the `beforeunload` event the hook listens for is cancelled exactly while it is
 * enabled, the answer follows the caller turning it off, and listening stops with the component.
 */
// @vitest-environment jsdom

import { act } from 'react-dom/test-utils';
import { describe, expect, test } from 'vitest';
import { render } from '@/util/testing/render';
import { usePreventAccidentalPageClose } from './';

function Probe({ enabled }: { readonly enabled: boolean }) {
  usePreventAccidentalPageClose(enabled);

  return <div />;
}

/**
 * Dispatches the unload event the browser sends before a close, and answers whether it was
 * cancelled — which is what decides whether the confirmation dialog is shown.
 */
function simulatedUnload(): boolean {
  const event = new Event('beforeunload', { cancelable: true });

  act(() => {
    window.dispatchEvent(event);
  });

  return event.defaultPrevented;
}

describe('usePreventAccidentalPageClose', () => {
  test('asks to confirm the close while enabled', async () => {
    await render(<Probe enabled={true} />);

    expect(simulatedUnload()).toBe(true);
  });

  test('lets the page close unchanged while disabled', async () => {
    await render(<Probe enabled={false} />);

    expect(simulatedUnload()).toBe(false);
  });

  test('follows the caller turning the confirmation off', async () => {
    const view = await render(<Probe enabled={true} />);

    expect(simulatedUnload()).toBe(true);

    await view.update(<Probe enabled={false} />);

    expect(simulatedUnload()).toBe(false);
  });

  test('stops asking once the component unmounts', async () => {
    const view = await render(<Probe enabled={true} />);

    expect(simulatedUnload()).toBe(true);

    view.unmount();

    expect(simulatedUnload()).toBe(false);
  });
});
