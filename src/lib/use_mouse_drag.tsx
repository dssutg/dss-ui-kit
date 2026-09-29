import { useState } from "react";
import type { Point2D } from "@/lib/math";
import { useEventListener } from "@/lib/use_event_listener";

export function useMouseDrag(
	element: Element | null,
	onDrag?: (
		move: Point2D,
		{
			initialPosition,
			newPosition,
		}: {
			readonly initialPosition: Point2D;
			readonly newPosition: Point2D;
		},
	) => void,
	{
		onHandleDown,
		onHandleUp,
	}: {
		readonly onHandleDown?: (initialPosition: Point2D) => void;
		readonly onHandleUp?: () => void;
	} = {},
) {
	const [isDragging, setIsDragging] = useState(false);

	const [initialPosition, setInitialPosition] = useState<Point2D>({
		x: 0,
		y: 0,
	});

	const [position, setPosition] = useState<Point2D>({ x: 0, y: 0 });
	const [relativeMove, setRelativeMove] = useState<Point2D>({ x: 0, y: 0 });
	const [lastPosition, setLastPosition] = useState<Point2D>({ x: 0, y: 0 });

	function getPosition(event: TouchEvent | MouseEvent) {
		return event instanceof TouchEvent
			? { x: event.touches[0]!.clientX, y: event.touches[0]!.clientY }
			: { x: event.clientX, y: event.clientY };
	}

	function handleDown(event: MouseEvent | TouchEvent) {
		event.preventDefault();

		const initialPosition = getPosition(event);

		setIsDragging(true);
		setInitialPosition(initialPosition);
		setLastPosition(initialPosition);
		setPosition(initialPosition);

		onHandleDown?.(initialPosition);
	}

	function handleMove(event: MouseEvent | TouchEvent) {
		if (!isDragging) {
			return;
		}

		event.preventDefault();

		const newPosition = getPosition(event);

		const x = newPosition.x - lastPosition.x;
		const y = newPosition.y - lastPosition.y;

		setRelativeMove({ x, y });
		setLastPosition(newPosition);
		setPosition(newPosition);

		onDrag?.({ x, y }, { initialPosition, newPosition });
	}

	function handleUp() {
		setIsDragging(false);
		setRelativeMove({ x: 0, y: 0 });

		onHandleUp?.();
	}

	useEventListener("mousedown", handleDown, element);
	useEventListener("mousemove", handleMove, window);
	useEventListener("mouseup", handleUp, window);

	useEventListener("touchstart", handleDown, element);
	useEventListener("touchmove", handleMove, element);
	useEventListener("touchend", handleUp, element);

	return { isDragging, position, relativeMove };
}
