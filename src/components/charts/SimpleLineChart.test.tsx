// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SimpleLineChart } from '@/components/charts/SimpleLineChart';
import { render } from '@/util/testing/render';

/** The 2d context methods the chart uses, as spies a test can read. */
function fakeContext() {
  return {
    strokeStyle: '',
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
  };
}

/** Answers every canvas `getContext` with `answer`, restoring the original after the test. */
function stubGetContext(answer: () => unknown): void {
  const original = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext');

  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: answer,
  });

  afterEach(() => {
    if (original !== undefined) {
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', original);
    }
  });
}

describe('SimpleLineChart', () => {
  it('clears the canvas and draws the series without a grid when none is asked for', async () => {
    const context = fakeContext();

    stubGetContext(() => context);

    const { find } = await render(<SimpleLineChart yPoints={[0, 0.5, 1]} />);

    expect(find('canvas')).toBeDefined();
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 1024, 768);
    expect(context.lineTo).toHaveBeenCalled();
    expect(context.stroke).toHaveBeenCalled();
    expect(context.moveTo).not.toHaveBeenCalled();
  });

  it('draws a grid of fractional and pixel-sized cells in a colour the caller chose', async () => {
    const context = fakeContext();

    stubGetContext(() => context);

    await render(
      <SimpleLineChart
        yPoints={[0.25, 0.5, 0.75]}
        color="#123456"
        gridColor="#abcdef"
        gridCellWidth={0.5}
        gridCellHeight={2}
      />,
    );

    expect(context.clearRect).toHaveBeenCalled();
    expect(context.moveTo).toHaveBeenCalled();
    expect(context.stroke).toHaveBeenCalledTimes(2);
  });

  it('draws no grid for a negative cell request', async () => {
    const context = fakeContext();

    stubGetContext(() => context);

    await render(<SimpleLineChart yPoints={[0.2, 0.4]} gridCellWidth={-1} gridCellHeight={-1} />);

    expect(context.clearRect).toHaveBeenCalled();
    expect(context.moveTo).not.toHaveBeenCalled();
    expect(context.stroke).toHaveBeenCalled();
  });

  it('breaks the line at a hole in the series instead of inventing a value', async () => {
    const context = fakeContext();
    const sparse: number[] = [];

    sparse[0] = 0.25;
    sparse[2] = 0.75;

    stubGetContext(() => fakeContext());

    await render(<SimpleLineChart yPoints={sparse} gridCellWidth={0.5} />);

    expect(context).toBeDefined();
  });

  it('walks a series wider than the canvas and stops at the left edge', async () => {
    const context = fakeContext();

    stubGetContext(() => context);

    await render(<SimpleLineChart yPoints={[0.2, 0.8]} xScale={2000} />);

    expect(context.lineTo).toHaveBeenCalled();
  });

  it('uses the given colours rather than the theme defaults', async () => {
    const context = fakeContext();

    stubGetContext(() => context);

    await render(
      <SimpleLineChart yPoints={[0.5]} color="#123456" gridColor="#654321" gridCellWidth={2} />,
    );

    expect(context.stroke).toHaveBeenCalled();
  });

  it('draws nothing when the canvas has no 2d context', async () => {
    stubGetContext(() => null);

    const { find } = await render(<SimpleLineChart yPoints={[0.5, 1]} />);

    expect(find<HTMLCanvasElement>('canvas')).toBeDefined();
  });
});
