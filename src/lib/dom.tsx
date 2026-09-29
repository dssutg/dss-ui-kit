import { type Point2D, clamp } from "@/lib/math";

export function inViewport(element: Readonly<HTMLElement>) {
	const { top, bottom, left, right } = element.getBoundingClientRect();

	return (
		top >= 0 &&
		left >= 0 &&
		bottom <= (window.innerHeight ?? document.documentElement.clientHeight) &&
		right <= (window.innerWidth ?? document.documentElement.clientWidth)
	);
}

export function getDpr() {
	return Math.max(1, window.devicePixelRatio || 1);
}

export async function decompressJSON(base64Str: string) {
	// Decode Base64 to ArrayBuffer
	const binaryString = atob(base64Str);
	const len = binaryString.length;
	const buffer = new Uint8Array(len);
	for (let i = 0; i < len; i++) {
		buffer[i] = binaryString.charCodeAt(i);
	}

	// Create a stream from the ArrayBuffer
	const compressedStream = new Response(buffer).body!;

	// Pipe through the gzip decompressor
	const ds = new DecompressionStream("gzip");
	const decompressedStream = compressedStream.pipeThrough(ds);

	// Read the decompressed stream as text
	const json = await new Response(decompressedStream).text();

	const result = JSON.parse(json);

	return result;
}

// Handle element dragging with mouse
export class DragHandler {
	currentCursorPosition: Point2D;
	elementToDrag: HTMLElement;
	dragTriggerElement: HTMLElement;
	onTryToDrag: () => void;
	enabled: boolean;
	isNowDrag: boolean;
	onMouseDownHandler: ((event: MouseEvent) => void) | null;
	onTouchStartHandler: ((event: TouchEvent) => void) | null;

	constructor(
		elementToDrag: HTMLElement,
		dragTriggerElement: HTMLElement,
		onTryToDrag = () => {},
	) {
		this.currentCursorPosition = { x: 0, y: 0 };

		this.elementToDrag = elementToDrag;
		this.dragTriggerElement = dragTriggerElement;

		this.dragTriggerElement.addEventListener(
			"mousedown",
			this.internalOnMouseDownHandler,
		);
		this.dragTriggerElement.addEventListener(
			"touchstart",
			this.internalOnTouchStartHandler,
		);
		this.onMouseDownHandler = null;
		this.onTouchStartHandler = null;
		document.addEventListener("touchend", this.removeTemporaryEventListeners);
		document.addEventListener(
			"touchmove",
			this.internalOnTouchHandlerMoveHandler,
		);

		this.onTryToDrag = onTryToDrag;

		this.enabled = true;

		this.isNowDrag = false;
	}

	internalOnMouseDownHandler = (event: MouseEvent) => {
		if (!this.enabled) {
			return;
		}

		if (this.onMouseDownHandler) {
			this.onMouseDownHandler(event);

			return;
		}

		event.preventDefault();

		this.currentCursorPosition = {
			x: event.clientX,
			y: event.clientY,
		};

		document.addEventListener("mouseup", this.removeTemporaryEventListeners);
		document.addEventListener("mousemove", this.internalOnMouseMoveHandler);

		this.isNowDrag = true;

		this.onTryToDrag();
	};

	internalOnTouchStartHandler = (event: TouchEvent) => {
		if (event.touches[0] === undefined) {
			return;
		}

		if (!this.enabled) {
			return;
		}

		if (this.onTouchStartHandler) {
			this.onTouchStartHandler(event);

			return;
		}

		event.preventDefault();

		this.currentCursorPosition = {
			x: event.touches[0].clientX,
			y: event.touches[0].clientY,
		};

		this.isNowDrag = true;

		this.onTryToDrag();
	};

	internalHandleMoveEvent = (event: MouseEvent | TouchEvent) => {
		if (event instanceof TouchEvent && !event.touches[0]) {
			return;
		}

		event.preventDefault();

		const currentElementToDragPosition = this.getElementToDragPosition();

		const clientX =
			event instanceof MouseEvent ? event.clientX : event.touches[0]!.clientX;
		const clientY =
			event instanceof MouseEvent ? event.clientY : event.touches[0]!.clientY;

		const deltaX = this.currentCursorPosition.x - clientX;
		const deltaY = this.currentCursorPosition.y - clientY;

		this.currentCursorPosition = { x: clientX, y: clientY };

		const newElementToDragX = currentElementToDragPosition.x - deltaX;
		const newElementToDragY = currentElementToDragPosition.y - deltaY;

		this.moveElementToDrag(newElementToDragX, newElementToDragY);
	};

	internalOnMouseMoveHandler = (event: MouseEvent) => {
		if (!this.enabled || !this.isNowDrag) {
			return;
		}
		this.internalHandleMoveEvent(event);
	};

	internalOnTouchHandlerMoveHandler = (event: TouchEvent) => {
		if (!this.enabled || !this.isNowDrag) {
			return;
		}
		this.internalHandleMoveEvent(event);
	};

	removeTemporaryEventListeners = () => {
		document.removeEventListener("mouseup", this.removeTemporaryEventListeners);
		document.removeEventListener("mousemove", this.internalOnMouseMoveHandler);
		this.isNowDrag = false;
	};

	removeAllEventListeners = () => {
		this.removeTemporaryEventListeners();
		this.dragTriggerElement.removeEventListener(
			"mousedown",
			this.internalOnMouseDownHandler,
		);
		this.dragTriggerElement.removeEventListener(
			"touchstart",
			this.internalOnTouchStartHandler,
		);
		document.removeEventListener(
			"touchend",
			this.removeTemporaryEventListeners,
		);
		document.removeEventListener(
			"touchmove",
			this.internalOnTouchHandlerMoveHandler,
		);
	};

	setEnabled = (enabled: boolean) => {
		this.enabled = enabled;
	};

	enable = () => this.setEnabled(true);
	disable = () => this.setEnabled(false);
	toggle = () => this.setEnabled(!this.enabled);

	clampPosition = (x: number, y: number) => [x, y];

	moveElementToDrag = (
		x: number,
		y: number,
		shouldCorrectIfInvalidX = false,
		shouldCorrectIfInvalidY = true,
	) => {
		const validX =
			shouldCorrectIfInvalidX && x !== undefined ? Math.max(0, x) : x;
		const validY =
			shouldCorrectIfInvalidY && y !== undefined ? Math.max(0, y) : y;

		const [clampedX, clampedY] = this.clampPosition(validX, validY);

		if (clampedY !== undefined) {
			this.elementToDrag.style.top = `${clampedY}px`;
		}
		if (clampedX !== undefined) {
			this.elementToDrag.style.left = `${clampedX}px`;
		}

		// Bottom and right should affect top and left
		this.elementToDrag.style.bottom = "auto";
		this.elementToDrag.style.right = "auto";
	};

	getElementToDragPosition = () => ({
		x: this.elementToDrag.offsetLeft,
		y: this.elementToDrag.offsetTop,
	});
}

// This function performs a tricky dance to make
// font sizes responsive depending on screen width.
export function getResponsiveSize(
	minSize = 0,
	maxSize = 0,
	growFactor = 0,
	mediaWidth = 0,
	minDesktopWidth = 1,
) {
	const size = (growFactor * mediaWidth) / minDesktopWidth;

	return clamp(size, minSize, maxSize);
}

export function hasUserFocusedInput() {
	const focusedElement = document.activeElement;

	if (!focusedElement) {
		return false;
	}

	const tag = focusedElement.tagName;

	return tag === "INPUT" || tag === "TEXTAREA";
}

export function onBackdropClick<T extends HTMLElement>(
	targetElement: T | null,
	clickEvent: MouseEvent,
	onClick: () => void,
	{
		stopPropagation = true,
	}: {
		readonly stopPropagation?: boolean;
	} = {},
) {
	if (stopPropagation) {
		clickEvent.stopPropagation();
	}

	if (targetElement) {
		const rect = targetElement.getBoundingClientRect();

		if (!DOMRectContainsPoint(rect, clickEvent.clientX, clickEvent.clientY)) {
			onClick();
		}
	}
}

export function scrollToElement(
	element: HTMLElement,
	bias: number,
	smooth: boolean,
) {
	const elementRect = element.getBoundingClientRect();
	const bodyRect = document.body.getBoundingClientRect();
	const offset = elementRect.top - bodyRect.top - bias;
	const behavior = smooth ? "smooth" : "instant";

	window.scrollTo({ top: offset, left: 0, behavior });
}

export function DOMRectContainsPoint(
	rect: Readonly<DOMRect>,
	x: number,
	y: number,
): boolean {
	return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

export function areDOMRectsEqual(rect1: DOMRect, rect2: DOMRect): boolean {
	return (
		rect1 === rect2 ||
		(rect1.left === rect2.left &&
			rect1.top === rect2.top &&
			rect1.right === rect2.right &&
			rect1.bottom === rect2.bottom &&
			rect1.width === rect2.width &&
			rect1.height === rect2.height)
	);
}

export function debounce<T extends (...arguments_: readonly unknown[]) => void>(
	function_: T,
	delay: number,
): (thisObject: unknown, ...arguments_: Parameters<T>) => void {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	return (thisObject: unknown, ...arguments_: Parameters<T>) => {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
		timeoutId = setTimeout(() => {
			function_.apply(thisObject, arguments_);
		}, delay);
	};
}

export function copyToClipboard(text: string): Promise<void> {
	function fallbackCopy(
		text: string,
		resolve: () => void,
		reject: (reason?: unknown) => void,
	) {
		const textarea = document.createElement("textarea");

		textarea.value = text;

		// Prevent scrolling to the bottom of the page in IE
		textarea.style.position = "fixed";
		// Hide the textarea
		textarea.style.opacity = "0";
		// Prevent interactions
		textarea.style.pointerEvents = "none";

		document.body.appendChild(textarea);
		textarea.focus();
		textarea.select();

		try {
			// Copy the text
			document.execCommand("copy");
			resolve();
		} catch (error) {
			reject(error);
		} finally {
			// Clean up
			textarea.remove();
		}
	}

	return new Promise((resolve, reject) => {
		// Check for the clipboard API
		if (navigator.clipboard !== undefined) {
			// Use the clipboard API if available
			navigator.clipboard
				.writeText(text)
				.then(() => resolve())
				.catch((error) => {
					console.error("Failed to copy using clipboard API: ", error);
					fallbackCopy(text, resolve, reject);
				});
		} else {
			// Fallback for older browsers and non-secure contexts
			fallbackCopy(text, resolve, reject);
		}
	});
}

export function sanitizeHTMLString(value: string) {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

export function escapeHTMLValue(value: unknown) {
	if (value === null || value === undefined) {
		return "";
	}
	if (typeof value === "boolean") {
		if (value) {
			return "true";
		}
		return "";
	}
	if (typeof value === "object") {
		if (Array.isArray(value) && value.length === 0) {
			return "";
		}
		return sanitizeHTMLString(JSON.stringify(value));
	}
	return sanitizeHTMLString(value.toString());
}

export function html(strings: TemplateStringsArray, ...values: unknown[]) {
	return strings.reduce((result, stringPart, i) => {
		const value = values[i - 1];
		const safeValue = i > 0 ? escapeHTMLValue(value) : "";
		return result + safeValue + stringPart;
	});
}

export function templ(htmlString: string) {
	const element = document.createElement("template");
	element.innerHTML = htmlString;
	return element;
}

export interface WCAttrChange {
	readonly attrName: string;
	readonly oldValue: string | null;
	readonly newValue: string | null;
}

export type EventCallback = (event: Event) => void;

export abstract class WComponent extends HTMLElement {
	private needsRender = false;

	protected static props: string[] = [];

	constructor() {
		super();
		this.attachShadow({ mode: "open" });
	}

	protected set template(templateElement: HTMLTemplateElement) {
		this.shadowRoot?.appendChild(templateElement.content.cloneNode(true));
	}

	static get observedAttributes(): string[] {
		return WComponent.props;
	}

	// New: static styles property (string or CSSStyleSheet)
	protected static styles: string | CSSStyleSheet[] = "";

	attributeChangedCallback(
		attrName: string,
		oldValue: string | null,
		newValue: string | null,
	) {
		this.onAttrChange({ attrName, oldValue, newValue });
		this.scheduleRender();
	}

	protected onAttrChange(_: WCAttrChange): void {}

	protected set shadowHTML(htmlString: string) {
		if (this.shadowRoot) {
			this.shadowRoot.innerHTML = htmlString;
		}
	}

	connectedCallback() {
		this.injectStyles();
		this.scheduleRender();
		this.onConnect();
	}

	disconnectedCallback() {
		this.onDisconnect();
	}

	protected onConnect(): void {}
	protected onDisconnect(): void {}

	private scheduleRender() {
		if (!this.needsRender) {
			this.needsRender = true;
			Promise.resolve().then(() => {
				this.needsRender = false;
				this.render();
			});
		}
	}

	// **Inject scoped styles into the shadow root**
	private injectStyles() {
		if (!this.shadowRoot) {
			return;
		}

		// Avoid reinjecting if already present
		if (this.shadowRoot.querySelector("style[data-wc-styles]")) {
			return;
		}

		const { styles } = this.constructor as typeof WComponent;
		if (typeof styles === "string") {
			const styleEl = document.createElement("style");
			styleEl.setAttribute("data-wc-styles", "");
			styleEl.textContent = styles;
			this.shadowRoot.prepend(styleEl);
		} else if (Array.isArray(styles)) {
			for (const sheet of styles) {
				if (sheet instanceof CSSStyleSheet) {
					// Adopted stylesheets (modern browsers)
					this.shadowRoot!.adoptedStyleSheets = [
						...this.shadowRoot!.adoptedStyleSheets,
						sheet,
					];
				}
			}
		}
	}

	protected render() {}

	protected el(selector: string) {
		return this.shadowRoot!.querySelector(selector);
	}

	protected on(selector: string, eventName: string, callback: EventCallback) {
		const element = this.shadowRoot!.querySelector(selector)!;

		element.addEventListener(eventName, callback.bind(this));
	}

	protected onClick(selector: string, callback: EventCallback) {
		this.on(selector, "click", callback);
	}
}
