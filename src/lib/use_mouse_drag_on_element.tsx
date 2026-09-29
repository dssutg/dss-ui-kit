import { clamp } from "@/lib/math";
import { useEventListener } from "@/lib/use_event_listener";

export function useMouseDragOnElement(
	element: HTMLElement | null,
	onDrag: ({
		x,
		y,
		normalizedX,
		normalizedY,
		percentX,
		percentY,
		box,
	}: {
		readonly x: number;
		readonly y: number;
		readonly normalizedX: number;
		readonly normalizedY: number;
		readonly percentX: number;
		readonly percentY: number;
		readonly box: DOMRect;
	}) => void,
) {
	function onDown(event: MouseEvent | TouchEvent) {
		event.preventDefault();
		event.stopPropagation();

		if (element === null) {
			return;
		}

		const box = element.getBoundingClientRect();

		function updateByCursor(cursorX: number, cursorY: number) {
			if (element === null) {
				return;
			}

			const x = cursorX - box.left;
			const y = cursorY - box.top;

			const normalizedX = clamp(x / box.width, 0, 1);
			const normalizedY = clamp(y / box.height, 0, 1);

			const percentX = clamp(normalizedX * 100, 0, 100);
			const percentY = clamp(normalizedY * 100, 0, 100);

			onDrag({ x, y, normalizedX, normalizedY, percentX, percentY, box });
		}

		if (event instanceof TouchEvent) {
			updateByCursor(event.touches[0]!.clientX, event.touches[0]!.clientY);
		} else {
			updateByCursor(event.clientX, event.clientY);
		}

		function onMove(event: MouseEvent | TouchEvent) {
			if (event instanceof MouseEvent) {
				updateByCursor(event.clientX, event.clientY);
			} else {
				updateByCursor(event.touches[0]!.clientX, event.touches[0]!.clientY);
			}
		}

		function onUp() {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
			window.removeEventListener("touchmove", onMove);
			window.removeEventListener("touchend", onUp);
		}

		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
		window.addEventListener("touchmove", onMove);
		window.addEventListener("touchend", onUp);
	}

	useEventListener("mousedown", onDown, element);
	useEventListener("touchstart", onDown, element);
}
