import { useEffect, useState } from "react";

export function useElementSize<T extends HTMLElement>(
	elementRef: React.RefObject<T | null>,
) {
	const [size, setSize] = useState({ width: 0, height: 0 });

	useEffect(() => {
		if (elementRef.current === null) {
			return;
		}

		const boundingRect = elementRef.current.getBoundingClientRect();

		setSize({
			width: boundingRect.width,
			height: boundingRect.height,
		});

		const resizeObserver = new ResizeObserver((entries) => {
			const [wrapperEntry] = entries;

			if (wrapperEntry === undefined) {
				return;
			}

			const { width, height } = wrapperEntry.contentRect;

			setSize({ width, height });
		});

		resizeObserver.observe(elementRef.current);
	}, [elementRef.current]);

	return size;
}
