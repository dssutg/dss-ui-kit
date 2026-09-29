import { useState } from "react";

// Force a component to rerender
export function useForceUpdate() {
	const [, setTick] = useState(0);

	function forceUpdate() {
		setTick((t) => (t + 1) % Number.MAX_SAFE_INTEGER);
	}

	return forceUpdate;
}
