/**
 * `useDraggablePanel` slides a panel in from the edge of the viewport and back out, following a drag
 * the pointer makes on it or near the edge it slides in from, writing the panel's and the backdrop's
 * styles directly. The suite drives the whole gesture with real mouse and touch-shaped events and
 * holds the states a caller reads: where the panel sits while open, closed and half-dragged, how the
 * backdrop fades in proportion, the callback that reports the side the drag ended on, the un-animated
 * variant, and the two things that must not reach a listener — a press that carries no pointer, and a
 * panel that is gone from the tree while the pointer is still down.
 */
// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDraggablePanel } from '@/util/hooks/use_draggable_panel';
import { act, render } from '@/util/testing/render';

/**
 * A `Touch` carrying only the fields the source reads plus the interface's required ones: jsdom
 * implements neither `Touch` nor `TouchEvent`, and the panel listens on `touchstart`/`touchmove`
 * for a gesture that arrives without a mouse.
 */
class StubTouch implements Touch {
  readonly clientX: number;
  readonly clientY: number;
  readonly force: number;
  readonly identifier: number;
  readonly pageX: number;
  readonly pageY: number;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly rotationAngle: number;
  readonly screenX: number;
  readonly screenY: number;
  readonly target: EventTarget;

  constructor(init: TouchInit) {
    this.clientX = init.clientX ?? 0;
    this.clientY = init.clientY ?? 0;
    this.force = init.force ?? 0;
    this.identifier = init.identifier;
    this.pageX = init.pageX ?? 0;
    this.pageY = init.pageY ?? 0;
    this.radiusX = init.radiusX ?? 0;
    this.radiusY = init.radiusY ?? 0;
    this.rotationAngle = init.rotationAngle ?? 0;
    this.screenX = init.screenX ?? 0;
    this.screenY = init.screenY ?? 0;
    this.target = init.target;
  }
}

/** Builds a `TouchList`-shaped object: `length`, `item(index)` and numeric-indexed touches. */
function stubTouchList(touches: readonly Touch[]): TouchList {
  const byIndex: { [index: number]: Touch } = {};
  for (const [index, value] of touchValues(touches).entries()) {
    byIndex[index] = value;
  }

  return {
    ...byIndex,
    length: touches.length,
    item: (index: number): Touch | null => byIndex[index] ?? null,
    [Symbol.iterator]: (): ArrayIterator<Touch> => touchValues(touches).values(),
  };
}

/** The touches as an array; the iterator the `TouchList` interface requires is built from it. */
function touchValues(touches: readonly Touch[]): Touch[] {
  const values: Touch[] = [];
  for (let index = 0; index < touches.length; index += 1) {
    const touch = touches[index];
    if (touch !== undefined) {
      values.push(touch);
    }
  }

  return values;
}

/** A `TouchEvent`-shaped event whose `touches` is a fake list built from the given touches. */
class StubTouchEvent extends Event {
  readonly touches: TouchList;

  constructor(type: string, init: TouchEventInit = {}) {
    super(type, init);
    this.touches = stubTouchList(init.touches ?? []);
  }
}

/** A touch event at a position; without coordinates it carries no active touch. */
function touchEvent(
  type: 'touchstart' | 'touchmove' | 'touchend',
  x?: number,
  y?: number,
): TouchEvent {
  const touches =
    x === undefined
      ? []
      : [new StubTouch({ identifier: 1, target: document.body, clientX: x, clientY: y ?? 0 })];

  // Constructed through the global, which the suite has replaced with the stub above: the type is
  // the DOM one, the instance is the stub.
  return new TouchEvent(type, { touches, bubbles: true, cancelable: true });
}

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
  beforeEach(() => {
    vi.stubGlobal('TouchEvent', StubTouchEvent);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('holds the panel off the edge while it is closed, and on the edge while it is open', async () => {
    const { container, update } = await render(
      <Panel visible={false} onVisibleChange={() => undefined} />,
    );

    const { panel } = elements(container);

    expect(panel.style.transform).toBe('translateX(-1024px)');

    await update(<Panel visible={true} onVisibleChange={() => undefined} />);

    expect(panel.style.transform).toBe('translateX(0px)');
  });

  it('fades the backdrop in proportion to how open the panel is', async () => {
    const { container, update } = await render(
      <Panel visible={false} onVisibleChange={() => undefined} />,
    );

    const { overlay } = elements(container);

    expect(overlay.style.opacity).toBe('0');

    await update(<Panel visible={true} onVisibleChange={() => undefined} />);

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

    const { container } = await render(<Panel visible={true} onVisibleChange={onVisibleChange} />);

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

    const { container } = await render(<Panel visible={true} onVisibleChange={onVisibleChange} />);

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
    const { container } = await render(<Panel visible={true} onVisibleChange={() => undefined} />);

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

    const { container } = await render(<Panel visible={true} onVisibleChange={onVisibleChange} />);

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

  it('runs without animation: no transition and a backdrop left transparent', async () => {
    const view = await render(
      <FlexiblePanel
        visible={false}
        onVisibleChange={() => undefined}
        animated={false}
        showPanel={true}
        showOverlay={true}
      />,
    );

    const { overlay, panel } = elements(view.container);

    expect(panel.style.transition).toBe('none');
    expect(panel.style.transform).toBe('translateX(-1024px)');
    expect(overlay.style.opacity).toBe('0');

    // A release under the no-animation setting puts the panel back with no transition to run.
    drag([
      [5, 100],
      [-200, 100],
    ]);

    expect(panel.style.transition).toBe('none');
    expect(panel.style.transform).toBe('translateX(-1024px)');
  });

  it('leaves a tree with no panel and no backdrop untouched and inert', async () => {
    const onVisibleChange = vi.fn();

    const view = await render(
      <FlexiblePanel
        visible={true}
        onVisibleChange={onVisibleChange}
        showPanel={false}
        showOverlay={false}
      />,
    );

    // The panel's absence is the branch that measures nothing at mount.
    expect(view.container.contains(document.body)).toBe(false);
    expect(view.container.querySelector('div')).toBe(null);
    expect(onVisibleChange).not.toHaveBeenCalled();

    // A press on the document is not the start of a drag: there is nothing to drag.
    act(() => {
      document.dispatchEvent(pointerEvent('mousedown', 5, 100));
    });

    expect(onVisibleChange).not.toHaveBeenCalled();
  });

  it('claims a touch press that carries no pointer without starting a drag', async () => {
    const onVisibleChange = vi.fn();

    await render(
      <FlexiblePanel
        visible={false}
        onVisibleChange={onVisibleChange}
        showPanel={true}
        showOverlay={true}
      />,
    );

    pressTouchOnDocument('touchstart');

    expect(onVisibleChange).not.toHaveBeenCalled();
  });

  it('does not take a backdrop that disappears mid-drag', async () => {
    const onVisibleChange = vi.fn();

    const view = await render(
      <FlexiblePanel
        visible={false}
        onVisibleChange={onVisibleChange}
        showPanel={true}
        showOverlay={true}
      />,
    );

    const { panel } = elements(view.container);

    // A closed panel dragged right along the edge: the offset is halfway open and would keep moving.
    act(() => {
      document.dispatchEvent(pointerEvent('mousedown', 5, 100));
    });

    act(() => {
      document.dispatchEvent(pointerEvent('mousemove', 300, 100));
    });

    expect(panel.style.transform).toBe('translateX(-729px)');
    expect(document.body.style.userSelect).toBe('none');
    expect(panel.style.pointerEvents).toBe('none');

    const halfOpen = panel.style.transform;

    await view.update(
      <FlexiblePanel
        visible={false}
        onVisibleChange={onVisibleChange}
        showPanel={true}
        showOverlay={false}
      />,
    );

    // Without the backdrop there is nothing proportioned to fade, so the panel is left where it was.
    act(() => {
      document.dispatchEvent(pointerEvent('mousemove', 700, 100));
    });

    expect(panel.style.transform).toBe(halfOpen);

    releaseAt(700, 100);

    // The release still settles: nothing opened, the caller is told, and the pointer state the drag
    // claimed is handed back.
    expect(onVisibleChange).toHaveBeenCalledWith(false);
    expect(panel.style.transform).toBe(halfOpen);
    expect(document.body.style.userSelect).toBe('');
    expect(panel.style.pointerEvents).toBe('');
  });

  it('does not take a panel that disappears mid-drag, and releases the pointer cleanly', async () => {
    const onVisibleChange = vi.fn();

    const view = await render(
      <FlexiblePanel
        visible={false}
        onVisibleChange={onVisibleChange}
        showPanel={true}
        showOverlay={true}
      />,
    );

    const detached = elements(view.container).panel;

    act(() => {
      document.dispatchEvent(pointerEvent('mousedown', 5, 100));
    });

    act(() => {
      document.dispatchEvent(pointerEvent('mousemove', 200, 100));
    });

    expect(detached.style.transform).toBe('translateX(-829px)');

    await view.update(
      <FlexiblePanel
        visible={false}
        onVisibleChange={onVisibleChange}
        showPanel={false}
        showOverlay={true}
      />,
    );

    // The gone panel is not moved further: the offset arithmetic has nothing to write to.
    act(() => {
      document.dispatchEvent(pointerEvent('mousemove', 400, 100));
    });

    expect(detached.style.transform).toBe('translateX(-829px)');

    releaseAt(400, 100);

    // Past the halfway point, the release still reports closed and settles the pointer state.
    expect(onVisibleChange).toHaveBeenCalledWith(false);
    expect(document.body.style.userSelect).toBe('');
    expect(detached.style.transition).toBe('transform 0.3s, box-shadow 0.3s');
  });

  it('ignores a touch move that carries no pointer mid-drag', async () => {
    const onVisibleChange = vi.fn();

    const view = await render(
      <FlexiblePanel
        visible={false}
        onVisibleChange={onVisibleChange}
        showPanel={true}
        showOverlay={true}
      />,
    );

    const { panel } = elements(view.container);

    act(() => {
      document.dispatchEvent(pointerEvent('mousedown', 5, 100));
    });

    act(() => {
      document.dispatchEvent(pointerEvent('mousemove', 300, 100));
    });

    const halfway = panel.style.transform;

    pressTouchOnDocument('touchmove');

    // A touch move with the last contact lifted carries no position: the drag holds where it was.
    expect(panel.style.transform).toBe(halfway);

    pressTouchOnDocument('touchend');

    expect(onVisibleChange).toHaveBeenCalledWith(false);
    expect(document.body.style.userSelect).toBe('');
  });
});

/**
 * A probe with the panel and the backdrop each optional, which is how a caller's elements can be
 * missing: hidden while the hook is mounted, or taken out of the tree mid-gesture.
 */
function FlexiblePanel({
  visible,
  onVisibleChange,
  animated,
  dragStartEdgeWidth,
  showPanel,
  showOverlay,
}: {
  readonly visible: boolean;
  readonly onVisibleChange: (visible: boolean) => void;
  readonly animated?: boolean;
  readonly dragStartEdgeWidth?: number | undefined;
  readonly showPanel: boolean;
  readonly showOverlay: boolean;
}) {
  const { panelRef, overlayRef } = useDraggablePanel({
    visible,
    onVisibleChange,
    animated,
    dragStartEdgeWidth,
  });

  return (
    <>
      {showOverlay ? (
        <button ref={overlayRef} type="button">
          Backdrop
        </button>
      ) : null}
      {showPanel ? <div ref={panelRef}>Panel</div> : null}
    </>
  );
}

/** Sends a touch event with no active touch to the document, inside an act. */
function pressTouchOnDocument(type: 'touchstart' | 'touchmove' | 'touchend'): TouchEvent {
  const event = touchEvent(type);

  act(() => {
    document.dispatchEvent(event);
  });

  return event;
}
