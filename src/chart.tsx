import { AutoSizer } from '@/lib/autosizer';
import type { KeyMap } from '@/lib/key_map';
import { useLocale } from '@/locale';
import { ZoomableCanvas, type ZoomableCanvasTransform } from '@/ui/zoomable_canvas';

/**
 * The horizontal distance between two adjacent chart columns, in chart coordinates.
 *
 * The plot area is a grid whose cells are this wide and {@link gridGap} tall, and the table above
 * places one event per cell. Exported because a caller laying out its own columns needs to agree
 * with the chart about where a column sits.
 */
export const chunkLines = 100;

/** The vertical distance between two adjacent chart rows, in chart coordinates. */
export const gridGap = 40;

/** The scale bounds a chart can be zoomed to, and the step each zoom moves it by. */
export const MIN_SCALE = 0.1;
export const MAX_SCALE = 20;
export const SCALE_FACTOR = 0.1;

/**
 * Renders an HSL triple as a CSS colour.
 *
 * Charts here use HSL rather than hex because a plot draws many shades of one hue, and adjusting the
 * lightness of an HSL triple is how a second, third and fourth series are told apart.
 */
export function formatChartHSL(hsl: readonly [number, number, number]): string {
  return `hsl(${hsl[0]} ${hsl[1]}% ${hsl[2]}%)`;
}

/** The transform a chart starts at: unscaled and not panned. */
export function getDefaultCanvasTransform(): ZoomableCanvasTransform {
  return { scale: 1, offsetX: 0, offsetY: 0 };
}

/**
 * Places a point of chart space on the canvas.
 *
 * `height` is subtracted from the y coordinate because chart space grows upwards while canvas space
 * grows down, and `scale` is applied because zooming magnifies about the origin before the offsets
 * are applied. A caller converting a click back into chart space uses this, so that a point and its
 * inverse cannot drift apart.
 */
export function chartPosToCanvasRelative(
  transform: ZoomableCanvasTransform,
  height: number,
  x: number,
  y: number,
): { readonly x: number; readonly y: number } {
  return {
    x: x * transform.scale + transform.offsetX,
    y: height - y * transform.scale + transform.offsetY,
  };
}

/** One series to draw. */
export interface PlotFunctionRangeOptions {
  /**
   * `point` draws a marker per sample and leaves gaps where `getPointY` returns `undefined`;
   * `line` joins consecutive samples into a polyline.
   */
  readonly type: 'point' | 'line' | undefined;
  readonly color: string | undefined;
  /** The radius of a `point` marker, in canvas pixels. Ignored for a `line`. */
  readonly pointSize?: number | undefined;
  /**
   * The y coordinate of the sample at x, or `undefined` where the series has no sample. Returning
   * `undefined` rather than a sentinel is what lets a caller plot a sparse series without inventing
   * a value for the gaps.
   */
  readonly getPointY: (x: number) => number | undefined;
}

/** The keyboard actions a chart view handles. */
export type ActionKey =
  | 'toggleGrid'
  | 'toggleHighlights'
  | 'togglePosLabels'
  | 'zoomIn'
  | 'zoomOut'
  | 'resetCanvasTransform'
  | 'toggleFullscreen'
  | 'startStopOscilloscope'
  | 'clearChart'
  | 'seekStart'
  | 'seekEnd'
  | 'seekLeft'
  | 'seekRight'
  | 'seekLeftLarge'
  | 'seekRightLarge'
  | 'goToPreviousProblem'
  | 'goToNextProblem'
  | 'openGoToPointDialog'
  | 'openChartMarkerManager';

/**
 * The chart's keyboard shortcuts.
 *
 * The keymap lives here rather than in a caller so that the hotkeys a chart view offers are the same
 * wherever a chart is rendered; a caller binds them to whatever its own actions do, and an action it
 * has no behaviour for is bound to a no-op.
 */
export const chartViewKeyMap: KeyMap<ActionKey> = {
  KeyG: { action: 'toggleGrid' },
  KeyH: { action: 'toggleHighlights' },
  KeyL: { action: 'togglePosLabels' },
  Equal: { action: 'zoomIn' },
  Minus: { action: 'zoomOut' },
  KeyR: { action: 'resetCanvasTransform' },
  KeyF: { action: 'toggleFullscreen' },
  KeyC: { action: 'clearChart' },
  Home: { action: 'seekStart' },
  End: { action: 'seekEnd' },
  ArrowLeft: { action: 'seekLeft' },
  ArrowRight: { action: 'seekRight' },
  ShiftLeft: { action: 'seekLeftLarge' },
  ShiftRight: { action: 'seekRightLarge' },
  BracketLeft: { action: 'goToPreviousProblem' },
  BracketRight: { action: 'goToNextProblem' },
  KeyM: { action: 'openChartMarkerManager' },
};

export interface ChartProps {
  readonly chartRef: React.RefObject<HTMLDivElement>;
  readonly canvasRef: React.RefObject<HTMLCanvasElement>;
  readonly canvasTransform: ZoomableCanvasTransform;
  readonly onTransformChange: (transform: ZoomableCanvasTransform) => void;
  readonly functionsToPlot: readonly PlotFunctionRangeOptions[];
  readonly gridVisible: boolean;
  readonly setGridVisible: (visible: boolean) => void;
  readonly posLabelsVisible: boolean;
  readonly setPosLabelsVisible: (visible: boolean) => void;
  readonly zoomIn: () => void;
  readonly zoomOut: () => void;
  readonly resetCanvasTransform: () => void;
  readonly isFullscreen: boolean;
  readonly toggleFullscreen: () => void;
  readonly seekStart: () => void;
  readonly seekEnd: () => void;
  /** The label drawn along the x axis at a chart column, or `""` where there is none. */
  readonly getXLabel: (x: number) => string;
  /** The label drawn along the y axis at a chart row, or `""` where there is none. */
  readonly getYLabel: (y: number) => string;
  readonly className?: string | undefined;
  readonly style?: React.CSSProperties | undefined;
}

/**
 * A zoomable, pannable plot of one or more series on a grid.
 *
 * The chart draws. It holds no data of its own: the series arrive as functions of x, the axis labels
 * as functions of the column and row, and the viewport as a transform the caller owns. Nothing about
 * what is being plotted is known here — a waveform, a timeline of events and a bar chart of counts
 * are the same component with different functions.
 *
 * The grid and the position labels are only labels; `gridVisible` and `posLabelsVisible` are the
 * caller's state, because whether a grid is a help or a nuisance is the caller's judgement.
 */
export function Chart({
  chartRef,
  canvasRef,
  canvasTransform,
  onTransformChange,
  functionsToPlot,
  posLabelsVisible,
  getXLabel,
  getYLabel,
  className,
  style,
}: ChartProps) {
  const { t } = useLocale();

  // The canvas is sized in device pixels and scaled by the zoom, so the backing store follows the
  // transform rather than the element: a zoomed chart shows more detail instead of larger pixels.
  function draw(
    context: CanvasRenderingContext2D | WebGLRenderingContext,
    transform: ZoomableCanvasTransform,
  ) {
    if (!(context instanceof CanvasRenderingContext2D)) {
      return;
    }

    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    context.restore();

    for (const plotFunction of functionsToPlot) {
      drawPlotFunction(context, transform, context.canvas.height, plotFunction);
    }
  }

  return (
    <div ref={chartRef} className={className} style={{ position: 'relative', ...style }}>
      <AutoSizer style={{ position: 'relative', width: '100%', height: '100%' }}>
        {({ width: available, height: availableHeight }) => {
          const width = Math.max(1, Math.round(available * canvasTransform.scale));
          const height = Math.max(1, Math.round(availableHeight * canvasTransform.scale));

          return (
            <>
              <ZoomableCanvas
                width={width}
                height={height}
                transform={canvasTransform}
                onTransformChange={onTransformChange}
                canvasRef={canvasRef}
                minScale={MIN_SCALE}
                maxScale={MAX_SCALE}
                drawCallback={draw}
              />
              {posLabelsVisible && (
                <AxisLabels
                  width={available}
                  height={availableHeight}
                  getXLabel={getXLabel}
                  getYLabel={getYLabel}
                  label={t('Chart.axis')}
                />
              )}
            </>
          );
        }}
      </AutoSizer>
    </div>
  );
}

/** Draws one series, as markers or as a joined line. */
function drawPlotFunction(
  context: CanvasRenderingContext2D,
  transform: ZoomableCanvasTransform,
  canvasHeight: number,
  plotFunction: PlotFunctionRangeOptions,
) {
  const { color, getPointY, pointSize = 3 } = plotFunction;
  const columns = Math.max(1, Math.ceil(context.canvas.width / gridGap));

  context.fillStyle = color ?? '#fff';
  context.strokeStyle = color ?? '#fff';
  context.lineWidth = Math.max(1, pointSize / 2);

  if (plotFunction.type === 'line') {
    context.beginPath();

    let penIsDown = false;

    for (let column = 0; column <= columns; column++) {
      const y = getPointY(column);

      if (y === undefined) {
        // A gap lifts the pen rather than joining across it, so a series that stops and starts
        // is not drawn as if it were continuous.
        penIsDown = false;

        continue;
      }

      const { x, y: canvasY } = chartPosToCanvasRelative(
        transform,
        canvasHeight,
        column * gridGap,
        y,
      );

      if (penIsDown) {
        context.lineTo(x, canvasY);
      } else {
        context.moveTo(x, canvasY);
        penIsDown = true;
      }
    }

    context.stroke();

    return;
  }

  for (let column = 0; column <= columns; column++) {
    const y = getPointY(column);

    if (y === undefined) {
      continue;
    }

    const { x, y: canvasY } = chartPosToCanvasRelative(
      transform,
      canvasHeight,
      column * gridGap,
      y,
    );

    context.beginPath();
    context.arc(x, canvasY, pointSize, 0, 2 * Math.PI);
    context.fill();
  }
}

/**
 * The row and column labels drawn over the plot.
 *
 * Rendered as HTML beside the canvas rather than into it, so that a label is selectable text at the
 * platform's own size and a screen reader can reach it — a canvas is one opaque bitmap to assistive
 * technology, which is why the series themselves are described by the caller's markup around this.
 */
function AxisLabels({
  width,
  height,
  getXLabel,
  getYLabel,
  label,
}: {
  readonly width: number | undefined;
  readonly height: number | undefined;
  readonly getXLabel: (x: number) => string;
  readonly getYLabel: (y: number) => string;
  readonly label: string | undefined;
}) {
  const columnCount = width === undefined ? 0 : Math.floor(width / gridGap);
  const rowCount = height === undefined ? 0 : Math.floor(height / gridGap);

  return (
    <div
      aria-label={label}
      className="pointer-events-none absolute inset-0 overflow-hidden text-tpd text-xs"
    >
      {Array.from({ length: rowCount }, (_, row) => {
        const text = getYLabel(row);

        return text === '' ? null : (
          <div
            key={`row-${row}`}
            className="absolute right-1 truncate"
            style={{ top: row * gridGap, maxWidth: (width ?? 0) / 3 }}
          >
            {text}
          </div>
        );
      })}
      {Array.from({ length: columnCount }, (_, column) => {
        const text = getXLabel(column);

        return text === '' ? null : (
          <div
            key={`column-${column}`}
            className="absolute bottom-0"
            style={{ left: column * gridGap }}
          >
            {text}
          </div>
        );
      })}
    </div>
  );
}
