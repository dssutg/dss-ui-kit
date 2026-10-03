/**
 * The browser APIs jsdom does not implement, stubbed for the tests that need them.
 *
 * jsdom implements the DOM but not layout and not the observers built on layout, so a component that
 * measures itself renders nothing in a test and nowhere else. That is worth stubbing here rather than
 * in each test file: the stub is part of the environment, and a test file that has to install it is a
 * test file whose subject is its own setup.
 *
 * The measurements are fixed, which is the point. A test asserts on what a component rendered, and a
 * stub whose numbers changed per call would make that depend on how many times it was asked. A test
 * that needs a particular size gets it from the component's own props, which is where a size belongs.
 *
 * Everything here is guarded on `typeof window`, so the repository-policy tests — which run in node,
 * where a `window` would be the wrong thing to touch — load this file and do nothing with it.
 */

/** The size every measured element reports. Wide enough for a table and tall enough for a list. */
const STUBBED_WIDTH = 1024;
const STUBBED_HEIGHT = 768;

/** A `DOMRectReadOnly` of the stubbed size, at the origin. */
function stubbedRect(): DOMRect {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: STUBBED_WIDTH,
    bottom: STUBBED_HEIGHT,
    width: STUBBED_WIDTH,
    height: STUBBED_HEIGHT,
    toJSON: () => ({}),
  } as DOMRect;
}

/** The part of `ResizeObserver` a component uses: construct it, observe, disconnect. */
interface ResizeObserverLike {
  observe(target: Element): void;
  unobserve(target: Element): void;
  disconnect(): void;
}

/**
 * An observer that reports the stubbed size once, on a microtask.
 *
 * Once, because that is what a first layout pass is, and on a microtask because delivering a
 * notification from inside `observe` would re-enter the component that is still mounting.
 */
function installResizeObserver(): void {
  if (typeof window.ResizeObserver === 'function') {
    return;
  }

  class StubResizeObserver implements ResizeObserverLike {
    private readonly callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe(target: Element): void {
      queueMicrotask(() => {
        // The observer is handed back to its own callback because the real one does that, and a
        // component that re-observes from inside the callback relies on being able to.
        const observer = this as unknown as ResizeObserver;

        const entry = {
          target,
          contentRect: stubbedRect(),
          borderBoxSize: [{ inlineSize: STUBBED_WIDTH, blockSize: STUBBED_HEIGHT }],
          contentBoxSize: [{ inlineSize: STUBBED_WIDTH, blockSize: STUBBED_HEIGHT }],
          devicePixelContentBoxSize: [{ inlineSize: STUBBED_WIDTH, blockSize: STUBBED_HEIGHT }],
        } as unknown as ResizeObserverEntry;

        this.callback([entry], observer);
      });
    }

    unobserve(): void {
      // Nothing was retained, so there is nothing to stop reporting for.
    }

    disconnect(): void {
      // Nothing was retained, so there is nothing to stop reporting for.
    }
  }

  window.ResizeObserver = StubResizeObserver as unknown as typeof ResizeObserver;
}

/**
 * jsdom reports every element as zero-sized, so a component that sizes itself from `clientHeight`
 * decides it has no room and renders an empty container.
 *
 * The properties are defined on `HTMLElement` rather than on `Element`, because that is where jsdom
 * defines them too: a getter installed on the base class is shadowed by jsdom's own and never read.
 */
function installElementSizes(): void {
  const sizes: ReadonlyArray<readonly [property: string, value: number]> = [
    ['clientWidth', STUBBED_WIDTH],
    ['clientHeight', STUBBED_HEIGHT],
    ['offsetWidth', STUBBED_WIDTH],
    ['offsetHeight', STUBBED_HEIGHT],
  ];

  for (const [property, value] of sizes) {
    Object.defineProperty(window.HTMLElement.prototype, property, {
      configurable: true,
      get: () => value,
    });
  }

  window.Element.prototype.getBoundingClientRect = stubbedRect;
  window.Element.prototype.scrollIntoView = () => undefined;
}

/**
 * jsdom has no `matchMedia`, which the components reach for when they ask about motion or a colour
 * scheme. Everything is reported as not matching, which keeps a test deterministic: nothing is
 * animating and nothing is being announced as running.
 */
function installMatchMedia(): void {
  if (typeof window.matchMedia === 'function') {
    return;
  }

  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

if (typeof window !== 'undefined') {
  installResizeObserver();
  installElementSizes();
  installMatchMedia();
}
