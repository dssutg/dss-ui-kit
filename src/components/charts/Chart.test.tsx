// @vitest-environment jsdom
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Chart,
  type ChartProps,
  chartPosToCanvasRelative,
  formatChartHSL,
  getDefaultCanvasTransform,
  type PlotFunctionRangeOptions,
} from '@/components/charts/Chart';
import { render } from '@/util/testing/render';

/**
 * The global context classes jsdom does not define.
 *
 * `Chart` decides how to draw by `instanceof CanvasRenderingContext2D`, and jsdom leaves that name
 * undefined, so a truthy context would make the component throw on a name that is not there. The
 * classes are installed for the test and a fake context built from them is what the canvas hands
 * back.
 */
class FakeContext2D {
  public readonly canvas = { width: 200, height: 200 };
  public fillStyle = '';
  public strokeStyle = '';
  public lineWidth = 0;
  public readonly save = vi.fn();
  public readonly restore = vi.fn();
  public readonly setTransform = vi.fn();
  public readonly clearRect = vi.fn();
  public readonly beginPath = vi.fn();
  public readonly arc = vi.fn();
  public readonly fill = vi.fn();
  public readonly moveTo = vi.fn();
  public readonly lineTo = vi.fn();
  public readonly stroke = vi.fn();
}

class FakeWebGLContext {
  public readonly COLOR_BUFFER_BIT = 0x4000;
  public readonly clearColor = vi.fn();
  public readonly clear = vi.fn();
}

let savedCanvasContext: PropertyDescriptor | undefined;
let savedWebGLContext: PropertyDescriptor | undefined;

beforeEach(() => {
  savedCanvasContext = Object.getOwnPropertyDescriptor(globalThis, 'CanvasRenderingContext2D');
  savedWebGLContext = Object.getOwnPropertyDescriptor(globalThis, 'WebGLRenderingContext');

  Object.defineProperty(globalThis, 'CanvasRenderingContext2D', {
    configurable: true,
    writable: true,
    value: FakeContext2D,
  });
  Object.defineProperty(globalThis, 'WebGLRenderingContext', {
    configurable: true,
    writable: true,
    value: FakeWebGLContext,
  });
});

afterEach(() => {
  if (savedCanvasContext !== undefined) {
    Object.defineProperty(globalThis, 'CanvasRenderingContext2D', savedCanvasContext);
  }

  if (savedWebGLContext !== undefined) {
    Object.defineProperty(globalThis, 'WebGLRenderingContext', savedWebGLContext);
  }

  vi.restoreAllMocks();
});

/** Answers every canvas `getContext` with `answer`, and restores the original after each test. */
function stubGetContext(answer: (contextId: string) => unknown): void {
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

const noop = () => undefined;

/** The props {@link Chart} needs that a test rarely cares about, with the caller's overrides on top. */
function chartProps(overrides: Partial<ChartProps> = {}): ChartProps {
  return {
    chartRef: createRef<HTMLDivElement>(),
    canvasRef: createRef<HTMLCanvasElement>(),
    canvasTransform: getDefaultCanvasTransform(),
    onTransformChange: noop,
    functionsToPlot: [],
    gridVisible: false,
    setGridVisible: noop,
    posLabelsVisible: false,
    setPosLabelsVisible: noop,
    zoomIn: noop,
    zoomOut: noop,
    resetCanvasTransform: noop,
    isFullscreen: false,
    toggleFullscreen: noop,
    seekStart: noop,
    seekEnd: noop,
    getXLabel: () => '',
    getYLabel: () => '',
    ...overrides,
  };
}

describe('Chart helpers', () => {
  it('writes a hue as the CSS a canvas fillStyle takes', () => {
    expect(formatChartHSL([120, 50, 50])).toBe('hsl(120 50% 50%)');
  });

  it('starts a chart unscaled and unpanned', () => {
    expect(getDefaultCanvasTransform()).toEqual({ scale: 1, offsetX: 0, offsetY: 0 });
  });

  it('places a point of chart space on the canvas, with y flipped and the scale applied', () => {
    const transform = { scale: 2, offsetX: 5, offsetY: 7 };

    expect(chartPosToCanvasRelative(transform, 100, 10, 20)).toEqual({ x: 25, y: 100 - 40 + 7 });
  });
});

describe('Chart', () => {
  it('clears the canvas and draws each series as markers and as a line', async () => {
    const context = new FakeContext2D();

    stubGetContext((contextId) => (contextId === '2d' ? context : null));

    const functionsToPlot: PlotFunctionRangeOptions[] = [
      {
        type: 'point',
        color: '#f00',
        pointSize: 4,
        getPointY: (x) => (x === 1 ? undefined : x),
      },
      {
        type: 'line',
        color: undefined,
        getPointY: (x) => (x === 1 ? undefined : x),
      },
      {
        type: undefined,
        color: '#0f0',
        getPointY: (x) => x,
      },
    ];

    await render(<Chart {...chartProps({ functionsToPlot })} />);

    expect(context.setTransform).toHaveBeenCalled();
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 200, 200);
    expect(context.arc).toHaveBeenCalled();
    expect(context.stroke).toHaveBeenCalled();
    expect(context.fill).toHaveBeenCalled();
    expect(context.moveTo).toHaveBeenCalled();
    expect(context.lineTo).toHaveBeenCalled();
  });

  it('draws nothing but a clear when there are no series', async () => {
    const context = new FakeContext2D();

    stubGetContext((contextId) => (contextId === '2d' ? context : null));

    await render(<Chart {...chartProps()} />);

    expect(context.clearRect).toHaveBeenCalled();
    expect(context.arc).not.toHaveBeenCalled();
    expect(context.stroke).not.toHaveBeenCalled();
  });

  it('does not draw into a context that is not a 2d context', async () => {
    const context = new FakeWebGLContext();

    stubGetContext(() => context);

    await render(
      <Chart
        {...chartProps({
          functionsToPlot: [{ type: 'point', color: '#f00', getPointY: (x) => x }],
        })}
      />,
    );

    expect(context.clearColor).toHaveBeenCalledWith(0, 0, 0, 1);
  });

  it('labels the rows and columns it can fit, and skips the ones with no label', async () => {
    stubGetContext((contextId) => (contextId === '2d' ? new FakeContext2D() : null));

    const { find, findByText } = await render(
      <Chart
        {...chartProps({
          posLabelsVisible: true,
          getXLabel: (x) => (x === 0 ? '' : `x${x}`),
          getYLabel: (y) => (y === 0 ? '' : `y${y}`),
        })}
      />,
    );

    expect(find('fieldset').getAttribute('aria-label')).toBe('Chart axis labels');
    expect(findByText('x3')).toBeDefined();
    expect(findByText('y2')).toBeDefined();
  });

  it('renders no labels while they are hidden', async () => {
    stubGetContext((contextId) => (contextId === '2d' ? new FakeContext2D() : null));

    const { query } = await render(<Chart {...chartProps({ posLabelsVisible: false })} />);

    expect(query('fieldset')).toBeNull();
  });
});
