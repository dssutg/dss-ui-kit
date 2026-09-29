import { useCallback, useEffect, useRef, useState } from "react";
import { useForceUpdate } from "@/lib/use_force_update";
import { useGranularEffect } from "@/lib/use_granular_effect";
import { useTimeout } from "@/lib/use_timeout";

export interface VirtualizedListRowRendererProps {
	index: number;
	style: React.CSSProperties;
}

export function VirtualizedList({
	itemCount,
	itemSize,
	rowRenderer,
	width,
	height,
	onScroll,
	overScanCount,
	containerRef,
}: {
	readonly itemCount: number;
	readonly itemSize: number;
	readonly rowRenderer: (
		props: VirtualizedListRowRendererProps,
	) => React.ReactNode;
	readonly width: number | string;
	readonly height: number | string;
	readonly onScroll?: (event: UIEvent) => void;
	readonly overScanCount?: number;
	readonly containerRef: React.MutableRefObject<HTMLDivElement | null>;
}) {
	const { startIndex, endIndex, getItemStyle } = useVirtualizedList({
		ref: containerRef,
		itemCount,
		itemSize,
		overScanCount,
	});

	const forceUpdate = useForceUpdate();

	// Make sure references get propagated to hooks
	useTimeout(forceUpdate, 0);

	return (
		<div
			ref={containerRef}
			style={{ width, height, overflow: "auto", position: "relative" }}
			onScroll={onScroll}
		>
			<div style={{ height: itemCount * itemSize, position: "relative" }}>
				{Array.from({ length: endIndex - startIndex + 1 }, (_, offset) => {
					const index = startIndex + offset;

					return rowRenderer({ index, style: getItemStyle(index) });
				})}
			</div>
		</div>
	);
}

export function useVirtualizedList({
	itemCount,
	itemSize,
	overScanCount = 0,
	ref,
}: {
	itemCount: number;
	itemSize: number;
	overScanCount?: number;
	ref?: React.MutableRefObject<HTMLDivElement | null>;
}) {
	const [startIndex, setStartIndex] = useState(0);
	const [endIndex, setEndIndex] = useState(0);
	const containerRef = useRef<HTMLDivElement>(null);

	let actualRef = containerRef;
	if (ref !== undefined) {
		actualRef = ref;
	}

	const actualContainerElement = actualRef.current;

	const updateVisibleItems = useCallback(() => {
		if (!actualContainerElement) {
			return;
		}

		const { scrollTop, clientHeight } = actualContainerElement;

		let startIndex = Math.floor(scrollTop / itemSize) - overScanCount;

		if (startIndex < 0) {
			startIndex = 0;
		}

		// Prevent the element change their look based on if they're odd or even.
		// Make the lower boundary always even number to preserve the odd-even order
		// when scrolling. Even position is becase zero is even, so when the start of the
		// list is visible, the order is still preserved.
		if (startIndex % 2 !== 0) {
			startIndex = startIndex - 1;
		}

		const endIndex = Math.min(
			itemCount - 1,
			Math.ceil((scrollTop + clientHeight) / itemSize) + overScanCount - 1,
		);

		setStartIndex(startIndex);
		setEndIndex(endIndex);
	}, [actualContainerElement, itemCount, itemSize, overScanCount]);

	useGranularEffect(
		() => {
			// Initial calculation
			updateVisibleItems();

			function handleScroll() {
				if (overScanCount < itemCount) {
					updateVisibleItems();
				}
			}

			actualContainerElement?.addEventListener("scroll", handleScroll);

			return () => {
				actualContainerElement?.removeEventListener("scroll", handleScroll);
			};
		},
		[
			itemCount,
			itemSize,
			overScanCount,
			actualContainerElement,
			updateVisibleItems,
		],
		[],
	);

	useEffect(() => {
		// lock element in closure
		const element = actualContainerElement;

		if (element === null) {
			return undefined;
		}

		const resizeObserver = new ResizeObserver(updateVisibleItems);

		resizeObserver.observe(element);

		return () => {
			resizeObserver.unobserve(element);
		};
	}, [actualContainerElement, updateVisibleItems]);

	const getItemStyle = useCallback(
		(index: number): React.CSSProperties => ({
			position: "absolute",
			top: index * itemSize,
			height: itemSize,
			boxSizing: "border-box",
			width: "100%",
		}),
		[itemSize],
	);

	return {
		startIndex,
		endIndex,
		containerRef: ref !== undefined ? ref : containerRef,
		getItemStyle,
	};
}
