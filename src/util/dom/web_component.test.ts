/**
 * `WComponent` is the plumbing every custom element the library defines builds on: an open shadow
 * root attached in the constructor, a render pass coalesced onto a microtask, scoped style
 * injection on connect, and `on`/`onClick` wiring that throws on a selector matching nothing. The
 * suite drives real registered custom elements through connect, attribute change, re-connect and
 * disconnect and asserts the shadow root's contents, because that is what a subclass can observe.
 *
 * `observedAttributes` reads the base class's `props` field, so a subclass redeclaring the field
 * is never observed by the registry (see the report on web_component.ts:50 about the static
 * binding): the tests define their elements while `WComponent.props` names `label` and restore the
 * property afterwards, which mirrors how the registry reads the getter. Custom element classes are
 * instantiated directly, since a typed instance is the only way the subclass's own methods are
 * reachable from the test without a cast.
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

const ORIGINAL_PROPS = Object.getOwnPropertyDescriptor(WComponent, 'props');

/**
 * Defines `elementClass` under `tag` while the observed-attribute getter can see `label`, then
 * restores the base class's own `props` property. Runs before any instance of the tag exists.
 */
function defineWithObservedProps(tag: string, elementClass: CustomElementConstructor): void {
  Object.defineProperty(WComponent, 'props', { value: ['label'], configurable: true });
  customElements.define(tag, elementClass);
  Object.defineProperty(WComponent, 'props', ORIGINAL_PROPS ?? { value: [] });
}

/** An element using every default hook, including the empty default styles. */
class PlainCard extends WComponent {}

/** Counts everything the lifecycle calls, and wires a button on each render. */
class RecordingCard extends WComponent {
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

defineWithObservedProps('wc-test-plain-card', PlainCard);
defineWithObservedProps('wc-test-recording-card', RecordingCard);
defineWithObservedProps('wc-test-template-card', TemplateCard);
defineWithObservedProps('wc-test-sheet-styles-card', SheetStylesCard);
defineWithObservedProps('wc-test-text-styles-card', TextStylesCard);
defineWithObservedProps('wc-test-wire-probe-card', WireProbeCard);
defineWithObservedProps('wc-test-no-shadow-card', NoShadowCard);

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
    defineWithObservedProps('wc-test-mixed-styles-card', MixedStylesCard);
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
    defineWithObservedProps('wc-test-undefined-styles-card', UndefinedStylesCard);
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
