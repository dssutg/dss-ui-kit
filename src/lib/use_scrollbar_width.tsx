import { useEffect, useState } from "react";

export function useScrollbarWidth() {
	const [scrollbarWidth, setScrollbarWidth] = useState(0);

	useEffect(() => {
		const measureScrollbarWidth = () => {
			setScrollbarWidth(getScrollbarWidth());
		};

		measureScrollbarWidth();

		// Handle window resize
		window.addEventListener("resize", measureScrollbarWidth);

		return () => window.removeEventListener("resize", measureScrollbarWidth);
	}, []);

	return scrollbarWidth;
}

// Get up-to-date scrollbar width. Scrollbar width is useful to adjust CSS styles
export function getScrollbarWidth() {
	const div = document.createElement("div");
	div.style.overflow = "scroll"; // force scrollbar
	div.style.width = "100px";
	div.style.height = "100px";
	document.body.appendChild(div);

	const inner = document.createElement("div");
	inner.style.width = "100%";
	inner.style.height = "100%";
	div.appendChild(inner);

	const width = div.offsetWidth - inner.offsetWidth;

	div.remove();

	return width;
}
