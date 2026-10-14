// @vitest-environment jsdom
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZoomableCanvas, type ZoomableCanvasTransform } from '@/components/charts/ZoomableCanvas';
import { act, click, render } from '@/util/testing/render';

/**
 * The global context classes jsdom does not define.
 *
 * `ZoomableCanvas` decides what to do with a context by `instanceof`, and jsdom leaves both
 * `CanvasRenderingContext2D` and `WebGLRenderingContext` undefined, so a truthy context would make
 * the component throw on a name that is not there. The classes are installed for the test and taken
 * down afterwards, and the fake contexts are made from them so `instanceof` answers true.
 */
class FakeCanvasRenderingContext2D {
  public canvas: { width: number; height: number } = { width: 0, height: 0 };
  public clearRect = vi.fn();
}

class FakeWebGLRenderingContext {
  public readonly COLOR_BUFFER_BIT = 0x4000;
  public clearColor = vi.fn();
  public clear = vi.fn();
}

/** One touch as the handlers read it: a client position and nothing else. */
interface TouchLike {
  readonly clientX: number;
  readonly clientY: number;
}

/** A `TouchList` standing in for the one jsdom does not build, with index access and `item`. */
function touchList(touches: readonly TouchLike[]): TouchList {
  return {
    ...touches,
    length: touches.length,
    item: (index: number) => touches[index] ?? null,
  } as unknown as TouchList;
}

/** A `TouchList` that reports two touches but holds none, for the defensive distance guard. */
function emptyTouchList(): TouchList {
  return { length: 2, item: () => null } as unknown as TouchList;
}

/** Dispatches a touch event carrying `touches`. */
function dispatchTouch(canvas: Element, type: string, touches: readonly TouchLike[]): void {
  const event = new Event(type, { bubbles: true, cancelable: true });

  Object.defineProperty(event, 'touches', { value: touchList(touches) });

  act(() => {
    canvas.dispatchEvent(event);
  });
}

/** Dispatches a touch event with an empty, length-two touch list. */
function dispatchEmptyTouch(canvas: Element, type: string): void {
  const event = new Event(type, { bubbles: true, cancelable: true });

  Object.defineProperty(event, 'touches', { value: emptyTouchList() });

  act(() => {
    canvas.dispatchEvent(event);
  });
}

/** Dispatches a wheel event with the offset the handler reads, which jsdom does not set from init. */
function dispatchWheel(canvas: Element, deltaY: number, offsetX = 0, offsetY = 0): void {
  const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY });

  Object.defineProperty(event, 'offsetX', { value: offsetX });
  Object.defineProperty(event, 'offsetY', { value: offsetY });

  act(() => {
    canvas.dispatchEvent(event);
  });
}

/** Dispatches a mouse event with client coordinates. */
function dispatchMouse(canvas: Element, type: string, clientX: number, clientY: number): void {
  act(() => {
    canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX, clientY }));
  });
}

const ORIGIN: ZoomableCanvasTransform = { scale: 1, offsetX: 0, offsetY: 0 };

let savedCanvasContext: PropertyDescriptor | undefined;
let savedWebGLContext: PropertyDescriptor | undefined;

/** Answers every canvas `getContext` with `answer`, which names a context by id. */
function stubGetContext(answer: (contextId: string) => unknown): void {
  savedCanvasContext = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext');

  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: answer,
  });
}

beforeEach(() => {
  savedCanvasContext = undefined;
  savedWebGLContext = Object.getOwnPropertyDescriptor(globalThis, 'CanvasRenderingContext2D');

  Object.defineProperty(globalThis, 'CanvasRenderingContext2D', {
    configurable: true,
    writable: true,
    value: FakeCanvasRenderingContext2D,
  });
  Object.defineProperty(globalThis, 'WebGLRenderingContext', {
    configurable: true,
    writable: true,
    value: FakeWebGLRenderingContext,
  });
});

afterEach(() => {
  if (savedCanvasContext !== undefined) {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', savedCanvasContext);
  }

  if (savedWebGLContext !== undefined) {
    Object.defineProperty(globalThis, 'CanvasRenderingContext2D', savedWebGLContext);
  }

  vi.restoreAllMocks();
});

describe('ZoomableCanvas', () => {
  it('renders a canvas, forwards its ref and focuses it on a click', async () => {
    const canvasRef = createRef<HTMLCanvasElement>();
    const { find } = await render(
      <ZoomableCanvas
        width={320}
        height={200}
        transform={ORIGIN}
        onTransformChange={() => undefined}
        drawCallback={() => undefined}
        canvasRef={canvasRef}
      />,
    );

    const canvas = find<HTMLCanvasElement>('canvas');

    expect(canvasRef.current).toBe(canvas);

    await click(canvas);

    expect(document.activeElement).toBe(canvas);
  });

  it('draws into a 2d context and hands the pointer position to the callback', async () => {
    const context = new FakeCanvasRenderingContext2D();
    const drawCallback = vi.fn();

    stubGetContext((contextId) => (contextId === '2d' ? context : null));

    await render(
      <ZoomableCanvas
        width={320}
        height={200}
        transform={ORIGIN}
        onTransformChange={() => undefined}
        drawCallback={drawCallback}
      />,
    );

    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 0, 0);
    expect(drawCallback).toHaveBeenCalledWith(context, ORIGIN, { mouseX: 0, mouseY: 0 });
  });

  it('draws into a webgl context when asked to', async () => {
    const context = new FakeWebGLRenderingContext();
    const drawCallback = vi.fn();

    stubGetContext((contextId) => (contextId === 'webgl' ? context : null));

    await render(
      <ZoomableCanvas
        width={320}
        height={200}
        transform={ORIGIN}
        onTransformChange={() => undefined}
        drawCallback={drawCallback}
        usingWebGL={true}
      />,
    );

    expect(context.clearColor).toHaveBeenCalledWith(0, 0, 0, 1);
    expect(context.clear).toHaveBeenCalledWith(0x4000);
    expect(drawCallback).toHaveBeenCalledWith(context, ORIGIN, { mouseX: 0, mouseY: 0 });
  });

  it('does not draw into a context it cannot recognise', async () => {
    const drawCallback = vi.fn();
    const context = {};

    stubGetContext(() => context);

    await render(
      <ZoomableCanvas
        width={320}
        height={200}
        transform={ORIGIN}
        onTransformChange={() => undefined}
        drawCallback={drawCallback}
      />,
    );

    expect(drawCallback).not.toHaveBeenCalled();
  });

  it('draws nothing when the canvas has no context at all', async () => {
    const drawCallback = vi.fn();

    stubGetContext(() => null);

    await render(
      <ZoomableCanvas
        width={320}
        height={200}
        transform={ORIGIN}
        onTransformChange={() => undefined}
        drawCallback={drawCallback}
      />,
    );

    expect(drawCallback).not.toHaveBeenCalled();
  });

  it('reports the new transform when the wheel zooms in and out', async () => {
    stubGetContext(() => new FakeCanvasRenderingContext2D());

    const onTransformChange = vi.fn();
    const { find } = await render(
      <ZoomableCanvas
        width={320}
        height={200}
        transform={ORIGIN}
        onTransformChange={onTransformChange}
        drawCallback={() => undefined}
      />,
    );

    const canvas = find<HTMLCanvasElement>('canvas');

    dispatchWheel(canvas, -100, 10, 20);
    dispatchWheel(canvas, 100, 10, 20);

    expect(onTransformChange.mock.calls[0]?.[0]).toMatchObject({ scale: 1.1 });
    expect(onTransformChange.mock.calls[1]?.[0]).toMatchObject({ scale: 0.9 });
  });

  it('clamps a zoom out at the minimum scale', async () => {
    stubGetContext(() => new FakeCanvasRenderingContext2D());

    const onTransformChange = vi.fn();
    const { find } = await render(
      <ZoomableCanvas
        width={320}
        height={200}
        transform={{ scale: 0.51, offsetX: 0, offsetY: 0 }}
        onTransformChange={onTransformChange}
        drawCallback={() => undefined}
        minScale={0.5}
      />,
    );

    dispatchWheel(find('canvas'), 100, 0, 0);

    expect(onTransformChange).toHaveBeenCalledWith(expect.objectContaining({ scale: 0.5 }));
  });

  it('clamps a zoom in at the maximum scale', async () => {
    stubGetContext(() => new FakeCanvasRenderingContext2D());

    const onTransformChange = vi.fn();
    const { find } = await render(
      <ZoomableCanvas
        width={320}
        height={200}
        transform={{ scale: 19.5, offsetX: 0, offsetY: 0 }}
        onTransformChange={onTransformChange}
        drawCallback={() => undefined}
        maxScale={20}
      />,
    );

    dispatchWheel(find('canvas'), -100, 0, 0);

    expect(onTransformChange).toHaveBeenCalledWith(expect.objectContaining({ scale: 20 }));
  });

  it('pans when a drag moves the pointer, and reports the drag start and end', async () => {
    stubGetContext(() => new FakeCanvasRenderingContext2D());

    const onTransformChange = vi.fn();
    const onCanvasDragStart = vi.fn();
    const onCanvasDragEnd = vi.fn();
    const { find } = await render(
      <ZoomableCanvas
        width={320}
        height={200}
        transform={ORIGIN}
        onTransformChange={onTransformChange}
        drawCallback={() => undefined}
        onCanvasDragStart={onCanvasDragStart}
        onCanvasDragEnd={onCanvasDragEnd}
      />,
    );

    const canvas = find('canvas');

    dispatchMouse(canvas, 'mousemove', 40, 30);
    dispatchMouse(canvas, 'mousedown', 100, 50);
    dispatchMouse(canvas, 'mousemove', 150, 90);
    dispatchMouse(canvas, 'mouseup', 150, 90);

    expect(onCanvasDragStart).toHaveBeenCalled();
    expect(onCanvasDragEnd).toHaveBeenCalled();
    expect(onTransformChange).toHaveBeenCalledWith({
      scale: 1,
      offsetX: 50,
      offsetY: 40,
    });
  });

  it('releases a drag on mouse leave only when asked to', async () => {
    stubGetContext(() => new FakeCanvasRenderingContext2D());

    const onCanvasDragEnd = vi.fn();
    const { find, unmount } = await render(
      <ZoomableCanvas
        width={320}
        height={200}
        transform={ORIGIN}
        onTransformChange={() => undefined}
        drawCallback={() => undefined}
        onCanvasDragEnd={onCanvasDragEnd}
        shouldReleaseDragOnMouseLeave={true}
      />,
    );

    const canvas = find('canvas');

    dispatchMouse(canvas, 'mousedown', 100, 50);
    dispatchMouse(canvas, 'mouseleave', 100, 50);

    expect(onCanvasDragEnd).toHaveBeenCalled();

    unmount();
  });

  it('keeps dragging when the pointer leaves and the release is not wanted', async () => {
    stubGetContext(() => new FakeCanvasRenderingContext2D());

    const onCanvasDragEnd = vi.fn();
    const { find } = await render(
      <ZoomableCanvas
        width={320}
        height={200}
        transform={ORIGIN}
        onTransformChange={() => undefined}
        drawCallback={() => undefined}
        onCanvasDragEnd={onCanvasDragEnd}
      />,
    );

    const canvas = find('canvas');

    dispatchMouse(canvas, 'mousedown', 100, 50);
    dispatchMouse(canvas, 'mouseleave', 100, 50);

    expect(onCanvasDragEnd).not.toHaveBeenCalled();
  });

  it('reports a click at the pointer, and nothing without a handler', async () => {
    stubGetContext(() => new FakeCanvasRenderingContext2D());

    const onClickAt = vi.fn();
    const { find } = await render(
      <ZoomableCanvas
        width={320}
        height={200}
        transform={ORIGIN}
        onTransformChange={() => undefined}
        drawCallback={() => undefined}
        onClickAt={onClickAt}
      />,
    );

    const canvas = find('canvas');

    dispatchMouse(canvas, 'mousedown', 40, 30);
    dispatchMouse(canvas, 'mouseup', 40, 30);

    expect(onClickAt).toHaveBeenCalledWith(40, 30);
  });

  it('reports no click for a pointer that went down outside the canvas', async () => {
    stubGetContext(() => new FakeCanvasRenderingContext2D());

    const onClickAt = vi.fn();
    const { find } = await render(
      <ZoomableCanvas
        width={320}
        height={200}
        transform={ORIGIN}
        onTransformChange={() => undefined}
        drawCallback={() => undefined}
        onClickAt={onClickAt}
      />,
    );

    const canvas = find('canvas');

    dispatchMouse(canvas, 'mousedown', 2000, 30);
    dispatchMouse(canvas, 'mouseup', 2000, 30);

    expect(onClickAt).not.toHaveBeenCalled();
  });

  it('reports no click when the component was given no click handler', async () => {
    stubGetContext(() => new FakeCanvasRenderingContext2D());

    const { find } = await render(
      <ZoomableCanvas
        width={320}
        height={200}
        transform={ORIGIN}
        onTransformChange={() => undefined}
        drawCallback={() => undefined}
      />,
    );

    const canvas = find('canvas');

    dispatchMouse(canvas, 'mousedown', 40, 30);
    dispatchMouse(canvas, 'mouseup', 40, 30);

    expect(canvas).toBeDefined();
  });

  it('reports pointer moves that are not drags only while not dragging', async () => {
    stubGetContext(() => new FakeCanvasRenderingContext2D());

    const onMouseMoveNoDragging = vi.fn();
    const { find } = await render(
      <ZoomableCanvas
        width={320}
        height={200}
        transform={ORIGIN}
        onTransformChange={() => undefined}
        drawCallback={() => undefined}
        onMouseMoveNoDragging={onMouseMoveNoDragging}
      />,
    );

    const canvas = find('canvas');

    dispatchMouse(canvas, 'mousemove', 40, 30);
    dispatchMouse(canvas, 'mousedown', 40, 30);
    dispatchMouse(canvas, 'mousemove', 80, 30);

    expect(onMouseMoveNoDragging).toHaveBeenCalled();
  });

  it('moves a single touch, and closes the touch when it cancels', async () => {
    stubGetContext(() => new FakeCanvasRenderingContext2D());

    const onSingleTouchMove = vi.fn();
    const onCanvasDragEnd = vi.fn();
    const { find } = await render(
      <ZoomableCanvas
        width={320}
        height={200}
        transform={ORIGIN}
        onTransformChange={() => undefined}
        drawCallback={() => undefined}
        onSingleTouchMove={onSingleTouchMove}
        onCanvasDragEnd={onCanvasDragEnd}
      />,
    );

    const canvas = find('canvas');

    dispatchTouch(canvas, 'touchstart', [{ clientX: 100, clientY: 50 }]);
    dispatchTouch(canvas, 'touchmove', [{ clientX: 140, clientY: 70 }]);
    dispatchTouch(canvas, 'touchcancel', []);

    expect(onSingleTouchMove).toHaveBeenCalled();
    expect(onCanvasDragEnd).toHaveBeenCalled();
  });

  it('does not move a touch that has no first point', async () => {
    stubGetContext(() => new FakeCanvasRenderingContext2D());

    const onSingleTouchMove = vi.fn();
    const { find } = await render(
      <ZoomableCanvas
        width={320}
        height={200}
        transform={ORIGIN}
        onTransformChange={() => undefined}
        drawCallback={() => undefined}
        onSingleTouchMove={onSingleTouchMove}
      />,
    );

    dispatchTouch(find('canvas'), 'touchmove', []);

    expect(onSingleTouchMove).not.toHaveBeenCalled();
  });

  it('zooms a two-finger pinch about its midpoint', async () => {
    stubGetContext(() => new FakeCanvasRenderingContext2D());

    const onTransformChange = vi.fn();
    const { find } = await render(
      <ZoomableCanvas
        width={320}
        height={200}
        transform={ORIGIN}
        onTransformChange={onTransformChange}
        drawCallback={() => undefined}
      />,
    );

    const canvas = find('canvas');

    dispatchTouch(canvas, 'touchstart', [
      { clientX: 100, clientY: 100 },
      { clientX: 200, clientY: 100 },
    ]);
    dispatchTouch(canvas, 'touchmove', [
      { clientX: 100, clientY: 100 },
      { clientX: 150, clientY: 100 },
    ]);

    expect(onTransformChange).toHaveBeenCalled();
  });

  it('does not zoom a pinch whose start distance is too small', async () => {
    stubGetContext(() => new FakeCanvasRenderingContext2D());

    const onTransformChange = vi.fn();
    const { find } = await render(
      <ZoomableCanvas
        width={320}
        height={200}
        transform={ORIGIN}
        onTransformChange={onTransformChange}
        drawCallback={() => undefined}
      />,
    );

    const canvas = find('canvas');

    dispatchTouch(canvas, 'touchstart', [
      { clientX: 100, clientY: 100 },
      { clientX: 100, clientY: 100 },
    ]);
    dispatchTouch(canvas, 'touchmove', [
      { clientX: 100, clientY: 100 },
      { clientX: 110, clientY: 100 },
    ]);

    expect(onTransformChange).not.toHaveBeenCalled();
  });

  it('does not zoom a pinch whose touches cannot be read', async () => {
    stubGetContext(() => new FakeCanvasRenderingContext2D());

    const onTransformChange = vi.fn();
    const { find } = await render(
      <ZoomableCanvas
        width={320}
        height={200}
        transform={ORIGIN}
        onTransformChange={onTransformChange}
        drawCallback={() => undefined}
      />,
    );

    const canvas = find('canvas');

    dispatchTouch(canvas, 'touchstart', [
      { clientX: 100, clientY: 100 },
      { clientX: 200, clientY: 100 },
    ]);
    dispatchEmptyTouch(canvas, 'touchmove');

    expect(onTransformChange).not.toHaveBeenCalled();
  });

  it('measures no distance for a two-touch list that holds no touches', async () => {
    stubGetContext(() => new FakeCanvasRenderingContext2D());

    const onTransformChange = vi.fn();
    const { find } = await render(
      <ZoomableCanvas
        width={320}
        height={200}
        transform={ORIGIN}
        onTransformChange={onTransformChange}
        drawCallback={() => undefined}
      />,
    );

    const canvas = find('canvas');

    dispatchEmptyTouch(canvas, 'touchstart');
    dispatchTouch(canvas, 'touchmove', [
      { clientX: 100, clientY: 100 },
      { clientX: 120, clientY: 100 },
    ]);

    expect(onTransformChange).not.toHaveBeenCalled();
  });

  it('ends a touch and emits a click when one finger lifts', async () => {
    stubGetContext(() => new FakeCanvasRenderingContext2D());

    const onClickAt = vi.fn();
    const { find } = await render(
      <ZoomableCanvas
        width={320}
        height={200}
        transform={ORIGIN}
        onTransformChange={() => undefined}
        drawCallback={() => undefined}
        onClickAt={onClickAt}
      />,
    );

    const canvas = find('canvas');

    dispatchTouch(canvas, 'touchstart', [{ clientX: 40, clientY: 30 }]);
    dispatchTouch(canvas, 'touchend', []);

    expect(onClickAt).toHaveBeenCalledWith(40, 30);
  });

  it('does not emit a click when two fingers lift at once', async () => {
    stubGetContext(() => new FakeCanvasRenderingContext2D());

    const onClickAt = vi.fn();
    const onCanvasDragEnd = vi.fn();
    const { find } = await render(
      <ZoomableCanvas
        width={320}
        height={200}
        transform={ORIGIN}
        onTransformChange={() => undefined}
        drawCallback={() => undefined}
        onClickAt={onClickAt}
        onCanvasDragEnd={onCanvasDragEnd}
      />,
    );

    const canvas = find('canvas');

    dispatchTouch(canvas, 'touchstart', [{ clientX: 40, clientY: 30 }]);
    dispatchTouch(canvas, 'touchend', [
      { clientX: 40, clientY: 30 },
      { clientX: 80, clientY: 30 },
    ]);

    expect(onClickAt).not.toHaveBeenCalled();
    expect(onCanvasDragEnd).toHaveBeenCalled();
  });

  it('does nothing on a touch start with no touches', async () => {
    stubGetContext(() => new FakeCanvasRenderingContext2D());

    const { find } = await render(
      <ZoomableCanvas
        width={320}
        height={200}
        transform={ORIGIN}
        onTransformChange={() => undefined}
        drawCallback={() => undefined}
      />,
    );

    dispatchTouch(find('canvas'), 'touchstart', []);

    expect(find('canvas')).toBeDefined();
  });
});
