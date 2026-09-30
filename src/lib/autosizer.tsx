import React, { Component, type HTMLAttributes, type ReactNode } from 'react';

type ResizeHandler = (element: HTMLElement, onResize: () => void) => void;

interface DetectElementResize {
  addResizeListener: ResizeHandler;
  removeResizeListener: ResizeHandler;
}

interface HorizontalSize {
  width: number;
  scaledWidth: number;
}

interface VerticalSize {
  height: number;
  scaledHeight: number;
}

type Size = HorizontalSize & VerticalSize;

interface BaseProps extends HTMLAttributes<HTMLDivElement> {
  doNotBailOutOnEmptyChildren?: boolean;
  nonce?: string;
  tagName?: string;
  style?: React.CSSProperties;
}

type HeightOnlyProps = BaseProps & {
  children: (size: VerticalSize) => ReactNode;
  defaultHeight?: number;
  disableHeight?: false;
  disableWidth: true;
  onResize?: (size: VerticalSize) => void;
};

type WidthOnlyProps = BaseProps & {
  children: (size: HorizontalSize) => ReactNode;
  defaultWidth?: number;
  disableHeight: true;
  disableWidth?: false;
  onResize?: (size: HorizontalSize) => void;
};

type HeightAndWidthProps = BaseProps & {
  children: (size: Size) => ReactNode;
  defaultHeight?: number;
  defaultWidth?: number;
  disableHeight?: false;
  disableWidth?: false;
  onResize?: (size: Size) => void;
};

type Props = HeightOnlyProps | WidthOnlyProps | HeightAndWidthProps;

interface State {
  height: number;
  scaledHeight: number;
  scaledWidth: number;
  width: number;
}

const windowObject = window;

// biome-ignore lint: lint/suspicious/noExplicitAny
let cancelFrame: (([animationFrameID, timeoutID]: [any, any]) => void) | null = null;
// biome-ignore lint: lint/suspicious/noExplicitAny
let requestFrame: ((arg0: () => void) => any) | null = null;

const TIMEOUT_DURATION = 20;

const clearTimeoutFn = windowObject.clearTimeout;
const setTimeoutFn = windowObject.setTimeout;

const cancelAnimationFrameFn = windowObject.cancelAnimationFrame;

const requestAnimationFrameFn = windowObject.requestAnimationFrame;

if (cancelAnimationFrameFn == null || requestAnimationFrameFn == null) {
  // For environments that don't support animation frame,
  // fallback to a setTimeout based approach.
  //@ts-expect-error
  cancelFrame = clearTimeoutFn;
  requestFrame = (callback) => setTimeoutFn(callback, TIMEOUT_DURATION);
} else {
  // Counter intuitively, environments that support animation frames can be trickier.
  // Chrome's "Throttle non-visible cross-origin iframes" flag can prevent rAFs from being called.
  // In this case, we should fallback to a setTimeout() implementation.
  cancelFrame = ([animationFrameID, timeoutID]) => {
    cancelAnimationFrameFn(animationFrameID);
    clearTimeoutFn(timeoutID);
  };
  requestFrame = (callback) => {
    const animationFrameID = requestAnimationFrameFn(() => {
      clearTimeoutFn(timeoutID);
      callback();
    });

    const timeoutID = setTimeoutFn(() => {
      cancelAnimationFrameFn(animationFrameID);
      callback();
    }, TIMEOUT_DURATION);

    return [animationFrameID, timeoutID];
  };
}

function createDetectElementResize(nonce?: string): DetectElementResize {
  let animationKeyframes: string;
  let animationName: string;
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
      if (element.__resizeRAF__) {
        cancelFrame!(element.__resizeRAF__);
      }
      element.__resizeRAF__ = requestFrame!(() => {
        if (checkTriggers(element)) {
          element.__resizeLast__.width = element.offsetWidth;
          element.__resizeLast__.height = element.offsetHeight;
          element.__resizeListeners__.forEach(
            // biome-ignore lint: lint/suspicious/noExplicitAny
            (fn: { call: (arg0: any, arg1: any) => void }) => {
              fn.call(element, e);
            },
          );
        }
      });
    };

    /* Detect CSS Animations support to detect element display/re-attach */
    let animation = false;
    let keyframeprefix = '';

    animationStartEvent = 'animationstart';

    const domPrefixes = 'Webkit Moz O ms'.split(' ');
    const startEvents =
      'webkitAnimationStart animationstart oAnimationStart MSAnimationStart'.split(' ');
    let pfx = '';
    {
      const elm = document.createElement('fakeelement');

      if (elm.style.animationName !== undefined) {
        animation = true;
      }

      if (animation === false) {
        for (const [i, domPrefix] of domPrefixes.entries()) {
          // @ts-expect-error
          if (elm.style[`${domPrefix}AnimationName`] !== undefined) {
            pfx = domPrefix!;
            keyframeprefix = `-${pfx.toLowerCase()}-`;
            animationStartEvent = startEvents[i]!;
            animation = true;
            break;
          }
        }
      }
    }

    animationName = 'resizeanim';
    animationKeyframes = `@${keyframeprefix}keyframes ${
      animationName
    } { from { opacity: 0; } to { opacity: 0; } } `;
    animationStyle = `${keyframeprefix}animation: 1ms ${animationName}; `;
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
            if (e.animationName === animationName) {
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

export class AutoSizer extends Component<Props, State> {
  public override state: State = {
    height: (this.props as HeightAndWidthProps).defaultHeight || 0,
    scaledHeight: (this.props as HeightAndWidthProps).defaultHeight || 0,
    scaledWidth: (this.props as HeightAndWidthProps).defaultWidth || 0,
    width: (this.props as HeightAndWidthProps).defaultWidth || 0,
  };

  _autoSizer: HTMLElement | null = null;
  _detectElementResize: DetectElementResize | null = null;
  _parentNode: HTMLElement | null = null;
  _resizeObserver: ResizeObserver | null = null;
  _timeoutId: number | null = null;

  public override componentDidMount() {
    const { nonce } = this.props;
    const parentNode = this._autoSizer ? this._autoSizer.parentNode : null;

    if (
      parentNode?.ownerDocument?.defaultView &&
      parentNode instanceof parentNode.ownerDocument.defaultView.HTMLElement
    ) {
      // Delay access of parentNode until mount.
      // This handles edge-cases where the component has already been unmounted before its ref has been set,
      // As well as libraries like react-lite which have a slightly different lifecycle.
      this._parentNode = parentNode;

      // Use ResizeObserver from the same context where parentNode (which we will observe) was defined
      // Using just global can result into onResize events not being emitted in cases with multiple realms
      const ResizeObserverInstance = parentNode.ownerDocument.defaultView.ResizeObserver;

      if (ResizeObserverInstance != null) {
        this._resizeObserver = new ResizeObserverInstance(() => {
          // Guard against "ResizeObserver loop limit exceeded" error;
          // could be triggered if the state update causes the ResizeObserver handler to run long.
          // See https://github.com/bvaughn/react-virtualized-auto-sizer/issues/55
          this._timeoutId = setTimeout(this._onResize, 0);
        });
        this._resizeObserver.observe(parentNode);
      } else {
        // Defer requiring resize handler in order to support server-side rendering.
        // See issue #41
        this._detectElementResize = createDetectElementResize(nonce);
        this._detectElementResize.addResizeListener(parentNode, this._onResize);
      }

      this._onResize();
    }
  }

  public override componentWillUnmount() {
    if (this._parentNode) {
      if (this._detectElementResize) {
        this._detectElementResize.removeResizeListener(this._parentNode, this._onResize);
      }

      if (this._timeoutId !== null) {
        clearTimeout(this._timeoutId);
      }

      if (this._resizeObserver) {
        this._resizeObserver.disconnect();
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
        ref: this._setRef,
        style: {
          ...outerStyle,
          ...style,
        },
        ...rest,
      },
      !bailoutOnChildren && children(childParams as Size),
    );
  }

  _onResize = () => {
    this._timeoutId = null;

    const { disableHeight, disableWidth, onResize } = this.props as HeightAndWidthProps;

    if (this._parentNode) {
      // Guard against AutoSizer component being removed from the DOM immediately after being added.
      // This can result in invalid style values which can result in NaN values if we don't handle them.
      // See issue #150 for more context.

      const style = window.getComputedStyle(this._parentNode) || {};
      const paddingLeft = parseFloat(style.paddingLeft || '0');
      const paddingRight = parseFloat(style.paddingRight || '0');
      const paddingTop = parseFloat(style.paddingTop || '0');
      const paddingBottom = parseFloat(style.paddingBottom || '0');

      const rect = this._parentNode.getBoundingClientRect();
      const scaledHeight = rect.height - paddingTop - paddingBottom;
      const scaledWidth = rect.width - paddingLeft - paddingRight;

      const height = this._parentNode.offsetHeight - paddingTop - paddingBottom;
      const width = this._parentNode.offsetWidth - paddingLeft - paddingRight;

      if (
        (!disableHeight &&
          (this.state.height !== height || this.state.scaledHeight !== scaledHeight)) ||
        (!disableWidth && (this.state.width !== width || this.state.scaledWidth !== scaledWidth))
      ) {
        this.setState({
          height,
          width,
          scaledHeight,
          scaledWidth,
        });

        if (typeof onResize === 'function') {
          onResize({ height, scaledHeight, scaledWidth, width });
        }
      }
    }
  };

  _setRef = (autoSizer: HTMLElement | null) => {
    this._autoSizer = autoSizer;
  };
}
