/**
 * `WComponent` is the plumbing every custom element the library defines builds on: an open shadow
 * root attached in the constructor, a render pass coalesced onto a microtask, scoped style
 * injection on connect, and `on`/`onClick` wiring that throws on a selector matching nothing. The
 * suite drives real registered custom elements through connect, attribute change, re-connect and
 * disconnect and asserts the shadow root's contents, because that is what a subclass can observe.
 *
 * `observedAttributes` resolves the `props` of the class the registry reads it from, so a card that
 * observes an attribute redeclares the field and is observed for exactly what it lists — a
 * subclass without its own inherits the base's empty list. Custom element classes are instantiated
 * directly, since a typed instance is the only way the subclass's own methods are reachable from
 * the test without a cast.
 */
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { type EventCallback, type WCAttrChange, WComponent } from './web_component';

/** What `onAttrChange` receives for one attribute, as the tests record it. */
interface RecordedChange {
  readonly attrName: string;
  readonly oldValue: string | null;
  readonly newValue: string | null;
}

/** An element using every default hook, including the empty default styles. */
class PlainCard extends WComponent {}

/** Counts everything the lifecycle calls, and wires a button on each render. */
class RecordingCard extends WComponent {
  /** The attribute these tests set to drive re-renders and `onAttrChange` through. */
  protected static override props = ['label'];

  static changes: RecordedChange[] = [];
  static renders = 0;
  static clicks = 0;
  static clickReceivers: unknown[] = [];
  static eventTypes: string[] = [];
  static connected = 0;
  static disconnected = 0;

  protected override onAttrChange(change: WCAttrChange): void {
    RecordingCard.changes.push({
      attrName: change.attrName,
      oldValue: change.oldValue,
      newValue: change.newValue,
    });
  }

  protected override render(): void {
    RecordingCard.renders += 1;

    if (this.el('button') === null) {
      this.shadowHTML = '<button>go</button>';
    }

    /**
     * A regular `function`, so the `this` the base binds onto the callback is observable: the
     * bound receiver is what `on` promises the subclass.
     */
    this.onClick('button', function (this: RecordingCard | undefined, event: Event): void {
      RecordingCard.clicks += 1;
      RecordingCard.clickReceivers.push(this);
      RecordingCard.eventTypes.push(event.type);
    });
  }

  protected override onConnect(): void {
    RecordingCard.connected += 1;
  }

  protected override onDisconnect(): void {
    RecordingCard.disconnected += 1;
  }
}

/** Renders a template through the `template` setter instead of `shadowHTML`. */
class TemplateCard extends WComponent {
  protected override render(): void {
    if (this.el('p') === null) {
      const first = document.createElement('template');
      first.innerHTML = '<p>first</p>';
      this.template = first;
    }

    if (this.el('em') === null) {
      const second = document.createElement('template');
      second.innerHTML = '<em>second</em>';
      this.template = second;
    }
  }
}

/** Styles shipped as a constructable stylesheet. */
class SheetStylesCard extends WComponent {
  static override styles = [new CSSStyleSheet()];
}

/** Styles shipped as a plain string. */
class TextStylesCard extends WComponent {
  static override styles = '.card{color:red}';
}

/** A card letting each test name the wiring it probes, with the button rendered in the markup. */
class WireProbeCard extends WComponent {
  wire(selector: string, eventName: string, callback: EventCallback): void {
    this.on(selector, eventName, callback);
  }

  wireClick(selector: string, callback: EventCallback): void {
    this.onClick(selector, callback);
  }

  protected override render(): void {
    this.shadowHTML = '<button>go</button>';
  }
}

/** A card that declares it has no shadow root, for the guards against one that is absent. */
class NoShadowCard extends WComponent {
  override get shadowRoot(): ShadowRoot | null {
    return null;
  }

  writeShadowHTML(htmlString: string): void {
    this.shadowHTML = htmlString;
  }
}

/** An element redeclaring `props` to name its own attributes, registered without any workaround. */
class OwnPropsCard extends WComponent {
  protected static override props = ['name', 'value'];

  static changes: RecordedChange[] = [];

  protected override onAttrChange(change: WCAttrChange): void {
    OwnPropsCard.changes.push({
      attrName: change.attrName,
      oldValue: change.oldValue,
      newValue: change.newValue,
    });
  }
}

/** Lists an attribute and overrides no hook but `render`, for the empty `onAttrChange` default. */
class DefaultHookCard extends WComponent {
  protected static override props = ['title'];

  static renders = 0;

  protected override render(): void {
    DefaultHookCard.renders += 1;
  }
}

customElements.define('wc-test-plain-card', PlainCard);
customElements.define('wc-test-recording-card', RecordingCard);
customElements.define('wc-test-template-card', TemplateCard);
customElements.define('wc-test-sheet-styles-card', SheetStylesCard);
customElements.define('wc-test-text-styles-card', TextStylesCard);
customElements.define('wc-test-wire-probe-card', WireProbeCard);
customElements.define('wc-test-no-shadow-card', NoShadowCard);
customElements.define('wc-test-own-props-card', OwnPropsCard);
customElements.define('wc-test-default-hook-card', DefaultHookCard);

afterEach(() => {
  document.body.innerHTML = '';
});

beforeEach(() => {
  RecordingCard.changes = [];
  RecordingCard.renders = 0;
  RecordingCard.clicks = 0;
  RecordingCard.clickReceivers = [];
  RecordingCard.eventTypes = [];
  RecordingCard.connected = 0;
  RecordingCard.disconnected = 0;
  OwnPropsCard.changes = [];
  DefaultHookCard.renders = 0;
});

/** Gives the render pass coalesced on a microtask its turn. */
async function flushRenderPass(): Promise<void> {
  await Promise.resolve();
}

describe('WComponent lifecycle', () => {
  test('attaches an open shadow root and renders the default hooks to an empty root', async () => {
    const card = new PlainCard();
    document.body.appendChild(card);

    expect(card.shadowRoot).toBeInstanceOf(ShadowRoot);

    await flushRenderPass();
    expect(card.shadowRoot?.innerHTML).toBe('<style data-wc-styles=""></style>');

    card.setAttribute('label', 'any');
    await flushRenderPass();
    expect(card.shadowRoot?.innerHTML).toBe('<style data-wc-styles=""></style>');
  });

  test('runs onConnect after the first render is scheduled and onDisconnect on removal', async () => {
    const card = new RecordingCard();
    document.body.appendChild(card);
    await flushRenderPass();

    expect(RecordingCard.connected).toBe(1);
    expect(RecordingCard.disconnected).toBe(0);

    document.body.removeChild(card);
    expect(RecordingCard.disconnected).toBe(1);
  });

  test('coalesces a burst of attribute changes into one render', async () => {
    const card = new RecordingCard();
    document.body.appendChild(card);
    await flushRenderPass();
    expect(RecordingCard.renders).toBe(1);

    card.setAttribute('label', 'first');
    card.setAttribute('label', 'second');
    await flushRenderPass();

    expect(RecordingCard.changes).toEqual([
      { attrName: 'label', oldValue: null, newValue: 'first' },
      { attrName: 'label', oldValue: 'first', newValue: 'second' },
    ]);
    expect(RecordingCard.renders).toBe(2);

    card.removeAttribute('label');
    await flushRenderPass();

    expect(RecordingCard.changes[2]).toEqual({
      attrName: 'label',
      oldValue: 'second',
      newValue: null,
    });
    expect(RecordingCard.renders).toBe(3);
  });

  test('wires a button after rendering and binds the element onto the callback', async () => {
    const card = new RecordingCard();
    document.body.appendChild(card);
    await flushRenderPass();

    const button = card.shadowRoot?.querySelector('button');
    expect(button).not.toBeNull();

    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(RecordingCard.clicks).toBe(1);
    expect(RecordingCard.eventTypes).toEqual(['click']);
    expect(RecordingCard.clickReceivers[0]).toBe(card);
  });

  test('injects string styles once, on the first connect only', async () => {
    const card = new TextStylesCard();
    document.body.appendChild(card);
    await flushRenderPass();

    const styles = card.shadowRoot?.querySelectorAll('style[data-wc-styles]');
    expect(styles?.length).toBe(1);
    expect(styles?.[0]?.firstChild?.textContent).toContain('.card{color:red}');

    document.body.removeChild(card);
    document.body.appendChild(card);
    await flushRenderPass();

    expect(card.shadowRoot?.querySelectorAll('style[data-wc-styles]').length).toBe(1);
  });

  /** Prepares a shadow root to behave like one that adopted stylesheet support. */
  function withAdoptableRoot(card: WComponent): ShadowRoot {
    const root = card.shadowRoot;
    if (!root) {
      throw new Error('the shadow root was not attached');
    }
    Object.defineProperty(root, 'adoptedStyleSheets', {
      value: [],
      configurable: true,
      writable: true,
    });

    return root;
  }

  test('injects constructable stylesheets into the shadow root', async () => {
    const card = new SheetStylesCard();
    const root = withAdoptableRoot(card);

    document.body.appendChild(card);
    await flushRenderPass();

    expect(root.adoptedStyleSheets).toHaveLength(1);
    expect(root.querySelector('style[data-wc-styles]')).toBeNull();
  });

  /**
   * The `styles` array a JS caller can build at runtime is not validated at assignment: a member
   * that is not a stylesheet object is skipped, and the real ones are adopted.
   */
  test('skips members of the styles array that are not stylesheet objects', async () => {
    class MixedStylesCard extends WComponent {}
    customElements.define('wc-test-mixed-styles-card', MixedStylesCard);
    Object.defineProperty(MixedStylesCard, 'styles', {
      value: [{}, new CSSStyleSheet()],
      configurable: true,
    });
    const card = new MixedStylesCard();
    const root = withAdoptableRoot(card);

    document.body.appendChild(card);
    await flushRenderPass();

    expect(root.adoptedStyleSheets).toHaveLength(1);
    expect(root.querySelector('style[data-wc-styles]')).toBeNull();
  });

  test('injects nothing when styles are left unset by a JS caller', async () => {
    class UndefinedStylesCard extends WComponent {}
    customElements.define('wc-test-undefined-styles-card', UndefinedStylesCard);
    Object.defineProperty(UndefinedStylesCard, 'styles', {
      value: undefined,
      configurable: true,
    });
    const card = new UndefinedStylesCard();

    document.body.appendChild(card);
    await flushRenderPass();

    expect(card.shadowRoot?.querySelector('style[data-wc-styles]')).toBeNull();
  });

  test('renders through the template setter, cloning each template content into the root', async () => {
    const card = new TemplateCard();
    document.body.appendChild(card);
    await flushRenderPass();

    expect(card.shadowRoot?.querySelector('p')?.textContent).toBe('first');
    expect(card.shadowRoot?.querySelector('em')?.textContent).toBe('second');
  });

  // The documented point of the empty `onAttrChange` default: an element that observes an attribute
  // but keeps every hook needs no override, and the render pass still runs for the change.
  test('keeps the empty onAttrChange default working for an element that overrides no hook', async () => {
    const card = new DefaultHookCard();
    document.body.appendChild(card);
    await flushRenderPass();
    expect(DefaultHookCard.renders).toBe(1);

    card.setAttribute('title', 'any');
    await flushRenderPass();

    expect(DefaultHookCard.renders).toBe(2);
  });
});

describe('WComponent wiring guards', () => {
  test('throws on a listener registered on a selector that matches nothing', () => {
    const card = new WireProbeCard();

    expect(card.wire.bind(card, 'span', 'click', () => {})).toThrowError(
      'WireProbeCard: nothing in the shadow root matches "span".',
    );
  });

  test('onClick delegates to on with the click event name', () => {
    const card = new WireProbeCard();

    expect(card.wireClick.bind(card, 'span', () => {})).toThrowError(
      'WireProbeCard: nothing in the shadow root matches "span".',
    );
  });

  test('wires through on and onClick once the content exists', async () => {
    const viaOn = new WireProbeCard();
    const viaOnClick = new WireProbeCard();
    document.body.appendChild(viaOn);
    document.body.appendChild(viaOnClick);
    await flushRenderPass();

    const clicks: Event[] = [];
    viaOn.wire('button', 'click', (event) => clicks.push(event));
    viaOnClick.wireClick('button', (event) => clicks.push(event));
    viaOn.shadowRoot
      ?.querySelector('button')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    viaOnClick.shadowRoot
      ?.querySelector('button')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(clicks).toHaveLength(2);
  });
});

describe('WComponent guard for an absent shadow root', () => {
  test('writes and injects nothing, without throwing', () => {
    const card = new NoShadowCard();

    document.body.appendChild(card);
    card.writeShadowHTML('<p>never rendered</p>');

    expect(card.shadowRoot).toBeNull();
  });
});

describe('WComponent observed attributes', () => {
  test('observes the attributes a subclass names by redeclaring props', async () => {
    // The registry read this getter off the class at define time; it has to see the subclass's own
    // field, not the base class's.
    expect(OwnPropsCard.observedAttributes).toEqual(['name', 'value']);

    const card = new OwnPropsCard();
    document.body.appendChild(card);
    await flushRenderPass();

    card.setAttribute('name', 'first');
    card.setAttribute('value', 'x');
    await flushRenderPass();

    expect(OwnPropsCard.changes).toEqual([
      { attrName: 'name', oldValue: null, newValue: 'first' },
      { attrName: 'value', oldValue: null, newValue: 'x' },
    ]);
  });
});

describe('WComponent listener replacement', () => {
  test('replaces the wired listener on re-render instead of stacking another one', async () => {
    const card = new RecordingCard();
    document.body.appendChild(card);
    await flushRenderPass();

    const button = card.shadowRoot?.querySelector('button');
    expect(button).not.toBeNull();

    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(RecordingCard.clicks).toBe(1);

    // The attribute change schedules a render, and the render wires the button again; the second
    // click therefore runs into whatever that rewiring left behind.
    card.setAttribute('label', 'again');
    await flushRenderPass();
    expect(RecordingCard.renders).toBe(2);

    card.shadowRoot
      ?.querySelector('button')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(RecordingCard.clicks).toBe(2);
  });

  test('after a re-render re-binds a different callback, only the latest one fires', async () => {
    const card = new WireProbeCard();
    document.body.appendChild(card);
    await flushRenderPass();

    const first: Event[] = [];
    const second: Event[] = [];
    card.wire('button', 'click', (event) => first.push(event));

    card.shadowRoot
      ?.querySelector('button')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);

    /**
     * A render rebuilds the markup, so the re-bind below lands on a new element. The listener
     * recorded from the first wire is on the element it was wired to, and that element is gone.
     */
    document.body.removeChild(card);
    document.body.appendChild(card);
    await flushRenderPass();

    card.wire('button', 'click', (event) => second.push(event));

    card.shadowRoot
      ?.querySelector('button')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);

    // The surviving binding keeps working: a second event on the same selector still fires.
    card.shadowRoot
      ?.querySelector('button')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(2);
  });

  test('wiring through onClick replaces a listener wired through on for the same selector', async () => {
    const card = new WireProbeCard();
    document.body.appendChild(card);
    await flushRenderPass();

    const viaOnClick: Event[] = [];
    const viaOn: Event[] = [];
    card.wireClick('button', (event) => viaOnClick.push(event));
    card.wire('button', 'click', (event) => viaOn.push(event));

    card.shadowRoot
      ?.querySelector('button')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(viaOnClick).toHaveLength(0);
    expect(viaOn).toHaveLength(1);
  });
});
