// SPDX-License-Identifier: MIT
/**
 * `useOutsideComponentClick` calls back when a click lands outside an element — how a popover closes.
 * It listens on the capture phase, so a click that the element's own children stop from bubbling is
 * still seen. The suite holds each answer: outside calls back, inside does not, a ref that was still
 * null on mount registered nothing but starts once the element arrives, and the listener is gone
 * after the component unmounts.
 */
// @vitest-environment jsdom

import { useRef } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { click, render } from '@/util/testing/render';
import { useOutsideComponentClick } from './';

/**
 * A probe that attaches the ref to its element only when asked, which is how a caller's element can
 * be absent while the hook is already mounted.
 */
function Probe({
  onOutside,
  attachTarget,
}: {
  readonly onOutside: () => void;
  readonly attachTarget: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useOutsideComponentClick(ref, onOutside);

  return (
    <div>
      {attachTarget ? (
        <div ref={ref} data-testid="target">
          inside the element
        </div>
      ) : null}
    </div>
  );
}

describe('useOutsideComponentClick', () => {
  test('does not call back for a click on the element itself', async () => {
    const onOutside = vi.fn();

    const view = await render(<Probe onOutside={onOutside} attachTarget={true} />);

    click(view.find('[data-testid="target"]'));

    expect(onOutside).not.toHaveBeenCalled();
  });

  test('calls back when a click lands outside the element', async () => {
    const onOutside = vi.fn();

    await render(<Probe onOutside={onOutside} attachTarget={true} />);

    click(document.body);

    expect(onOutside).toHaveBeenCalledTimes(1);
  });

  test('calls back for a click whose target is not a node, as for the window itself', async () => {
    const onOutside = vi.fn();

    await render(<Probe onOutside={onOutside} attachTarget={true} />);

    // A dispatch on the window carries no node as its target; such a click is outside anything.
    window.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onOutside).toHaveBeenCalledTimes(1);
  });

  test('registers nothing while the ref is null, and starts once the element arrives', async () => {
    const silentOutside = vi.fn();

    const view = await render(<Probe onOutside={silentOutside} attachTarget={false} />);

    click(document.body);

    expect(silentOutside).not.toHaveBeenCalled();

    // The new callback identity changes the effect's dependencies, so the listener is registered
    // only on this update — at which point the ref points at a real element.
    const attachedOutside = vi.fn();

    await view.update(<Probe onOutside={attachedOutside} attachTarget={true} />);

    click(document.body);

    expect(attachedOutside).toHaveBeenCalledTimes(1);
    expect(silentOutside).not.toHaveBeenCalled();
  });

  test('stops listening once the component unmounts', async () => {
    const onOutside = vi.fn();

    const view = await render(<Probe onOutside={onOutside} attachTarget={true} />);

    click(document.body);

    expect(onOutside).toHaveBeenCalledTimes(1);

    // The cleanup that removes the window listener runs before the dispatch below.
    view.unmount();

    // A click after unmount reaches nothing: the listener was removed with the component.
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onOutside).toHaveBeenCalledTimes(1);
  });
});
