import { useState } from "react";
import { emitTypedEvent, useTypedEvent } from "@/event";

export function useTheme() {
	const [theme, setTheme] = useState<ThemeName>(getCurrentTheme());

	useTypedEvent("THEME_CHANGED", ({ themeName }) => {
		setTheme(themeName);
	});

	return theme;
}

export const allThemeNames = [
	"dark",
	"light",
	"acme",
	"indigo",
	"purple",
] as const;

export type ThemeName = (typeof allThemeNames)[number];

export const themes: { name: ThemeName; tileColor: string }[] = [
	{ name: "dark", tileColor: "#222222" },
	{ name: "light", tileColor: "#dedede" },
	{ name: "acme", tileColor: "#ffffea" },
	{ name: "indigo", tileColor: "#6b67bb" },
	{ name: "purple", tileColor: "#a967bb" },
];

export function isThemeName(name: string): name is ThemeName {
	return new Set<string>(allThemeNames).has(name);
}

export function getCurrentTheme(): ThemeName {
	const name =
		localStorage.getItem("currentTheme") ??
		document.body.getAttribute("data-theme") ??
		"dark";

	if (isThemeName(name)) {
		return name;
	}

	return allThemeNames[0];
}

export function setTheme(themeName: ThemeName) {
	document.body.setAttribute("data-theme", themeName);
	localStorage.setItem("currentTheme", themeName);
	emitTypedEvent("THEME_CHANGED", { themeName });
}
