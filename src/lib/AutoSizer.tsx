import React, { Component, type HTMLAttributes, type ReactNode } from 'react';

type ResizeHandler = (element: HTMLElement, onResize: () => void) => void;

interface DetectElementResize {
  addResizeListener: ResizeHandler;
  removeResizeListener: ResizeHandler;
}

export interface HorizontalSize {
  width: number;
  scaledWidth: number;
}

export interface VerticalSize {
  height: number;
  scaledHeight: number;
}

export type Size = HorizontalSize & VerticalSize;

export interface BaseProps extends HTMLAttributes<HTMLDivElement> {
  doNotBailOutOnEmptyChildren?: boolean | undefined;
  nonce?: string | undefined;
  tagName?: string | undefined;
  style?: React.CSSProperties | undefined;
}

export type HeightOnlyProps = BaseProps & {
  children: (size: VerticalSize) => ReactNode;
  defaultHeight?: number | undefined;
  disableHeight?: false | undefined;
  disableWidth: true;
  onResize?: (size: VerticalSize) => void;
};

export type WidthOnlyProps = BaseProps & {
  children: (size: HorizontalSize) => ReactNode;
  defaultWidth?: number | undefined;
  disableHeight: true;
  disableWidth?: false | undefined;
  onResize?: (size: HorizontalSize) => void;
};

export type HeightAndWidthProps = BaseProps & {
  children: (size: Size) => ReactNode;
  defaultHeight?: number | undefined;
  defaultWidth?: number | undefined;
  disableHeight?: false | undefined;
  disableWidth?: false | undefined;
  onResize?: (size: Size) => void;
};

export type AutoSizerProps = HeightOnlyProps | WidthOnlyProps | HeightAndWidthProps;

export interface AutoSizerState {
  height: number;
  scaledHeight: number;
  scaledWidth: number;
  width: number;
}

const windowObject = window;

const TIMEOUT_DURATION = 20;

const clearTimeoutFn = windowObject.clearTimeout;
const setTimeoutFn = windowObject.setTimeout;

const cancelAnimationFrameFn = windowObject.cancelAnimationFrame;

const requestAnimationFrameFn = windowObject.requestAnimationFrame;

/** A scheduled frame: the animation frame id, and the timeout that guards it. */
type FrameHandle = readonly [animationFrameID: number, timeoutID: number];

interface FrameScheduler {
  /** Schedules `callback` for the next frame, returning a handle `cancelFrame` understands. */
  requestFrame: (callback: () => void) => FrameHandle;
  /** Cancels a scheduled frame, whether it is still waiting for its frame or for its timeout. */
  cancelFrame: (handle: FrameHandle) => void;
}

/**
 * Builds the frame scheduler.
 *
 * Two environments have to be handled and they fail in opposite ways. One has no animation frames at
 * all, so a timeout is the only thing left. The other *does* have them and is the harder case: under
 * Chrome's "Throttle non-visible cross-origin iframes" flag an animation frame can simply never be
 * called, so the callback is scheduled both ways and whichever arrives first wins. That is why a
 * handle carries two ids and why cancelling has to undo both.
 */
function createFrameScheduler(): FrameScheduler {
  if (cancelAnimationFrameFn == null || requestAnimationFrameFn == null) {
    return {
      cancelFrame: ([, timeoutID]) => {
        clearTimeoutFn(timeoutID);
      },
      requestFrame: (callback) => [0, setTimeoutFn(callback, TIMEOUT_DURATION)],
    };
  }

  return {
    cancelFrame: ([animationFrameID, timeoutID]) => {
      cancelAnimationFrameFn(animationFrameID);
      clearTimeoutFn(timeoutID);
    },
    requestFrame: (callback) => {
      // The frame can be called before `timeoutID` is assigned, so the animation frame callback
      // closes over the variable rather than the value it will hold.
      let timeoutID = 0;

      const animationFrameID = requestAnimationFrameFn(() => {
        clearTimeoutFn(timeoutID);
        callback();
      });

      timeoutID = setTimeoutFn(() => {
        cancelAnimationFrameFn(animationFrameID);
        callback();
      }, TIMEOUT_DURATION);

      return [animationFrameID, timeoutID];
    },
  };
}

/**
 * The size of a parent element with its padding taken out, in both scales.
 *
 * `height`/`width` come from `offsetHeight`/`offsetWidth`, which are whole pixels and already
 * include the padding. `scaledHeight`/`scaledWidth` come from `getBoundingClientRect`, which
 * includes the border as well and answers in fractional pixels, so a caller can position a
 * transformed child against it. Padding is a computed style rather than a measured offset because
 * that is the only way to learn it for an element whose padding is a percentage.
 */
function measureSizeWithinPadding(parentNode: HTMLElement): Size {
  const style = window.getComputedStyle(parentNode) || {};
  const paddingLeft = parseFloat(style.paddingLeft || '0');
  const paddingRight = parseFloat(style.paddingRight || '0');
  const paddingTop = parseFloat(style.paddingTop || '0');
  const paddingBottom = parseFloat(style.paddingBottom || '0');

  const rect = parentNode.getBoundingClientRect();

  return {
    height: parentNode.offsetHeight - paddingTop - paddingBottom,
    width: parentNode.offsetWidth - paddingLeft - paddingRight,
    scaledHeight: rect.height - paddingTop - paddingBottom,
    scaledWidth: rect.width - paddingLeft - paddingRight,
  };
}

/**
 * Whether a measurement is a change the caller should hear about.
 *
 * An axis that is disabled is never a change, which is how a caller asks for a height and leaves
 * the width to something else. The comparison is on every field rather than on the axis as a whole
 * because the two scales can move independently: a fractional scale change from a CSS transform is
 * a real resize even when the whole-pixel size has not moved.
 */
function hasSizeChanged(
  current: Size,
  measured: Size,
  disableHeight: boolean | undefined,
  disableWidth: boolean | undefined,
): boolean {
  const heightChanged =
    !disableHeight &&
    (current.height !== measured.height || current.scaledHeight !== measured.scaledHeight);
  const widthChanged =
    !disableWidth &&
    (current.width !== measured.width || current.scaledWidth !== measured.scaledWidth);

  return heightChanged || widthChanged;
}

/** The name of the animation that reports an element being re-attached without resizing. */
const RESIZE_ANIMATION_NAME = 'resizeanim';

const { requestFrame, cancelFrame } = createFrameScheduler();

/** How a browser spells the CSS animation a re-attached element is detected by. */
interface CssAnimationSupport {
  /** The `animationstart` event as this browser names it, which the prefixed ones do not match. */
  readonly animationStartEvent: string;
  /** The vendor prefix to write into `@keyframes` and `animation`, empty for the standard spelling. */
  readonly keyframePrefix: string;
}

/**
 * Which spelling of a CSS animation this browser understands.
 *
 * The detection needs the animation at all, because an element that is detached and re-attached
 * without changing its size does not fire `ResizeObserver`, and restarting a one-millisecond
 * animation is the only thing that reports it. Prefixes are tried in turn because a browser that
 * supports animations under a vendor prefix does not necessarily support the unprefixed property
 * it is tested for first.
 *
 * Prefixes are paired with the event each one reports rather than kept as two parallel lists
 * indexed by position, because a prefix and its event have to agree and nothing else here keeps
 * them in step.
 */
function detectCssAnimationSupport(): CssAnimationSupport {
  const prefixesWithEvents: ReadonlyArray<readonly [prefix: string, event: string]> = [
    ['Webkit', 'webkitAnimationStart'],
    ['Moz', 'animationstart'],
    ['O', 'oAnimationStart'],
    ['ms', 'MSAnimationStart'],
  ];

  const probe = document.createElement('fakeelement');

  if (probe.style.animationName !== undefined) {
    return { animationStartEvent: 'animationstart', keyframePrefix: '' };
  }

  for (const [prefix, event] of prefixesWithEvents) {
    // The prefixed property is not in the style type for every prefix this probes.
    // @ts-expect-error
    if (probe.style[`${prefix}AnimationName`] !== undefined) {
      return { animationStartEvent: event, keyframePrefix: `-${prefix.toLowerCase()}-` };
    }
  }

  // No animation support at all: the standard event name is still what a listener can be bound to,
  // and the CSS below it is simply inert.
  return { animationStartEvent: 'animationstart', keyframePrefix: '' };
}

function createDetectElementResize(nonce?: string): DetectElementResize {
  let animationKeyframes: string;
  let animationStartEvent: string;
  let animationStyle: string;

  // biome-ignore lint: lint/suspicious/noExplicitAny
  let checkTriggers: (arg0: any) => any;
  // biome-ignore lint: lint/suspicious/noExplicitAny
  let resetTriggers: (element: any) => void;
  // biome-ignore lint: lint/suspicious/noExplicitAny
  let scrollListener: (e: any) => void;

  // @ts-expect-error
  const attachEvent = typeof document !== 'undefined' && document.attachEvent;

  if (!attachEvent) {
    resetTriggers = (element) => {
      const triggers = element.__resizeTriggers__;
      const expand = triggers.firstElementChild;
      const contract = triggers.lastElementChild;
      const expandChild = expand.firstElementChild;

      contract.scrollLeft = contract.scrollWidth;
      contract.scrollTop = contract.scrollHeight;
      expandChild.style.width = `${expand.offsetWidth + 1}px`;
      expandChild.style.height = `${expand.offsetHeight + 1}px`;
      expand.scrollLeft = expand.scrollWidth;
      expand.scrollTop = expand.scrollHeight;
    };

    checkTriggers = (element) =>
      element.offsetWidth !== element.__resizeLast__.width ||
      element.offsetHeight !== element.__resizeLast__.height;

    scrollListener = (e) => {
      // Don't measure (which forces) reflow for scrolls that happen inside of children!
      if (
        e.target.className &&
        typeof e.target.className.indexOf === 'function' &&
        !e.target.className.includes('contract-trigger') &&
        !e.target.className.includes('expand-trigger')
      ) {
        return;
      }

      const element = e?.currentTarget;

      resetTriggers(element);
      if (element.__resizeRAF__ !== undefined) {
        cancelFrame(element.__resizeRAF__);
      }
      element.__resizeRAF__ = requestFrame(() => {
        if (checkTriggers(element)) {
          element.__resizeLast__.width = element.offsetWidth;
          element.__resizeLast__.height = element.offsetHeight;
          // The listeners are this module's own bookkeeping on the element. `element` is `any`
          // because `scrollListener` takes an `any`, so the list is annotated rather than inferred,
          // and the listeners are invoked with the element as their receiver.
          const listeners: Array<(this: HTMLElement, e: Event) => void> =
            element.__resizeListeners__;
          for (const listener of listeners) {
            listener.call(element, e);
          }
        }
      });
    };

    const support = detectCssAnimationSupport();

    animationStartEvent = support.animationStartEvent;
    animationKeyframes = `@${support.keyframePrefix}keyframes ${RESIZE_ANIMATION_NAME} { from { opacity: 0; } to { opacity: 0; } } `;
    animationStyle = `${support.keyframePrefix}animation: 1ms ${RESIZE_ANIMATION_NAME}; `;
  }

  // biome-ignore lint: lint/suspicious/noExplicitAny
  const createStyles = (doc: any) => {
    if (!doc.querySelector('#detectElementResize')) {
      // Opacity:0 works around a chrome bug https://code.google.com/p/chromium/issues/detail?id=286360
      const css =
        `${animationKeyframes ? animationKeyframes : ''}.resize-triggers { ${
          animationStyle ? animationStyle : ''
        }visibility: hidden; opacity: 0; } ` +
        '.resize-triggers, .resize-triggers > div, .contract-trigger:before { content: " "; display: block; position: absolute; top: 0; left: 0; height: 100%; width: 100%; overflow: hidden; z-index: -1; } .resize-triggers > div { background: #eee; overflow: auto; } .contract-trigger:before { width: 200%; height: 200%; }';
      const head = doc.head || doc.querySelectorAll('head')[0];
      const style = doc.createElement('style');

      style.id = 'detectElementResize';
      style.type = 'text/css';

      if (nonce != null) {
        style.setAttribute('nonce', nonce);
      }

      if (style.styleSheet) {
        style.styleSheet.cssText = css;
      } else {
        style.appendChild(doc.createTextNode(css));
      }

      head.appendChild(style);
    }
  };

  // biome-ignore lint: lint/suspicious/noExplicitAny
  const addResizeListener = (element: any, fn: any) => {
    if (attachEvent) {
      element.attachEvent('onresize', fn);
    } else {
      if (!element.__resizeTriggers__) {
        const doc = element.ownerDocument;
        const elementStyle = windowObject.getComputedStyle(element);

        if (elementStyle && elementStyle.position === 'static') {
          element.style.position = 'relative';
        }
        createStyles(doc);
        element.__resizeLast__ = {};
        element.__resizeListeners__ = [];
        element.__resizeTriggers__ = doc.createElement('div');
        element.__resizeTriggers__.className = 'resize-triggers';

        const expandTrigger = doc.createElement('div');

        expandTrigger.className = 'expand-trigger';
        expandTrigger.appendChild(doc.createElement('div'));

        const contractTrigger = doc.createElement('div');

        contractTrigger.className = 'contract-trigger';
        element.__resizeTriggers__.appendChild(expandTrigger);
        element.__resizeTriggers__.appendChild(contractTrigger);
        element.appendChild(element.__resizeTriggers__);
        resetTriggers(element);
        element.addEventListener('scroll', scrollListener, true);

        /* Listen for a css animation to detect element display/re-attach */
        if (animationStartEvent) {
          element.__resizeTriggers__.__animationListener__ = (e: { animationName: string }) => {
            if (e.animationName === RESIZE_ANIMATION_NAME) {
              resetTriggers(element);
            }
          };
          element.__resizeTriggers__.addEventListener(
            animationStartEvent,
            element.__resizeTriggers__.__animationListener__,
          );
        }
      }
      element.__resizeListeners__.push(fn);
    }
  };

  // biome-ignore lint: lint/suspicious/noExplicitAny
  const removeResizeListener = (element: any, fn: any) => {
    if (attachEvent) {
      element.detachEvent('onresize', fn);
    } else {
      element.__resizeListeners__.splice(element.__resizeListeners__.indexOf(fn), 1);
      if (!element.__resizeListeners__.length) {
        element.removeEventListener('scroll', scrollListener, true);
        if (element.__resizeTriggers__.__animationListener__) {
          element.__resizeTriggers__.removeEventListener(
            animationStartEvent,
            element.__resizeTriggers__.__animationListener__,
          );
          element.__resizeTriggers__.__animationListener__ = null;
        }
        try {
          element.__resizeTriggers__ = !element.removeChild(element.__resizeTriggers__);
        } catch {
          // Preact compat; see developit/preact-compat/issues/228
        }
      }
    }
  };

  return {
    addResizeListener,
    removeResizeListener,
  };
}

export class AutoSizer extends Component<AutoSizerProps, AutoSizerState> {
  public override state: AutoSizerState = {
    height: (this.props as HeightAndWidthProps).defaultHeight || 0,
    scaledHeight: (this.props as HeightAndWidthProps).defaultHeight || 0,
    scaledWidth: (this.props as HeightAndWidthProps).defaultWidth || 0,
    width: (this.props as HeightAndWidthProps).defaultWidth || 0,
  };

  private autoSizer: HTMLElement | null = null;
  private detectElementResize: DetectElementResize | null = null;
  private parentNode: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  public override componentDidMount() {
    const { nonce } = this.props;
    const parentNode = this.autoSizer ? this.autoSizer.parentNode : null;

    if (
      parentNode?.ownerDocument?.defaultView &&
      parentNode instanceof parentNode.ownerDocument.defaultView.HTMLElement
    ) {
      // Delay access of parentNode until mount.
      // This handles edge-cases where the component has already been unmounted before its ref has been set,
      // As well as libraries like react-lite which have a slightly different lifecycle.
      this.parentNode = parentNode;

      // Use ResizeObserver from the same context where parentNode (which we will observe) was defined
      // Using just global can result into onResize events not being emitted in cases with multiple realms
      const ResizeObserverInstance = parentNode.ownerDocument.defaultView.ResizeObserver;

      if (ResizeObserverInstance != null) {
        this.resizeObserver = new ResizeObserverInstance(() => {
          // Guard against "ResizeObserver loop limit exceeded" error;
          // could be triggered if the state update causes the ResizeObserver handler to run long.
          // See https://github.com/bvaughn/react-virtualized-auto-sizer/issues/55
          this.timeoutId = setTimeout(this.onResize, 0);
        });
        this.resizeObserver.observe(parentNode);
      } else {
        // Defer requiring resize handler in order to support server-side rendering.
        // See issue #41
        this.detectElementResize = createDetectElementResize(nonce);
        this.detectElementResize.addResizeListener(parentNode, this.onResize);
      }

      this.onResize();
    }
  }

  public override componentWillUnmount() {
    if (this.parentNode) {
      if (this.detectElementResize) {
        this.detectElementResize.removeResizeListener(this.parentNode, this.onResize);
      }

      if (this.timeoutId !== null) {
        clearTimeout(this.timeoutId);
      }

      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
      }
    }
  }

  public override render(): ReactNode {
    const {
      children,
      disableHeight = false,
      disableWidth = false,
      doNotBailOutOnEmptyChildren = false,
      style = {},
      tagName = 'div',
      ...rest
    } = this.props as HeightAndWidthProps;

    const { height, scaledHeight, scaledWidth, width } = this.state;

    // Outer div should not force width/height since that may prevent containers from shrinking.
    // Inner component should overflow and use calculated width/height.
    // See issue #68 for more information.
    const outerStyle: React.CSSProperties = { overflow: 'visible' };
    const childParams: Partial<Size> = {};

    // Avoid rendering children before the initial measurements have been collected.
    // At best this would just be wasting cycles.
    let bailoutOnChildren = false;

    if (!disableHeight) {
      if (height === 0) {
        bailoutOnChildren = true;
      }
      outerStyle.height = 0;
      childParams.height = height;
      childParams.scaledHeight = scaledHeight;
    }

    if (!disableWidth) {
      if (width === 0) {
        bailoutOnChildren = true;
      }
      outerStyle.width = 0;
      childParams.width = width;
      childParams.scaledWidth = scaledWidth;
    }

    if (doNotBailOutOnEmptyChildren) {
      bailoutOnChildren = false;
    }

    return React.createElement(
      tagName,
      {
        ref: this.setRef,
        style: {
          ...outerStyle,
          ...style,
        },
        ...rest,
      },
      !bailoutOnChildren && children(childParams as Size),
    );
  }

  private onResize = () => {
    this.timeoutId = null;

    const { disableHeight, disableWidth, onResize } = this.props as HeightAndWidthProps;
    const { parentNode } = this;

    if (parentNode === null) {
      return;
    }

    // Guard against AutoSizer component being removed from the DOM immediately after being added.
    // This can result in invalid style values which can result in NaN values if we don't handle
    // them. See issue #150 for more context.
    const size = measureSizeWithinPadding(parentNode);

    if (hasSizeChanged(this.state, size, disableHeight, disableWidth)) {
      this.setState(size);

      if (typeof onResize === 'function') {
        onResize(size);
      }
    }
  };

  private setRef = (autoSizer: HTMLElement | null) => {
    this.autoSizer = autoSizer;
  };
}
