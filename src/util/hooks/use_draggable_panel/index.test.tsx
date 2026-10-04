// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { useDraggablePanel } from '@/util/hooks/use_draggable_panel';
import { act, render } from '@/util/testing/render';

/**
 * The two elements a caller puts the refs on, and nothing else: the hook writes to their styles, so
 * every assertion here is about what it wrote.
 */
function Panel({
  visible,
  onVisibleChange,
  dragStartEdgeWidth,
}: {
  readonly visible: boolean;
  readonly onVisibleChange: (visible: boolean) => void;
  readonly dragStartEdgeWidth?: number | undefined;
}) {
  const { panelRef, overlayRef } = useDraggablePanel({
    visible,
    onVisibleChange,
    dragStartEdgeWidth,
  });

  return (
    <>
      <button ref={overlayRef} type="button">
        Backdrop
      </button>
      <div ref={panelRef}>Panel</div>
    </>
  );
}

/**
 * The backdrop and the panel of a rendered tree, in the order they were rendered.
 *
 * Scoped to the container, because a query on `document.body` finds the container itself first.
 */
function elements(container: HTMLElement) {
  const [overlay, panel] = container.querySelectorAll<HTMLElement>('button, div');

  if (overlay === undefined || panel === undefined) {
    throw new Error('the panel and its backdrop are not in the document');
  }

  return { overlay, panel };
}

/** A pointer event at a position, as the drag is taken from the document. */
function pointerEvent(type: string, x: number, y: number): MouseEvent {
  return new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true });
}

/** A press and the moves that follow it, with the pointer still down. */
function pressAndMove(points: ReadonlyArray<readonly [number, number]>): void {
  const [start, ...rest] = points;

  if (start === undefined) {
    throw new Error('a drag has a start');
  }

  act(() => {
    document.dispatchEvent(pointerEvent('mousedown', start[0], start[1]));

    for (const [x, y] of rest) {
      document.dispatchEvent(pointerEvent('mousemove', x, y));
    }
  });
}

/** A release at a position, which is what ends a gesture and settles the panel. */
function releaseAt(x: number, y: number): void {
  act(() => {
    document.dispatchEvent(pointerEvent('mouseup', x, y));
  });
}

/** A whole gesture, from the press to the release, as one act: the hook is written imperatively. */
function drag(points: ReadonlyArray<readonly [number, number]>): void {
  const [start, ...rest] = points;

  if (start === undefined) {
    throw new Error('a drag has a start');
  }

  act(() => {
    document.dispatchEvent(pointerEvent('mousedown', start[0], start[1]));

    for (const [x, y] of rest) {
      document.dispatchEvent(pointerEvent('mousemove', x, y));
    }

    const last = points[points.length - 1];

    if (last !== undefined) {
      document.dispatchEvent(pointerEvent('mouseup', last[0], last[1]));
    }
  });
}

describe('useDraggablePanel', () => {
  it('holds the panel off the edge while it is closed, and on the edge while it is open', async () => {
    const { container, update } = await render(
      <Panel visible={false} onVisibleChange={() => undefined} />,
    );

    const { panel } = elements(container);

    expect(panel.style.transform).toBe('translateX(-1024px)');

    await update(<Panel visible onVisibleChange={() => undefined} />);

    expect(panel.style.transform).toBe('translateX(0px)');
  });

  it('fades the backdrop in proportion to how open the panel is', async () => {
    const { container, update } = await render(
      <Panel visible={false} onVisibleChange={() => undefined} />,
    );

    const { overlay } = elements(container);

    expect(overlay.style.opacity).toBe('0');

    await update(<Panel visible onVisibleChange={() => undefined} />);

    expect(overlay.style.opacity).toBe('0.5');
  });

  it('follows a drag that starts at the edge, and opens when it is released past halfway', async () => {
    const onVisibleChange = vi.fn();

    const { container } = await render(<Panel visible={false} onVisibleChange={onVisibleChange} />);

    const { panel } = elements(container);

    // The stubbed panel is 1024 wide, so an offset of 700 is a third of it, and the drag has to end
    // short of that to open.
    drag([
      [5, 100],
      [300, 100],
      [700, 100],
    ]);

    expect(onVisibleChange).toHaveBeenCalledWith(true);
    expect(panel.style.transform).toBe('translateX(0px)');
  });

  it('reports nothing until the drag is released', async () => {
    const onVisibleChange = vi.fn();

    await render(<Panel visible={false} onVisibleChange={onVisibleChange} />);

    pressAndMove([
      [5, 100],
      [300, 100],
    ]);

    expect(onVisibleChange).not.toHaveBeenCalled();

    releaseAt(300, 100);

    expect(onVisibleChange).toHaveBeenCalledWith(false);
  });

  it('closes a panel whose drag is released short of halfway, and puts it back off the edge', async () => {
    const onVisibleChange = vi.fn();

    const { container } = await render(<Panel visible onVisibleChange={onVisibleChange} />);

    const { panel } = elements(container);

    drag([
      [5, 100],
      [-600, 100],
    ]);

    expect(onVisibleChange).toHaveBeenCalledWith(false);
    expect(panel.style.transform).toBe('translateX(-1024px)');
  });

  it('leaves a panel open when a drag of it does not reach halfway', async () => {
    const onVisibleChange = vi.fn();

    const { container } = await render(<Panel visible onVisibleChange={onVisibleChange} />);

    const { panel } = elements(container);

    drag([
      [5, 100],
      [-100, 100],
    ]);

    expect(onVisibleChange).toHaveBeenCalledWith(true);
    expect(panel.style.transform).toBe('translateX(0px)');
  });

  it('ignores a drag that starts away from the panel and from the edge it slides in from', async () => {
    const { container } = await render(<Panel visible={false} onVisibleChange={() => undefined} />);

    const { panel } = elements(container);

    drag([
      [500, 100],
      [900, 100],
    ]);

    expect(panel.style.transform).toBe('translateX(-1024px)');
  });

  it('takes a drag that starts on the panel, wherever on the panel it started', async () => {
    const { container } = await render(<Panel visible onVisibleChange={() => undefined} />);

    const { panel } = elements(container);

    // Well away from the edge the drag is recognised from, so the only reason to take this one is
    // that the press landed on the panel itself. The move goes to the document, because that is
    // where the rest of the gesture is listened for.
    act(() => {
      panel.dispatchEvent(pointerEvent('mousedown', 500, 100));
    });

    act(() => {
      document.dispatchEvent(pointerEvent('mousemove', 200, 100));
    });

    expect(panel.style.transform).toBe('translateX(-300px)');
  });

  it('takes the edge at its configured width rather than the default', async () => {
    const { container } = await render(
      <Panel visible={false} onVisibleChange={() => undefined} dragStartEdgeWidth={600} />,
    );

    const { panel } = elements(container);

    pressAndMove([
      [100, 100],
      [300, 100],
    ]);

    expect(panel.style.transform).toBe('translateX(-824px)');
  });

  it('ignores a press inside the default edge that a narrower drag start would have taken', async () => {
    const { container } = await render(
      <Panel visible={false} onVisibleChange={() => undefined} dragStartEdgeWidth={10} />,
    );

    const { panel } = elements(container);

    pressAndMove([
      [100, 100],
      [300, 100],
    ]);

    expect(panel.style.transform).toBe('translateX(-1024px)');
  });

  it('hands a mostly vertical drag back to the panel, which may need to scroll', async () => {
    const onVisibleChange = vi.fn();

    const { container } = await render(<Panel visible onVisibleChange={onVisibleChange} />);

    const { panel } = elements(container);

    drag([
      [5, 100],
      [10, 300],
      [400, 300],
    ]);

    // The panel did not follow the pointer sideways: the first move was vertical, so the drag ended
    // there, and the move after it reached no listener.
    expect(panel.style.transform).toBe('translateX(0px)');
    expect(onVisibleChange).toHaveBeenCalledTimes(1);
  });

  it('follows no pointer after the gesture is over', async () => {
    const { container } = await render(<Panel visible={false} onVisibleChange={() => undefined} />);

    const { panel } = elements(container);

    drag([
      [5, 100],
      [300, 100],
    ]);

    expect(panel.style.transform).toBe('translateX(-1024px)');

    // A pointer that moves after the release belongs to nothing: the listeners are gone, so the panel
    // does not follow a mouse that is simply passing over the page.
    act(() => {
      document.dispatchEvent(pointerEvent('mousemove', 900, 100));
    });

    expect(panel.style.transform).toBe('translateX(-1024px)');
  });
});
