import { useEffect, useRef } from "react";

// For setInterval
export function useInterval(
	callback: () => void,
	delay: number | null,
	deps?: unknown[],
) {
	const savedCallback = useRef<() => void>();

	// Store the latest callback
	useEffect(() => {
		savedCallback.current = callback;
	}, [callback, ...(deps ?? [])]);

	// Set up the interval
	useEffect(() => {
		function tick() {
			if (savedCallback.current) {
				savedCallback.current();
			}
		}

		if (delay !== null) {
			const id = setInterval(tick, delay);

			return () => clearInterval(id);
		}

		return undefined;
	}, [delay, ...(deps ?? [])]);
}

export function useImmediateInterval(
	callback: () => void,
	delay: number | null,
	deps?: unknown[],
) {
	const savedCallback = useRef<() => void>();

	// Store the latest callback
	useEffect(() => {
		savedCallback.current = callback;
	}, [callback, ...(deps ?? [])]);

	// Set up the interval
	useEffect(() => {
		function tick() {
			if (savedCallback.current) {
				savedCallback.current();
			}
		}

		if (delay !== null) {
			tick(); // call the tick immediately

			const id = setInterval(tick, delay);

			return () => clearInterval(id);
		}

		return undefined;
	}, [delay, ...(deps ?? [])]);
}
