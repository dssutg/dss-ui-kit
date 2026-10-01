import { useRef } from 'react';
import { AutoSizer } from '@/lib/AutoSizer';
import { getCSSVariableValue } from '@/lib/color';
import { clamp } from '@/lib/math';
import { useGranularEffect } from '@/lib/use_granular_effect';
import { useTheme } from '@/theme';

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

      context.strokeStyle = gridColor;
      context.beginPath();

      function getCellPixelSize(cellSize: number, maxSize: number) {
        if (cellSize < 0) {
          return 0;
        }

        if (cellSize <= 1) {
          return clamp(cellSize * maxSize, 0, maxSize);
        }

        return clamp(cellSize, 0, maxSize);
      }

      const cellWidth = getCellPixelSize(gridCellWidth, width);
      const cellHeight = getCellPixelSize(gridCellHeight, height);

      if (cellWidth > 0) {
        for (let x = 0; x < width; x += cellWidth) {
          context.moveTo(x, 0);
          context.lineTo(x, height);
        }
        context.moveTo(width - 1, 0);
        context.lineTo(width - 1, height);
      }

      if (cellHeight > 0) {
        for (let y = 0; y < height; y += cellHeight) {
          context.moveTo(0, y);
          context.lineTo(width, y);
        }
        context.moveTo(0, height - 1);
        context.lineTo(width, height - 1);
      }

      context.stroke();

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
    },
    [yPoints, xScale, gridCellWidth, gridCellHeight, color, gridColor, width, height],
    [],
  );

  return <canvas ref={canvasRef} width={width} height={height} />;
}
