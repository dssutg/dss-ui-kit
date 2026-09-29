export interface KeyMapHandler<A> {
	action: A;
}

export type KeyMap<A> = Readonly<Record<string, KeyMapHandler<A>>>;

export type KeyMapActions<A extends string> = Readonly<Record<A, () => void>>;

export function getKeyMapEntryByAction<A>(keyMap: KeyMap<A>, action: A) {
	return Object.entries(keyMap).find(
		([, handler]) => handler.action === action,
	)!;
}

export function getKeyMapCodeAsHotkey(code: string) {
	return code
		.replace(/(Key|Digit)/, "")
		.replace(/Equal$/, "=")
		.replace(/Minus$/, "-")
		.replace(/ArrowLeft$/, "Arrow Left")
		.replace(/ArrowRight$/, "Arrow Right")
		.replace(/ArrowUp$/, "Arrow Up")
		.replace(/ArrowDown$/, "Arrow Down")
		.replace(/BracketLeft$/, "[")
		.replace(/BracketRight$/, "]");
}

export function getKeyMapHotkey<A>(keyMap: KeyMap<A>, action: A) {
	const [code] = getKeyMapEntryByAction(keyMap, action);

	return getKeyMapCodeAsHotkey(code);
}

export function handleKeyMapKeyDown<A extends string>(
	keyMap: KeyMap<A>,
	actionMap: KeyMapActions<A>,
	event: KeyboardEvent,
) {
	const { code, shiftKey } = event;

	const handler = keyMap[code];
	const shiftHandler = keyMap[`Shift+${code}`];

	if (shiftKey && shiftHandler) {
		event.preventDefault();
		event.stopPropagation();
		actionMap[shiftHandler.action]();
	} else if (handler) {
		event.preventDefault();
		event.stopPropagation();
		actionMap[handler.action]();
	}
}
