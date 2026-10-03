/**
 * What {@link WComponent.onAttrChange} receives for one attribute, before the re-render it triggers.
 *
 * `oldValue` is `null` when the attribute was just added, and `newValue` when it was just removed —
 * the same two cases `attributeChangedCallback` itself reports, because an absent attribute and an
 * attribute set to `''` are different facts a component may need to tell apart.
 */
export interface WCAttrChange {
  readonly attrName: string;
  readonly oldValue: string | null;
  readonly newValue: string | null;
}

/** Bound listener signature for {@link WComponent.on} — the actual element is not handed back. */
export type EventCallback = (event: Event) => void;

/**
 * The base class for the library's custom elements.
 *
 * Every element gets an open shadow root in the constructor and renders on a microtask, so a burst of
 * attribute changes produces one render; subclasses override {@link WComponent.render} and list their
 * attributes in the static `props` field, which doubles as `observedAttributes`. Event wiring happens
 * after render: {@link WComponent.on} and {@link WComponent.onClick} throw on a selector that matches
 * nothing, since a silently dead listener reads as a broken component.
 */
export abstract class WComponent extends HTMLElement {
  private needsRender = false;

  protected static props: string[] = [];

  /**
   * The shadow root attached in the constructor.
   *
   * Held here rather than read back off `this.shadowRoot` at each use, because the property is
   * `ShadowRoot | null` for a host that has not attached one and every reader then has to prove the
   * attachment happened. It did, in the constructor below, so it is captured once.
   */
  private readonly root: ShadowRoot;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
  }

  protected set template(templateElement: HTMLTemplateElement) {
    this.root.appendChild(templateElement.content.cloneNode(true));
  }

  static get observedAttributes(): string[] {
    return WComponent.props;
  }

  // New: static styles property (string or CSSStyleSheet)
  protected static styles: string | CSSStyleSheet[] = '';

  attributeChangedCallback(attrName: string, oldValue: string | null, newValue: string | null) {
    this.onAttrChange({ attrName, oldValue, newValue });
    this.scheduleRender();
  }

  /**
   * Called with each attribute change, before the scheduled render.
   *
   * The empty default is the point: an element with no attribute-driven state does not have to
   * override anything, and the render pass still runs.
   */
  protected onAttrChange(_: WCAttrChange): void {}

  /**
   * Replaces the shadow root's content wholesale with the given markup.
   *
   * It is a setter on purpose, so a subclass writes `this.shadowHTML = '...'` and cannot keep a stale
   * string in a field: the assignment is the render.
   */
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

  /**
   * Runs once the element is in the document, after the first render is scheduled.
   *
   * Querying the shadow root inside it is therefore safe — the template is already in place — but
   * work done here on behalf of an attribute still belongs behind the render pass, because the
   * attribute callback may fire without a connect around it.
   */
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

  // **Inject scoped styles into the shadow root
  private injectStyles() {
    if (!this.shadowRoot) {
      return;
    }

    // Avoid reinjecting if already present
    if (this.shadowRoot.querySelector('style[data-wc-styles]')) {
      return;
    }

    const { styles } = this.constructor as typeof WComponent;
    if (typeof styles === 'string') {
      const styleEl = document.createElement('style');
      styleEl.setAttribute('data-wc-styles', '');
      styleEl.textContent = styles;
      this.root.prepend(styleEl);
    } else if (Array.isArray(styles)) {
      for (const sheet of styles) {
        if (sheet instanceof CSSStyleSheet) {
          // Adopted stylesheets (modern browsers)
          this.root.adoptedStyleSheets = [...this.root.adoptedStyleSheets, sheet];
        }
      }
    }
  }

  /** Subclass hook for what the element looks like; re-run by every attribute change. */
  protected render() {}

  /** First element in the shadow root matching `selector`, or `null` — no throwing, unlike `on`. */
  protected el(selector: string) {
    return this.root.querySelector(selector);
  }

  protected on(selector: string, eventName: string, callback: EventCallback) {
    const element = this.root.querySelector(selector);

    // A listener registered on a selector that matches nothing would never fire, and the component
    // would look broken rather than wrong. Naming what was missing is the only useful report.
    if (element === null) {
      throw new Error(
        `${this.constructor.name}: nothing in the shadow root matches "${selector}".`,
      );
    }

    element.addEventListener(eventName, callback.bind(this));
  }

  protected onClick(selector: string, callback: EventCallback) {
    this.on(selector, 'click', callback);
  }
}
