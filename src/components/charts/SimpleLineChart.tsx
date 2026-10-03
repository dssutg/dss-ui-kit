import { useRef } from 'react';
import { AutoSizer } from '@/components/layout/AutoSizer';
import { getCSSVariableValue } from '@/lib/color';
import { clamp } from '@/lib/math';
import { useGranularEffect } from '@/lib/use_granular_effect';
import { useTheme } from '@/theme';

/**
 * A line chart of one or more series, drawn on a {@link ZoomableCanvas}.
 *
 * The series are the caller's numbers; the chart scales them to the box and draws them. There is no
 * data source, no sampling and no downsampling: a series with a point per pixel is the caller's to
 * reduce, because what to drop from a signal is a decision about the signal.
 */
export function SimpleLineChart({
  yPoints,
  color,
  gridColor,
  xScale = 1,
  gridCellWidth = 0,
  gridCellHeight = 0,
  className,
  style,
}: {
  readonly yPoints: number[];
  readonly color?: string | undefined;
  readonly gridColor?: string | undefined;
  readonly xScale?: number | undefined;
  readonly gridCellWidth?: number | undefined;
  readonly gridCellHeight?: number | undefined;
  readonly className?: string | undefined;
  readonly style?: React.CSSProperties | undefined;
}) {
  useTheme();

  return (
    <div className={className} style={style}>
      <AutoSizer style={{ flexGrow: 1 }}>
        {({ width, height }) => (
          <Canvas
            yPoints={yPoints}
            xScale={xScale}
            gridCellWidth={gridCellWidth}
            gridCellHeight={gridCellHeight}
            color={color ?? getCSSVariableValue('color-tok')}
            gridColor={gridColor ?? getCSSVariableValue('color-bsp')}
            width={width}
            height={height}
          />
        )}
      </AutoSizer>
    </div>
  );
}

/**
 * The pixel size of one grid cell along an axis, worked out from the requested cell size.
 *
 * A request of 1 or less is the fraction of the axis to fit into it and anything above 1 is
 * already a pixel count; a negative request asks for no grid on that axis.
 */
function getCellPixelSize(cellSize: number, maxSize: number): number {
  if (cellSize < 0) {
    return 0;
  }

  if (cellSize <= 1) {
    return clamp(cellSize * maxSize, 0, maxSize);
  }

  return clamp(cellSize, 0, maxSize);
}

/**
 * Vertical grid lines, plus the one flush against the right edge: the lines are spaced in whole
 * cells from the left, so a canvas that is not a whole number of cells wide leaves a gap there.
 */
function drawVerticalGridLines(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  cellWidth: number,
): void {
  if (cellWidth <= 0) {
    return;
  }

  for (let x = 0; x < width; x += cellWidth) {
    context.moveTo(x, 0);
    context.lineTo(x, height);
  }

  context.moveTo(width - 1, 0);
  context.lineTo(width - 1, height);
}

/**
 * Horizontal grid lines, plus the one flush against the bottom edge, left by the same whole-cell
 * spacing along the other axis.
 */
function drawHorizontalGridLines(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  cellHeight: number,
): void {
  if (cellHeight <= 0) {
    return;
  }

  for (let y = 0; y < height; y += cellHeight) {
    context.moveTo(0, y);
    context.lineTo(width, y);
  }

  context.moveTo(0, height - 1);
  context.lineTo(width, height - 1);
}

/**
 * The grid, drawn as one path in a single stroke so both directions share a colour and a width.
 * `gridCellWidth` and `gridCellHeight` are requests rather than pixels, read against the canvas
 * size here because the same chart is redrawn at whatever size it is given.
 */
function drawGrid(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  gridColor: string,
  gridCellWidth: number,
  gridCellHeight: number,
): void {
  context.strokeStyle = gridColor;
  context.beginPath();

  drawVerticalGridLines(context, width, height, getCellPixelSize(gridCellWidth, width));
  drawHorizontalGridLines(context, width, height, getCellPixelSize(gridCellHeight, height));

  context.stroke();
}

/**
 * The series, drawn right to left: the walk starts at the newest point and stops once it passes the
 * left edge, so a series wider than the canvas is panned by `xOffset` rather than drawing the
 * points the caller cannot see.
 */
function drawSeries(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: string,
  yPoints: readonly number[],
  xScale: number,
): void {
  context.strokeStyle = color;
  context.beginPath();

  const xOffset = Math.max(0, yPoints.length * xScale - width);

  for (let x = yPoints.length - 1; x >= 0; x--) {
    const y = yPoints[x];

    // A hole in the series is skipped rather than drawn as a point at the baseline: the line
    // should break where the data does, not invent a value to bridge the gap.
    if (y === undefined) {
      continue;
    }

    const xp = x * xScale - xOffset;
    const yp = (1 - clamp(y, 0, 1)) * height;

    context.lineTo(xp, yp);

    if (xp < 0) {
      break;
    }
  }

  context.stroke();
}

function Canvas({
  yPoints,
  xScale,
  gridCellWidth,
  gridCellHeight,
  color,
  gridColor,
  width,
  height,
}: {
  readonly yPoints: number[];
  readonly xScale: number;
  readonly gridCellWidth: number;
  readonly gridCellHeight: number;
  readonly color: string;
  readonly gridColor: string;
  readonly width: number;
  readonly height: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useGranularEffect(
    () => {
      const canvas = canvasRef.current;

      if (canvas === null) {
        return;
      }

      const context = canvas.getContext('2d');

      if (context === null) {
        return;
      }

      const { width, height } = canvas;

      context.clearRect(0, 0, width, height);

      drawGrid(context, width, height, gridColor, gridCellWidth, gridCellHeight);
      drawSeries(context, width, height, color, yPoints, xScale);
    },
    [yPoints, xScale, gridCellWidth, gridCellHeight, color, gridColor, width, height],
    [],
  );

  return <canvas ref={canvasRef} width={width} height={height} />;
}
