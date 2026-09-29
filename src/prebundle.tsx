// This script is executed before the main app code to initialize necessary
// globals and polyfills for older browsers that this project is required to
// support. As a result, it shall not import anything from the bundle code.
import { DEBUG } from "@/debug_mode";

// Polyfills

if (typeof globalThis === "undefined") {
	(window as unknown as Record<string, unknown>).globalThis = window;
}

if (typeof Object.fromEntries !== "function") {
	// @ts-expect-error
	Object.fromEntries = (iterable: unknown[]) => {
		const obj = {} as Record<string, unknown>;

		for (let i = 0; i < iterable.length; i++) {
			const entry = iterable[i] as [string, unknown];

			if (entry && typeof entry === "object" && entry.length === 2) {
				const key = entry[0]!;
				const value = entry[1];

				obj[key] = value;
			}
		}

		return obj;
	};
}

if (typeof Array.prototype.toReversed !== "function") {
	Array.prototype.toReversed = function () {
		return [...this].reverse();
	};
}

if (typeof Array.prototype.toSorted !== "function") {
	Array.prototype.toSorted = function (compareFn) {
		return [...this].sort(compareFn);
	};
}

if (typeof Array.prototype.toSpliced !== "function") {
	Array.prototype.toSpliced = (start, deleteCount, ...items) => {
		// @ts-expect-error
		const newArray = [...this];
		newArray.splice(start, deleteCount!, ...items);
		return newArray;
	};
}

if (typeof Array.prototype.flat !== "function") {
	// @ts-expect-error
	Array.prototype.flat = (depth = 1) => {
		let d = 0;
		if (Math.floor(depth) >= 0) {
			d = Math.floor(depth);
		}

		// @ts-expect-error
		function flatten(arr, depth) {
			if (depth === 0) {
				return arr.slice();
			}
			const acc = [];
			for (const val of arr) {
				if (Array.isArray(val)) {
					acc.push(...flatten(val, depth - 1));
				} else {
					acc.push(val);
				}
			}
			return acc;
		}

		return flatten(this, d);
	};
}

if (typeof Object.hasOwn !== "function") {
	Object.defineProperty(Object, "hasOwn", {
		// @ts-expect-error
		value: function hasOwn(obj, prop) {
			if (obj == null) {
				// null or undefined
				throw new TypeError("Cannot convert undefined or null to object");
			}
			// Accept symbols and other keys - use hasOwnProperty from Object.prototype
			return Object.hasOwn(Object(obj), prop);
		},
		writable: true,
		configurable: true,
		enumerable: false,
	});
}

if (typeof window !== "undefined" && !("ResizeObserver" in window)) {
	interface Size {
		width: number;
		height: number;
	}

	interface ROEntry {
		target: Element;
		contentRect: Size;
	}

	type ROCallback = (entries: ROEntry[], observer: ResizeObserverLike) => void;

	interface ResizeObserverLike {
		observe(el: Element): void;
		unobserve(el: Element): void;
		disconnect(): void;
	}

	function createObserver(callback: ROCallback): ResizeObserverLike {
		const observed = new Map<Element, Size>();
		let running = false;
		let rafId: number | ReturnType<typeof setTimeout> | null = null;
		const pollInterval = 200;

		function gatherChanges(): ROEntry[] {
			const entries: ROEntry[] = [];

			observed.forEach((last, el) => {
				// biome-ignore lint/complexity/useOptionalChain: explicit null checks keep the polyfill behavior clear
				if (!el || !el.ownerDocument) {
					observed.delete(el);
					return;
				}

				const r = el.getBoundingClientRect();

				const size: Size = { width: r.width, height: r.height };

				if (!last || last.width !== size.width || last.height !== size.height) {
					observed.set(el, size);
					entries.push({ target: el, contentRect: size });
				}
			});

			return entries;
		}

		function tick(): void {
			running = true;

			const entries = gatherChanges();

			if (entries.length) {
				try {
					callback(entries, instance);
				} catch (e) {
					setTimeout(() => {
						throw e;
					});
				}
			}

			if (typeof window.requestAnimationFrame === "function") {
				rafId = window.requestAnimationFrame(tick);
			} else {
				rafId = setTimeout(tick, pollInterval);
			}
		}

		function start(): void {
			if (running) {
				return;
			}

			running = true;

			if (typeof window.requestAnimationFrame === "function") {
				rafId = window.requestAnimationFrame(tick);
			} else {
				rafId = setTimeout(tick, pollInterval);
			}
		}

		function stop(): void {
			running = false;

			if (
				typeof window.cancelAnimationFrame === "function" &&
				typeof rafId === "number"
			) {
				window.cancelAnimationFrame(rafId);
			} else if (rafId != null) {
				clearTimeout(rafId as ReturnType<typeof setTimeout>);
			}

			rafId = null;
		}

		const instance: ResizeObserverLike = {
			observe(el: Element) {
				// biome-ignore lint/complexity/useOptionalChain: explicit null check is intentional here
				if (!el || el.nodeType !== 1) {
					return;
				}
				if (!observed.has(el)) {
					const r = el.getBoundingClientRect();
					observed.set(el, { width: r.width, height: r.height });
				}
				start();
			},

			unobserve(el: Element) {
				observed.delete(el);
				if (observed.size === 0) {
					stop();
				}
			},

			disconnect() {
				observed.clear();
				stop();
			},
		};

		return instance;
	}

	// proper constructor so `new ResizeObserver(cb)` works
	// biome-ignore lint: lint/suspicious/noExplicitAny
	const ROConstructor = function (this: any, cb: ROCallback) {
		if (!(this instanceof ROConstructor)) {
			// biome-ignore lint: lint/suspicious/noExplicitAny
			return new (ROConstructor as any)(cb);
		}

		if (typeof cb !== "function") {
			throw new TypeError("ResizeObserver callback must be a function");
		}

		const inner = createObserver(cb);

		// copy methods to `this` so instance behaves like native
		this.observe = inner.observe;
		this.unobserve = inner.unobserve;
		this.disconnect = inner.disconnect;
	} as unknown as { new (cb: ROCallback): ResizeObserverLike };

	// set prototype methods (optional, helps instanceof and method lookup)
	ROConstructor.prototype = {
		observe() {},
		unobserve() {},
		disconnect() {},
	};

	(window as unknown as Record<string, unknown>).ResizeObserver = ROConstructor;
}

const global = window as unknown as {
	WS_URI: string;
	SERVER_TYPE: string;
};

// BCP HTTP server replaces this pattern in WS_URI with an actual URI.
// This variable needs to be initialized BEFORE the main bundle is loaded.
// Interpolation quotes are used because the web server might inject a
// multi-line string.
global.WS_URI = `ws://xxx.xxx.xxx.xxx:pppp`.replace(/\s+/g, "");

// server replaces this pattern to make the frontend code switch
// to the the server panel.
global.SERVER_TYPE = "__SERVER_TYPE__";

if (DEBUG) {
	global.SERVER_TYPE = original application;
}
