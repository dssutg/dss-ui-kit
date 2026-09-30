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

export function getShareColor({
  shareIndex,
  totalShares,
  colors = defaultPieChartColors,
}: {
  readonly shareIndex: number;
  readonly totalShares: number;
  readonly colors?: readonly string[];
}) {
  const curColor = colors[shareIndex % colors.length]!;

  if (shareIndex === totalShares - 1 && curColor === colors[0]) {
    // Last share has the same color as the first share,
    // so if we can, pick a different color.
    if (colors[1] === undefined) {
      return curColor;
    }
    return colors[1];
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
  readonly style?: React.CSSProperties;
  readonly shareMarginDegrees?: number;
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
      ctx.fillStyle = share!.color;
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
