import { useRef, useState } from 'react';
import { DOMRectContainsPoint } from '@/util/dom';
import { useGranularEffect } from '@/util/hooks/use_granular_effect';

/**
 * Where the pointer is over a canvas, in the canvas's own pixels.
 *
 * Passed to the draw callback on every pointer move so a caller drawing a crosshair knows where to put
 * it without adding a listener of its own.
 */
export interface ZoomableCanvasDrawCallbackProps {
  mouseX: number;
  mouseY: number;
}

/**
 * How far a canvas is zoomed and panned: one scale for both axes and an offset in canvas pixels.
 *
 * Uniform scale, because a chart that could stretch one axis independently would stop being readable
 * — a distorted plot shows different slopes for the same slope. Exported because a caller that puts a
 * chart in fullscreen, or saves the view, has to hold the transform itself.
 */
export interface ZoomableCanvasTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** The distance between the first two touches, or 0 when there are not two of them. */
function getTouchPointDistance(touches: TouchList) {
  if (touches[0] === undefined || touches[1] === undefined) {
    return 0;
  }

  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;

  return Math.hypot(dx, dy);
}

/**
 * Clear the context the canvas was asked for, ready to be drawn into. A 2D context is cleared to
 * transparent, a WebGL one to black; anything else is left alone and reported as unusable.
 */
function clearForDrawing(context: RenderingContext): boolean {
  if (context instanceof CanvasRenderingContext2D) {
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);

    return true;
  }

  if (context instanceof WebGLRenderingContext) {
    context.clearColor(0, 0, 0, 1);
    context.clear(context.COLOR_BUFFER_BIT);

    return true;
  }

  return false;
}

/** Canvas that can be zoomed and moved */
export function ZoomableCanvas({
  width,
  height,
  transform,
  onTransformChange,
  drawCallback,
  onDragOver,
  onDragEnter,
  onClickAt,
  onMouseMoveNoDragging,
  onSingleTouchMove,
  onMouseLeave,
  onCanvasDragStart,
  onCanvasDragEnd,
  minScale,
  maxScale,
  scaleFactor = 0.1,
  style,
  canvasRef,
  usingWebGL = false,
  shouldReleaseDragOnMouseLeave = false,
}: {
  readonly width: number;
  readonly height: number;
  readonly transform: ZoomableCanvasTransform;
  readonly onTransformChange: (transform: ZoomableCanvasTransform) => void;
  readonly drawCallback: (
    context: CanvasRenderingContext2D | WebGLRenderingContext,
    transform: ZoomableCanvasTransform,
    props: ZoomableCanvasDrawCallbackProps,
  ) => void;
  readonly onDragOver?: React.DragEventHandler<HTMLCanvasElement> | undefined;
  readonly onDragEnter?: React.DragEventHandler<HTMLCanvasElement> | undefined;
  readonly onClickAt?: (x: number, y: number) => void;
  readonly onMouseMoveNoDragging?: (event: MouseEvent) => void;
  readonly onSingleTouchMove?: (event: TouchEvent) => void;
  readonly onMouseLeave?: (event: MouseEvent) => void;
  readonly onCanvasDragStart?: () => void;
  readonly onCanvasDragEnd?: () => void;
  readonly minScale?: number | undefined;
  readonly maxScale?: number | undefined;
  readonly scaleFactor?: number | undefined;
  canvasRef?: React.RefObject<HTMLCanvasElement> | undefined;
  readonly usingWebGL?: boolean | undefined;
  readonly shouldReleaseDragOnMouseLeave?: boolean | undefined;
  readonly style?: React.CSSProperties | undefined;
}): React.JSX.Element {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [startDistance, setStartDistance] = useState(0);

  const pointerStartXRef = useRef(0);
  const pointerStartYRef = useRef(0);
  const hasPointerMovedSinceStartRef = useRef(false);

  useGranularEffect(
    () => {
      function draw() {
        const canvas = internalCanvasRef.current;

        if (!canvas) {
          return;
        }

        const context: RenderingContext | null = usingWebGL
          ? canvas.getContext('webgl')
          : canvas.getContext('2d');

        if (!context || !clearForDrawing(context)) {
          return;
        }

        const { x: canvasX, y: canvasY } = canvas.getBoundingClientRect();

        const props: ZoomableCanvasDrawCallbackProps = {
          mouseX: pointerStartXRef.current - canvasX,
          mouseY: pointerStartYRef.current - canvasY,
        };

        drawCallback(context, transform, props);
      }

      draw();

      // Forward the internal ref to the caller, which sizes the canvas from it.
      if (canvasRef) {
        canvasRef.current = internalCanvasRef.current;
      }

      const canvas = internalCanvasRef.current;

      if (!canvas) {
        return undefined;
      }

      function handlePointerStart(event: Event, x: number, y: number) {
        event.preventDefault();
        startDragging();
        hasPointerMovedSinceStartRef.current = false;
        pointerStartXRef.current = x;
        pointerStartYRef.current = y;
        setStartX(x - transform.offsetX);
        setStartY(y - transform.offsetY);
      }

      function handlePointerMove(event: Event, x: number, y: number) {
        if (!isDragging) {
          return;
        }

        hasPointerMovedSinceStartRef.current = true;

        event.preventDefault();

        const offsetX = x - startX;
        const offsetY = y - startY;

        onTransformChange({ ...transform, offsetX, offsetY });

        draw();
      }

      function startDragging() {
        setIsDragging(true);
        onCanvasDragStart?.();
      }

      function endDragging() {
        setIsDragging(false);
        onCanvasDragEnd?.();
      }

      function zoomToPos(zoomDirection: number, x: number, y: number) {
        let factor = scaleFactor;
        if (zoomDirection >= 0) {
          factor = -scaleFactor;
        }

        let scale = transform.scale * (1 + factor);
        if (minScale !== undefined && scale < minScale) {
          scale = minScale;
        } else if (maxScale !== undefined && scale > maxScale) {
          scale = maxScale;
        }

        const scaleChange = scale / transform.scale - 1;
        const offsetX = transform.offsetX - (x - transform.offsetX) * scaleChange;
        const offsetY = transform.offsetY - (y - transform.offsetY) * scaleChange;

        onTransformChange({ scale, offsetX, offsetY });
        draw();
      }

      function handleMouseDown(event: MouseEvent) {
        handlePointerStart(event, event.clientX, event.clientY);
      }

      function handleMouseMove(event: MouseEvent) {
        handlePointerMove(event, event.clientX, event.clientY);
      }

      function tryEmitClickAtEvent() {
        if (hasPointerMovedSinceStartRef.current || !internalCanvasRef.current || !onClickAt) {
          return;
        }

        const rect = internalCanvasRef.current.getBoundingClientRect();

        const pointerX = pointerStartXRef.current;
        const pointerY = pointerStartYRef.current;

        const x = pointerX - rect.x;
        const y = pointerY - rect.y;

        if (DOMRectContainsPoint(rect, pointerX, pointerY)) {
          onClickAt(x, y);
          draw();
        }
      }

      function handleMouseLeave() {
        if (shouldReleaseDragOnMouseLeave) {
          endDragging();
        }
      }

      function handleWheel(event: WheelEvent) {
        event.preventDefault();
        zoomToPos(event.deltaY, event.offsetX, event.offsetY);
      }

      function handleTouchStart(event: TouchEvent) {
        const first = event.touches.item(0);

        if (event.touches.length === 2) {
          setStartDistance(getTouchPointDistance(event.touches));
        } else if (first !== null) {
          setStartDistance(0);
          handlePointerStart(event, first.clientX, first.clientY);
        }
      }

      /**
       * Two fingers down: the distance between them is the zoom level, and their midpoint is the
       * point that stays put while the canvas scales under them.
       */
      function zoomForTouchPinch(canvas: HTMLCanvasElement, e: TouchEvent) {
        e.preventDefault();

        const currentDistance = getTouchPointDistance(e.touches);

        const minDistance = 1;

        if (startDistance >= minDistance) {
          const firstTouch = e.touches.item(0);
          const secondTouch = e.touches.item(1);

          if (firstTouch !== null && secondTouch !== null) {
            const canvasRect = canvas.getBoundingClientRect();

            const pinchX = (firstTouch.clientX + secondTouch.clientX) / 2;
            const pinchY = (firstTouch.clientY + secondTouch.clientY) / 2;

            const offsetX = pinchX - canvasRect.x;
            const offsetY = pinchY - canvasRect.y;

            zoomToPos(startDistance - currentDistance, offsetX, offsetY);
          }
        }

        setStartDistance(currentDistance);

        draw();
      }

      function handleTouchMove(e: TouchEvent) {
        if (canvas === null) {
          return;
        }
        if (e.touches.length === 2) {
          zoomForTouchPinch(canvas, e);
          return;
        }

        const first = e.touches.item(0);

        if (first !== null) {
          onSingleTouchMove?.(e);
          handlePointerMove(e, first.clientX, first.clientY);
        }
      }

      function handleTouchEnd(event: TouchEvent) {
        if (event.touches.length < 2) {
          setStartDistance(0);
          tryEmitClickAtEvent();
        }
        endDragging();
      }

      function handleTouchCancel() {
        setStartDistance(0);
        endDragging();
      }

      function handleCanvasMouseMove(e: MouseEvent) {
        if (!isDragging) {
          onMouseMoveNoDragging?.(e);
        }
      }

      function toggleEventListeners(canvas: HTMLCanvasElement, toggleType: 'add' | 'remove') {
        const toggleCanvasListener =
          toggleType === 'add'
            ? canvas.addEventListener.bind(canvas)
            : canvas.removeEventListener.bind(canvas);

        const toggleDocumentListener =
          toggleType === 'add'
            ? document.addEventListener.bind(document)
            : document.removeEventListener.bind(document);

        toggleCanvasListener('mousedown', handleMouseDown);
        toggleCanvasListener('touchstart', handleTouchStart);
        toggleCanvasListener('touchmove', handleTouchMove);
        toggleCanvasListener('touchend', handleTouchEnd);
        toggleCanvasListener('touchcancel', handleTouchCancel);
        toggleCanvasListener('mouseleave', handleMouseLeave);
        toggleCanvasListener('wheel', handleWheel);
        toggleCanvasListener('mousemove', handleCanvasMouseMove);

        toggleDocumentListener('mousemove', handleMouseMove);
        toggleDocumentListener('mouseup', (e) => {
          pointerStartXRef.current = e.clientX;
          pointerStartYRef.current = e.clientY;
          endDragging();
          tryEmitClickAtEvent();
        });
      }

      toggleEventListeners(canvas, 'add');

      return () => {
        toggleEventListeners(canvas, 'remove');
      };
    },
    [
      width,
      height,
      transform,
      startDistance,
      onTransformChange,
      drawCallback,
      minScale,
      maxScale,
      scaleFactor,
      isDragging,
      canvasRef,
      onClickAt,
      onCanvasDragStart,
      onCanvasDragEnd,
      onMouseMoveNoDragging,
      onSingleTouchMove,
      shouldReleaseDragOnMouseLeave,
      startX,
      startY,
      usingWebGL,
    ],
    [],
  );

  return (
    <canvas
      tabIndex={0}
      ref={internalCanvasRef}
      width={width}
      height={height}
      style={{ touchAction: 'none', ...style }}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onMouseLeave={onMouseLeave}
      onClick={() => internalCanvasRef.current?.focus()}
    />
  );
}
