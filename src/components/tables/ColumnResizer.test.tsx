// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { ColumnResizer } from '@/components/tables/ColumnResizer';
import { act, click, render } from '@/util/testing/render';

describe('ColumnResizer', () => {
  it("reports the column's width and its minimum as a separator's value", async () => {
    const { find } = await render(
      <ColumnResizer width={120} minWidth={40} onResize={() => undefined} />,
    );

    const handle = find('hr');

    expect(handle.getAttribute('aria-valuenow')).toBe('120');
    expect(handle.getAttribute('aria-valuemin')).toBe('40');
    expect(handle.getAttribute('aria-orientation')).toBe('vertical');
    expect(handle.getAttribute('tabindex')).toBe('0');
  });

  it('falls back to a zero minimum when the minimum is not a number', async () => {
    const { find } = await render(
      <ColumnResizer width={120} minWidth="2rem" onResize={() => undefined} />,
    );

    expect(find('hr').getAttribute('aria-valuemin')).toBe('0');
  });

  it('steps the column left and right on the arrow keys, ending the resize each time', async () => {
    const onResize = vi.fn();
    const onResizeDone = vi.fn();
    const { find } = await render(
      <ColumnResizer width={120} onResize={onResize} onResizeDone={onResizeDone} />,
    );

    const handle = find('hr');

    act(() => {
      handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });

    expect(onResize).toHaveBeenLastCalledWith(8);

    act(() => {
      handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    });

    expect(onResize).toHaveBeenLastCalledWith(-8);
    expect(onResizeDone).toHaveBeenCalledTimes(2);
  });

  it('ignores a key that is not an arrow', async () => {
    const onResize = vi.fn();
    const { find } = await render(<ColumnResizer width={120} onResize={onResize} />);

    act(() => {
      find('hr').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(onResize).not.toHaveBeenCalled();
  });

  it('does nothing on an arrow key when no callbacks were given', async () => {
    const { find } = await render(<ColumnResizer width={120} />);

    expect(() => {
      act(() => {
        find('hr').dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
        );
      });
    }).not.toThrow();
  });

  it('reports a click as a zero-movement resize', async () => {
    const onResize = vi.fn();
    const { find } = await render(<ColumnResizer width={120} onResize={onResize} />);

    click(find('hr'));

    expect(onResize).toHaveBeenCalledWith(0);
  });

  it('reports each mousemove of a drag and restores the cursor when the drag ends', async () => {
    const onResize = vi.fn();
    const onResizeDone = vi.fn();
    const { find } = await render(
      <ColumnResizer width={120} onResize={onResize} onResizeDone={onResizeDone} />,
    );

    act(() => {
      find('hr').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(document.body.style.cursor).toBe('col-resize');

    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { movementX: 25, bubbles: true }));
    });

    expect(onResize).toHaveBeenCalledWith(25);

    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    expect(onResizeDone).toHaveBeenCalledTimes(1);
    expect(document.body.style.cursor).toBe('');
  });
});
