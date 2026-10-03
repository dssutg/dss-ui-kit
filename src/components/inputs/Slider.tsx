import { useCallback, useRef, useState } from 'react';
import { minInArrayMapped } from '@/util/array';
import { getPointerPosition } from '@/util/dom';
import { useOutsideComponentClick } from '@/util/hooks/use_outside_component_click';
import { clamp, cmp, lerp, unlerp } from '@/util/math';

/**
 * A draggable slider over a numeric range, with optional labelled break points.
 *
 * Works with a pointer, and with the arrow keys, because a slider that only a mouse can move is a
 * slider a keyboard cannot use. Break points are values the thumb snaps to and labels the caller
 * supplies; they are drawn only when `breakPointsVisible` is set, so the same data can drive the
 * snapping without adding ticks to the track.
 *
 * The colours are props with literal defaults rather than tokens, because this slider is used inside
 * embedded views that have a palette of their own.
 */
export function Slider({
  min,
  max,
  value,
  onChange,
  step = 1,
  progressColor = '#1976d2',
  toolTipBackgroundColor = '#757575',
  toolTipTextColor = '#ffffff',
  breakPointLabelColor = 'var(--color-tpd)',
  thumbSize = 20,
  trackHeight = 4,
  breakPoints,
  breakPointsVisible = false,
}: {
  readonly min: number;
  readonly max: number;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly step?: number | undefined;
  readonly progressColor?: string | undefined;
  readonly toolTipBackgroundColor?: string | undefined;
  readonly toolTipTextColor?: string | undefined;
  readonly toolTipColor?: string | undefined;
  readonly breakPointLabelColor?: string | undefined;
  readonly thumbSize?: number | undefined;
  readonly trackHeight?: number | undefined;
  readonly breakPoints?: readonly number[] | undefined;
  readonly breakPointsVisible?: boolean | undefined;
}) {
  const minValue = Math.min(min, max);
  const maxValue = Math.max(min, max);

  const uniqueBreakPoints = [...new Set(breakPoints)].toSorted(cmp);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const toolTipRef = useRef<HTMLDivElement>(null);

  const [toolTipVisible, setToolTipVisible] = useState(false);
  const [captured, setCaptured] = useState(false);

  function calculatePercent(value: number, min: number, max: number) {
    if (max === 0) {
      return 0;
    }
    return clamp(unlerp(min, max, value), 0, 1) * 100;
  }

  const percent = calculatePercent(value, minValue, maxValue);

  const updateValueByCursorX = useCallback(
    (cursorX: number) => {
      if (wrapperRef.current === null) {
        return;
      }

      const box = wrapperRef.current.getBoundingClientRect();

      const progress = (cursorX - box.x) / box.width;

      function getNearestBreakPointValueDirect(breakPoints: readonly number[], value: number) {
        const breakPointsWithDistance = breakPoints.map((breakPoint) => ({
          breakPoint,
          distance: Math.abs(value - breakPoint),
        }));

        const nearestBreakPoint = minInArrayMapped(
          breakPointsWithDistance,
          ({ distance }) => distance,
        );

        if (nearestBreakPoint === null) {
          return value;
        }

        return nearestBreakPoint.minElement.breakPoint;
      }

      const value = getNearestBreakPointValueDirect(
        uniqueBreakPoints,
        clamp(Math.round(lerp(minValue, maxValue, progress)), minValue, maxValue),
      );

      onChange(value);
    },
    [minValue, maxValue, uniqueBreakPoints, onChange],
  );

  const onCursorDown = useCallback(
    (event: MouseEvent | TouchEvent) => {
      if (wrapperRef.current === null) {
        return;
      }

      const pointer = getPointerPosition(event);

      if (pointer === null) {
        return;
      }

      if (event instanceof MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
      }

      updateValueByCursorX(pointer.x);

      function onCursorMove(e: MouseEvent | TouchEvent) {
        if (e instanceof MouseEvent) {
          e.preventDefault();
          e.stopPropagation();
        }

        const moved = getPointerPosition(e);

        if (moved === null) {
          return;
        }

        updateValueByCursorX(moved.x);
      }

      function onCursorUp() {
        window.removeEventListener('mousemove', onCursorMove);
        window.removeEventListener('mouseup', onCursorUp);

        window.removeEventListener('touchmove', onCursorMove);
        window.removeEventListener('touchend', onCursorUp);

        wrapperRef.current?.focus();

        setCaptured(false);
      }

      window.addEventListener('mousemove', onCursorMove);
      window.addEventListener('mouseup', onCursorUp);

      window.addEventListener('touchmove', onCursorMove);
      window.addEventListener('touchend', onCursorUp);

      setToolTipVisible(true);
      setCaptured(true);
    },
    [updateValueByCursorX],
  );

  useOutsideComponentClick(wrapperRef, () => {
    setCaptured(false);
    setToolTipVisible(false);
  });

  const toolTipWidth = toolTipRef.current?.getBoundingClientRect().width ?? 0;

  return (
    <div className="flex w-full flex-col gap-1 text-base">
      <div
        ref={wrapperRef}
        tabIndex={0}
        role="slider"
        aria-valuemin={minValue}
        aria-valuemax={maxValue}
        aria-valuenow={value}
        aria-orientation="horizontal"
        className="relative flex w-full cursor-pointer items-center"
        style={{ height: thumbSize }}
        onMouseEnter={() => setToolTipVisible(true)}
        onMouseLeave={() => {
          if (!captured) {
            setToolTipVisible(false);
          }
        }}
        onMouseDown={onCursorDown}
        onTouchStart={onCursorDown}
        onKeyDown={({ code }) => {
          function getNearestBreakPointValue(
            breakPoints: readonly number[],
            oldValue: number,
            newValue: number,
          ) {
            const increasing = newValue > oldValue;

            const breakPointsWithDistance = breakPoints
              .filter(
                (breakPoint) =>
                  breakPoint !== oldValue &&
                  ((increasing && breakPoint > oldValue) || (!increasing && breakPoint < oldValue)),
              )
              .map((breakPoint) => ({
                breakPoint,
                distance: Math.abs(newValue - breakPoint),
              }));

            const nearestBreakPoint = minInArrayMapped(
              breakPointsWithDistance,
              ({ distance }) => distance,
            );

            if (nearestBreakPoint === null) {
              return oldValue;
            }

            return nearestBreakPoint.minElement.breakPoint;
          }

          if (code === 'ArrowLeft' || code === 'ArrowDown') {
            onChange(getNearestBreakPointValue(uniqueBreakPoints, value, value - step));
            setToolTipVisible(true);
          }

          if (code === 'ArrowRight' || code === 'ArrowUp') {
            onChange(getNearestBreakPointValue(uniqueBreakPoints, value, value + step));
            setToolTipVisible(true);
          }
        }}
      >
        <div
          className="absolute left-0 w-full"
          style={{
            height: trackHeight,
            backgroundColor: progressColor,
            opacity: 0.38,
          }}
        />
        <div
          style={{
            width: `${percent}%`,
            height: trackHeight,
            backgroundColor: progressColor,
          }}
        />
        <div
          className="bg-bin absolute top-0 rounded-full"
          style={{
            width: thumbSize,
            height: thumbSize,
            left: `calc(${percent}% - ${thumbSize / 2}px)`,
            backgroundColor: progressColor,
          }}
        />
        <div
          ref={toolTipRef}
          className="pointer-events-none absolute select-none text-nowrap px-2 pb-2 pt-1 text-base transition-opacity duration-300"
          style={{
            left: `calc(${percent}% - ${toolTipWidth / 2}px)`,
            bottom: thumbSize + 4,
            backgroundColor: toolTipBackgroundColor,
            color: toolTipTextColor,
            opacity: toolTipVisible ? 1 : 0,
            clipPath:
              'polygon(0 0, 100% 0, 100% calc(100% - 5px), calc(50% + 5px) calc(100% - 5px), 50% 100%, calc(50% - 5px) calc(100% - 5px), 0 calc(100% - 5px))',
          }}
        >
          {value}
        </div>
      </div>
      {breakPointsVisible && (
        <div className="relative h-4 text-base" style={{ color: breakPointLabelColor }}>
          {uniqueBreakPoints.map((breakPoint) => (
            <div
              key={breakPoint}
              className="absolute"
              style={{
                left: `${calculatePercent(breakPoint, minValue, maxValue)}%`,
                transform: 'translateX(-50%)',
              }}
            >
              {breakPoint}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
