import { useCallback, useEffect, useRef, useState } from 'react';
import { cartesianToPolar, clamp, polarToCartesian, turn } from '@/lib/math';

export interface PieChartShare {
  title: string;
  percent: number;
  color: string;
}

export const defaultPieChartColors: readonly string[] = [
  '#ffff00',
  '#ff0000',
  '#ff7b00',
  '#00ff00',
  '#b9ffba',
  '#727cc1',
  '#00ffff',
  '#ff00ff',
];

/** Used only if a caller supplies a palette that is empty even after the default is applied. */
const NO_SHARE_COLOR = '#d4d4d4';

export function getShareColor({
  shareIndex,
  totalShares,
  colors = defaultPieChartColors,
}: {
  readonly shareIndex: number;
  readonly totalShares: number;
  readonly colors?: readonly string[] | undefined;
}) {
  // An empty palette falls back to the default one rather than to nothing: a caller who passes no
  // colours still expects every wedge of the pie to be painted.
  const palette = colors.length === 0 ? defaultPieChartColors : colors;
  const curColor = palette[shareIndex % palette.length] ?? NO_SHARE_COLOR;

  if (shareIndex === totalShares - 1 && curColor === palette[0]) {
    // Last share has the same color as the first share,
    // so if we can, pick a different color.
    const alternative = palette[1];

    if (alternative === undefined) {
      return curColor;
    }

    return alternative;
  }

  return curColor;
}

export function getSharePercent(count: number, total: number) {
  if (total === 0) {
    return 100;
  }
  return (count * 100) / total;
}

export function mapToShares<T>(
  records: readonly T[],
  totalCount: number,
  mapRecord: (
    record: T,
    recordIdx: number,
  ) => {
    title: string;
    count: number;
  },
): PieChartShare[] {
  return records.map((record, recordIndex) => {
    const { title, count } = mapRecord(record, recordIndex);

    return {
      title,
      percent: getSharePercent(count, totalCount),
      color: getShareColor({
        shareIndex: recordIndex,
        totalShares: records.length,
      }),
    };
  });
}

export function getPieChartShareEndAngle(startAngle: number, sharePercent: number) {
  const fract = clamp(sharePercent, 0, 100) / 100;
  return startAngle + fract * turn;
}

export function PieChart({
  shares,
  radius,
  style,
  shareMarginDegrees = 0,
}: {
  readonly shares: readonly PieChartShare[];
  readonly radius: number;
  readonly style?: React.CSSProperties | undefined;
  readonly shareMarginDegrees?: number | undefined;
}) {
  const [hoveredShare, setHoveredShare] = useState<PieChartShare | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const diameter = radius * 2;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (ctx === null) {
      return;
    }

    ctx.clearRect(0, 0, diameter, diameter);

    let startAngle = 0;
    for (const share of shares) {
      const endAngle = getPieChartShareEndAngle(startAngle, share.percent);

      let centerX = radius;
      let centerY = radius;

      // Move away from the circle center by margin towards the middle angle.
      // This moves pie chart share away from the center, like cake's piece.
      const midAngle = startAngle + (endAngle - startAngle) / 2;
      const shareShift = polarToCartesian(midAngle, shareMarginDegrees);
      centerX += shareShift.x;
      centerY += shareShift.y;

      const shareRadius = radius - shareMarginDegrees;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, shareRadius, startAngle, endAngle);
      ctx.lineTo(centerX, centerY);
      ctx.closePath();
      ctx.fillStyle = share.color;
      ctx.fill();

      startAngle = endAngle;
    }
  }, [shares, radius, diameter, shareMarginDegrees]);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      setHoveredShare(null);

      const canvas = canvasRef.current;
      if (canvas === null) {
        return;
      }

      const bb = canvas.getBoundingClientRect();

      // Compute cursor coordinates relative to circle center
      const px = e.clientX - (bb.x + radius);
      const py = e.clientY - (bb.y + radius);

      const { angle, radius: distance } = cartesianToPolar(px, py);

      if (distance > radius) {
        return; // point is outside the circle
      }

      let startAngle = 0;
      for (const share of shares) {
        const endAngle = getPieChartShareEndAngle(startAngle, share.percent);
        if (angle >= startAngle && angle < endAngle) {
          setHoveredShare(share);
          break;
        }
        startAngle = endAngle;
      }
    },
    [shares, radius],
  );

  let title = '';
  if (hoveredShare !== null) {
    const sharePercent = hoveredShare.percent.toFixed(2).replace(/\.0*$/, '');
    title = `${hoveredShare.title} - ${sharePercent}%`;
  }

  return (
    <canvas
      ref={canvasRef}
      width={diameter}
      height={diameter}
      onMouseMove={onMouseMove}
      style={{ display: 'block', ...style }}
      title={title}
    />
  );
}
