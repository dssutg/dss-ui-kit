// SPDX-License-Identifier: MIT
// A canvas the wheel zooms and the pointer pans around.

import { useCallback, useEffect, useRef } from 'react';
import { DOMRectContainsPoint } from '@/util/dom';
import { useGranularEffect } from '@/util/hooks/use_granular_effect';
import { usePropertyRef } from '@/util/hooks/use_property_ref';

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
  className,
  style,
  canvasRef,
  usingWebGL = false,
  shouldReleaseDragOnMouseLeave = false,
  contentVersion = 0,
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
  /**
   * A number that changes when the drawn content changes while the view does not — an image that has
   * just finished loading, an icon that has just entered its cache.
   *
   * Content arriving asynchronously moves none of the other dependencies, so without a change here the
   * canvas keeps the frame it painted before the content landed. The value is a trigger and is never
   * read: bump it and the canvas repaints as it does when the transform changes.
   */
  readonly contentVersion?: number | undefined;
  readonly className?: string | undefined;
  readonly style?: React.CSSProperties | undefined;
}): React.JSX.Element {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);

  /**
   * Where the current gesture is, in the state the listeners read and write between events.
   *
   * Refs rather than state: these change on every pointer move, and a re-render for a value no render
   * shows would be work the operator never sees — beside re-running whatever shared a dependency list
   * with them, which is how the listeners below came to be torn down on every pointer start.
   */
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startDistanceRef = useRef(0);

  const pointerStartXRef = useRef(0);
  const pointerStartYRef = useRef(0);
  const hasPointerMovedSinceStartRef = useRef(false);

  /**
   * The props the listeners and the drawing read, newest first.
   *
   * The listeners are attached once and never re-attached — an event arriving between a teardown and
   * its replacement is an event nobody sees — so they read the current props through this ref instead
   * of closing over the render they were attached in.
   */
  const latestPropsRef = usePropertyRef({
    transform,
    drawCallback,
    usingWebGL,
    onTransformChange,
    minScale,
    maxScale,
    scaleFactor,
    onClickAt,
    onMouseMoveNoDragging,
    onSingleTouchMove,
    onCanvasDragStart,
    onCanvasDragEnd,
    shouldReleaseDragOnMouseLeave,
  });

  /**
   * Clears the canvas and paints it with the newest props.
   *
   * Its identity never changes, which is what lets both effects below depend on it: depending on it
   * re-runs neither of them, it is only there to be called.
   */
  const draw = useCallback(() => {
    const canvas = internalCanvasRef.current;

    // The JSX below attaches this ref before the effect runs and clears it on unmount, so the
    // canvas is never absent while draw() can be called; the compiler cannot see that.
    // v8 ignore start
    if (!canvas) {
      return;
    }
    // v8 ignore stop

    const props = latestPropsRef.current;

    const context: RenderingContext | null = props.usingWebGL
      ? canvas.getContext('webgl')
      : canvas.getContext('2d');

    if (!context || !clearForDrawing(context)) {
      return;
    }

    const { x: canvasX, y: canvasY } = canvas.getBoundingClientRect();

    const drawProps: ZoomableCanvasDrawCallbackProps = {
      mouseX: pointerStartXRef.current - canvasX,
      mouseY: pointerStartYRef.current - canvasY,
    };

    props.drawCallback(context, props.transform, drawProps);
  }, [latestPropsRef]);

  // Forward the internal ref to the caller, which sizes the canvas from it.
  useEffect(() => {
    if (canvasRef) {
      canvasRef.current = internalCanvasRef.current;
    }
  }, [canvasRef]);

  /**
   * Paints whenever the view, the drawing itself or the drawn content changes.
   *
   * `contentVersion` sits here as a trigger rather than as a value the effect reads: content that
   * arrives asynchronously changes nothing else in the list, so a caller bumps it to repaint.
   */
  useGranularEffect(
    () => {
      draw();
    },
    [width, height, transform, drawCallback, usingWebGL, contentVersion],
    [draw],
  );

  /**
   * Attaches the canvas and document listeners for as long as the component is mounted.
   *
   * Attached once, and never again while it is mounted: everything these handlers read that can
   * change — the transform, the caller's callbacks, the gesture state — comes through the refs above,
   * so no pointer move or button press can change what this effect depends on. Sharing a dependency
   * list with the drag state used to tear every listener down and put it back on each pointer start,
   * and an event landing in that gap was never seen.
   */
  useEffect(() => {
    const canvas = internalCanvasRef.current;

    // As above: the ref is attached before this effect runs, so the canvas is never absent here.
    // v8 ignore start
    if (!canvas) {
      return;
    }
    // v8 ignore stop

    function handlePointerStart(event: Event, x: number, y: number) {
      event.preventDefault();
      startDragging();
      hasPointerMovedSinceStartRef.current = false;
      pointerStartXRef.current = x;
      pointerStartYRef.current = y;

      const props = latestPropsRef.current;
      startXRef.current = x - props.transform.offsetX;
      startYRef.current = y - props.transform.offsetY;

      draw();
    }

    function handlePointerMove(event: Event, x: number, y: number) {
      if (!isDraggingRef.current) {
        return;
      }

      hasPointerMovedSinceStartRef.current = true;

      event.preventDefault();

      const props = latestPropsRef.current;
      const offsetX = x - startXRef.current;
      const offsetY = y - startYRef.current;

      props.onTransformChange({ ...props.transform, offsetX, offsetY });

      draw();
    }

    function startDragging() {
      isDraggingRef.current = true;
      latestPropsRef.current.onCanvasDragStart?.();
    }

    function endDragging() {
      isDraggingRef.current = false;
      latestPropsRef.current.onCanvasDragEnd?.();
      draw();
    }

    function zoomToPos(zoomDirection: number, x: number, y: number) {
      const props = latestPropsRef.current;

      let factor = props.scaleFactor;
      if (zoomDirection >= 0) {
        factor = -props.scaleFactor;
      }

      let scale = props.transform.scale * (1 + factor);
      if (props.minScale !== undefined && scale < props.minScale) {
        scale = props.minScale;
      } else if (props.maxScale !== undefined && scale > props.maxScale) {
        scale = props.maxScale;
      }

      const scaleChange = scale / props.transform.scale - 1;
      const offsetX = props.transform.offsetX - (x - props.transform.offsetX) * scaleChange;
      const offsetY = props.transform.offsetY - (y - props.transform.offsetY) * scaleChange;

      props.onTransformChange({ scale, offsetX, offsetY });
      draw();
    }

    function handleMouseDown(event: MouseEvent) {
      handlePointerStart(event, event.clientX, event.clientY);
    }

    function handleMouseMove(event: MouseEvent) {
      handlePointerMove(event, event.clientX, event.clientY);
    }

    function tryEmitClickAtEvent() {
      if (
        hasPointerMovedSinceStartRef.current ||
        !internalCanvasRef.current ||
        !latestPropsRef.current.onClickAt
      ) {
        return;
      }

      const rect = internalCanvasRef.current.getBoundingClientRect();

      const pointerX = pointerStartXRef.current;
      const pointerY = pointerStartYRef.current;

      const x = pointerX - rect.x;
      const y = pointerY - rect.y;

      if (DOMRectContainsPoint(rect, pointerX, pointerY)) {
        latestPropsRef.current.onClickAt?.(x, y);
        draw();
      }
    }

    function handleMouseLeave() {
      if (latestPropsRef.current.shouldReleaseDragOnMouseLeave) {
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
        startDistanceRef.current = getTouchPointDistance(event.touches);
        draw();
      } else if (first !== null) {
        startDistanceRef.current = 0;
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

      if (startDistanceRef.current >= minDistance) {
        const firstTouch = e.touches.item(0);
        const secondTouch = e.touches.item(1);

        if (firstTouch !== null && secondTouch !== null) {
          const canvasRect = canvas.getBoundingClientRect();

          const pinchX = (firstTouch.clientX + secondTouch.clientX) / 2;
          const pinchY = (firstTouch.clientY + secondTouch.clientY) / 2;

          const offsetX = pinchX - canvasRect.x;
          const offsetY = pinchY - canvasRect.y;

          zoomToPos(startDistanceRef.current - currentDistance, offsetX, offsetY);
        }
      }

      startDistanceRef.current = currentDistance;

      draw();
    }

    /**
     * An arrow rather than a function declaration: a declaration is hoisted, so the narrowing that
     * established `canvas` above does not reach inside one and it would need a null check of its own.
     */
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        zoomForTouchPinch(canvas, e);
        return;
      }

      const first = e.touches.item(0);

      if (first !== null) {
        latestPropsRef.current.onSingleTouchMove?.(e);
        handlePointerMove(e, first.clientX, first.clientY);
      }
    };

    function handleTouchEnd(event: TouchEvent) {
      if (event.touches.length < 2) {
        startDistanceRef.current = 0;
        tryEmitClickAtEvent();
      }
      endDragging();
    }

    function handleTouchCancel() {
      startDistanceRef.current = 0;
      endDragging();
    }

    function handleCanvasMouseMove(e: MouseEvent) {
      if (!isDraggingRef.current) {
        latestPropsRef.current.onMouseMoveNoDragging?.(e);
      }
    }

    function handleMouseUp(event: MouseEvent) {
      pointerStartXRef.current = event.clientX;
      pointerStartYRef.current = event.clientY;
      endDragging();
      tryEmitClickAtEvent();
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
      // Named rather than inline: `removeEventListener` matches the function it was added with, and a
      // fresh arrow here is a document listener nothing ever removes.
      toggleDocumentListener('mouseup', handleMouseUp);
    }

    toggleEventListeners(canvas, 'add');

    return () => {
      toggleEventListeners(canvas, 'remove');
    };
  }, [draw, latestPropsRef]);

  return (
    <canvas
      tabIndex={0}
      ref={internalCanvasRef}
      width={width}
      height={height}
      className={className}
      style={{ touchAction: 'none', ...style }}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onMouseLeave={onMouseLeave}
      onClick={() => internalCanvasRef.current?.focus()}
    />
  );
}
