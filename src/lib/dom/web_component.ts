export interface WCAttrChange {
  readonly attrName: string;
  readonly oldValue: string | null;
  readonly newValue: string | null;
}

export type EventCallback = (event: Event) => void;

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

  protected render() {}

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
