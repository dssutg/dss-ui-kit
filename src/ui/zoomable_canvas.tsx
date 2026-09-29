import { useRef, useState } from "react";
import { DOMRectContainsPoint } from "@/lib/dom";
import { useGranularEffect } from "@/lib/use_granular_effect";

export interface ZoomableCanvasDrawCallbackProps {
	mouseX: number;
	mouseY: number;
}

export interface ZoomableCanvasTransform {
	scale: number;
	offsetX: number;
	offsetY: number;
}

// Canvas that can be zoomed and moved
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
	readonly onDragOver?: React.DragEventHandler<HTMLCanvasElement>;
	readonly onDragEnter?: React.DragEventHandler<HTMLCanvasElement>;
	readonly onClickAt?: (x: number, y: number) => void;
	readonly onMouseMoveNoDragging?: (event: MouseEvent) => void;
	readonly onSingleTouchMove?: (event: TouchEvent) => void;
	readonly onMouseLeave?: (event: MouseEvent) => void;
	readonly onCanvasDragStart?: () => void;
	readonly onCanvasDragEnd?: () => void;
	readonly minScale?: number;
	readonly maxScale?: number;
	readonly scaleFactor?: number;
	readonly canvasRef?: React.Ref<HTMLCanvasElement>;
	readonly usingWebGL?: boolean;
	readonly shouldReleaseDragOnMouseLeave?: boolean;
	readonly style?: React.CSSProperties;
}) {
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

				let context: RenderingContext | null = null;
				if (usingWebGL) {
					context = canvas.getContext("webgl");
				} else {
					context = canvas.getContext("2d");
				}

				if (!context) {
					return;
				}

				const { x: canvasX, y: canvasY } = canvas.getBoundingClientRect();

				const props: ZoomableCanvasDrawCallbackProps = {
					mouseX: pointerStartXRef.current - canvasX,
					mouseY: pointerStartYRef.current - canvasY,
				};

				if (context instanceof CanvasRenderingContext2D) {
					context.clearRect(0, 0, context.canvas.width, context.canvas.height);
					drawCallback(context, transform, props);
				} else if (context instanceof WebGLRenderingContext) {
					context.clearColor(0, 0, 0, 1);
					context.clear(context.COLOR_BUFFER_BIT);
					drawCallback(context, transform, props);
				}
			}

			draw();

			// Forward the internal ref to the parent if provided
			if (canvasRef) {
				if (typeof canvasRef === "function") {
					canvasRef(internalCanvasRef.current);
				} else {
					(canvasRef as React.RefObject<HTMLCanvasElement | null>).current =
						internalCanvasRef.current;
				}
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

			function getTouchPointDistance(touches: TouchList) {
				if (touches[0] === undefined || touches[1] === undefined) {
					return 0;
				}

				const dx = touches[0].clientX - touches[1].clientX;
				const dy = touches[0].clientY - touches[1].clientY;

				return Math.hypot(dx, dy);
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
				const offsetX =
					transform.offsetX - (x - transform.offsetX) * scaleChange;
				const offsetY =
					transform.offsetY - (y - transform.offsetY) * scaleChange;

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
				if (
					hasPointerMovedSinceStartRef.current ||
					!internalCanvasRef.current ||
					!onClickAt
				) {
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
				if (event.touches.length === 2) {
					setStartDistance(getTouchPointDistance(event.touches));
				} else if (event.touches.length > 0) {
					setStartDistance(0);
					handlePointerStart(
						event,
						event.touches[0]!.clientX,
						event.touches[0]!.clientY,
					);
				}
			}

			function handleTouchMove(e: TouchEvent) {
				if (canvas === null) {
					return;
				}
				if (e.touches.length === 2) {
					e.preventDefault();

					const currentDistance = getTouchPointDistance(e.touches);

					const minDistance = 1;

					if (startDistance >= minDistance) {
						const canvasRect = canvas.getBoundingClientRect();

						const pinchX = (e.touches[0]!.clientX + e.touches[1]!.clientX) / 2;
						const pinchY = (e.touches[0]!.clientY + e.touches[1]!.clientY) / 2;

						const offsetX = pinchX - canvasRect.x;
						const offsetY = pinchY - canvasRect.y;

						zoomToPos(startDistance - currentDistance, offsetX, offsetY);
					}

					setStartDistance(currentDistance);

					draw();
				} else if (e.touches[0]) {
					onSingleTouchMove?.(e);
					handlePointerMove(e, e.touches[0].clientX, e.touches[0].clientY);
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

			function toggleEventListeners(
				canvas: HTMLCanvasElement,
				toggleType: "add" | "remove",
			) {
				const toggleCanvasListener =
					toggleType === "add"
						? canvas.addEventListener.bind(canvas)
						: canvas.removeEventListener.bind(canvas);

				const toggleDocumentListener =
					toggleType === "add"
						? document.addEventListener.bind(document)
						: document.removeEventListener.bind(document);

				toggleCanvasListener("mousedown", handleMouseDown);
				toggleCanvasListener("touchstart", handleTouchStart);
				toggleCanvasListener("touchmove", handleTouchMove);
				toggleCanvasListener("touchend", handleTouchEnd);
				toggleCanvasListener("touchcancel", handleTouchCancel);
				toggleCanvasListener("mouseleave", handleMouseLeave);
				toggleCanvasListener("wheel", handleWheel);
				toggleCanvasListener("mousemove", handleCanvasMouseMove);

				toggleDocumentListener("mousemove", handleMouseMove);
				toggleDocumentListener("mouseup", (e) => {
					pointerStartXRef.current = e.clientX;
					pointerStartYRef.current = e.clientY;
					endDragging();
					tryEmitClickAtEvent();
				});
			}

			toggleEventListeners(canvas, "add");

			return () => {
				toggleEventListeners(canvas, "remove");
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
			style={{ touchAction: "none", ...style }}
			onDragOver={onDragOver}
			onDragEnter={onDragEnter}
			onMouseLeave={onMouseLeave}
			onClick={() => internalCanvasRef.current?.focus()}
		/>
	);
}
