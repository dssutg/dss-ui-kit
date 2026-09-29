import { useEffect, useState } from "react";

export const minDesktopWidth = 900;

export function useIsMobileScreen() {
	const [isMobileScreen, setIsMobileScreen] = useState(
		window.innerWidth < minDesktopWidth,
	);

	useEffect(() => {
		function handleResize() {
			setIsMobileScreen(window.innerWidth < minDesktopWidth);
		}
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	return isMobileScreen;
}
