let isTabActive = true;

document.addEventListener("visibilitychange", () => {
	isTabActive = !document.hidden;
});

export function isAppTabActive() {
	return isTabActive;
}
