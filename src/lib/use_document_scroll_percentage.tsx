import { useCallback, useState } from "react";
import { clamp } from "@/lib/math";
import { useEventListener } from "@/lib/use_event_listener";
import { useGranularEffect } from "@/lib/use_granular_effect";

export function useDocumentScrollPercentage() {
	const [scrollPercentage, setScrollPercentage] = useState(0);

	const updateScrollPercentage = useCallback(() => {
		const container = document.documentElement;
		const scroll = window.scrollY ?? container.scrollTop ?? 0;
		const height = Math.max(1, container.scrollHeight - container.clientHeight);
		const percent = clamp((scroll * 100) / height, 0, 100);

		setScrollPercentage(percent);
	}, []);

	useEventListener("scroll", updateScrollPercentage);

	useGranularEffect(
		() => {
			updateScrollPercentage();
		},
		[],
		[updateScrollPercentage],
	);

	return scrollPercentage;
}
