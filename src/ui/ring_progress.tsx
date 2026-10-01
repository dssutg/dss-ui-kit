import { useEffect, useMemo, useRef } from 'react';
import { cssColorTo6DigitHex, getColorFromBreakPoints } from '@/lib/color';
import { getDpr } from '@/lib/dom';
import { cmp, degreesToRadians } from '@/lib/math';
import { useWindowSize } from '@/lib/use_window_size';

export function RingProgress({
  progress = 100,
  progressMax = 100,
  title = '',
  rotationDegrees = -90,
  backgroundColor = '#a8a8a8',
  titleColor = '#ffffff',
  ringWidth = 15,
  radius = 70,
  titleFontSize = '1rem',
  titleLineHeight = '1.625rem',
  progressSuffix = '%',
  colorBreakPoints = [
    [0, '#a0fb9f'],
    [75, '#ffb66c'],
    [100, '#e55f5f'],
  ],
  interpolation = true,
  className,
  titleClassName,
  style,
  titleStyle,
  titlePos = 'bottom',
}: {
  readonly progress: number;
  readonly progressMax?: number | undefined;
  readonly title?: string | undefined;
  readonly rotationDegrees?: number | undefined;
  readonly backgroundColor?: string | undefined;
  readonly titleColor?: string | undefined;
  readonly ringWidth?: number | undefined;
  readonly radius?: number | undefined;
  readonly titleFontSize?: string | undefined;
  readonly titleLineHeight?: string | undefined;
  readonly progressSuffix?: string | undefined;
  readonly colorBreakPoints?: readonly [number, string][] | undefined;
  readonly interpolation?: boolean | undefined;
  readonly className?: string | undefined;
  readonly titleClassName?: string | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly titleStyle?: React.CSSProperties | undefined;
  readonly titlePos?: 'top' | 'bottom' | undefined;
}) {
  useWindowSize();

  const diameter = radius * 2 * getDpr();

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const sortedColorBreakPoints = useMemo(() => {
    return colorBreakPoints
      .map((bp): [number, string] => [bp[0], cssColorTo6DigitHex(bp[1]) ?? ''])
      .sort((a, b) => cmp(a[0], b[0]));
  }, [colorBreakPoints]);

  const intProgress = Math.round(progress);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const color = getColorFromBreakPoints(sortedColorBreakPoints, intProgress, interpolation);

    // Draw the ring progress
    {
      const radius = diameter / 2;
      const ringW = ringWidth * getDpr();
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      const normalizedRadius = radius - ringW / 2;

      // Range: [0...progressMax]
      const clampedProgress = Math.min(Math.max(intProgress, 0), progressMax);
      // Range: [0..1]
      const normalizedProgress = clampedProgress / progressMax;
      const normalizedRadiusFactor = 0.031_25;

      // Start drawing from empty canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw background arc
      ctx.beginPath();
      ctx.arc(cx, cy, radius - ringW, 0, Math.PI * 2);
      ctx.lineWidth = ringW;
      ctx.strokeStyle = backgroundColor;
      ctx.stroke();

      // Draw foreground arc
      if (intProgress > 0) {
        const startAngle = degreesToRadians(rotationDegrees);
        const endAngle = startAngle + Math.PI * 2 * normalizedProgress;

        // Make foreground arc a bit larger to prevent background arc
        // partly visible below the foreground.
        const ringWBias = 2;

        ctx.beginPath();
        ctx.arc(cx, cy, radius - ringW, startAngle, endAngle, false);
        ctx.lineWidth = ringW + ringWBias;
        ctx.lineCap = 'round';
        ctx.strokeStyle = color;
        ctx.stroke();
      }

      // Draw progress text in the middle of the ring
      ctx.fillStyle = color;
      ctx.font = `${normalizedRadius * normalizedRadiusFactor}rem Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${clampedProgress}${progressSuffix}`, cx, cy);
    }
  }, [
    intProgress,
    progressMax,
    rotationDegrees,
    backgroundColor,
    ringWidth,
    diameter,
    progressSuffix,
    sortedColorBreakPoints,
    interpolation,
  ]);

  const titleComponent = (
    <div
      style={{
        width: '100%',
        color: titleColor,
        maxWidth: `${diameter}px`,
        textAlign: 'center',
        fontSize: titleFontSize,
        lineHeight: titleLineHeight,
        ...titleStyle,
      }}
      className={titleClassName}
    >
      {title}
    </div>
  );

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        ...style,
      }}
      className={className}
    >
      {titlePos === 'top' && titleComponent}
      <canvas
        ref={canvasRef}
        style={{
          width: radius * 2,
          height: radius * 2,
          flexShrink: 0,
          ...style,
        }}
        width={diameter}
        height={diameter}
      />
      {titlePos === 'bottom' && titleComponent}
    </div>
  );
}
