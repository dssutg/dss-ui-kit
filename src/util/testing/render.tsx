import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, vi } from 'vitest';

/**
 * The one place a component test renders.
 *
 * Every component group needs the same four things — a container attached to the document, a root,
 * effects flushed before the assertion, and a way to unmount — and a group that writes its own copy
 * is a group whose test passes for a reason that has nothing to do with the component. The queries are
 * on top of that because `container.querySelector` returning `null` for an element the test just
 * rendered is a failure message that says nothing about which element was missing.
 *
 * It lives in `src/util/` rather than beside the tests because the alternative is a copy per group:
 * `scripts/` sits outside the `@` alias, so importing from it would mean walking up the tree with
 * `../`, which the import rule forbids everywhere. Nothing in the public surface imports it, so it is
 * not in the bundle, and `package.json` publishes `dist/` and `src/css/` only, so it is not in the
 * package either.
 *
 * The imports are the React ones on purpose: `react-dom/client` and `react-dom/test-utils` resolve to
 * `preact/compat/client` and `preact/test-utils` through the alias in `vite.config.ts`, which is the
 * same mapping the library build uses. Writing `preact/compat` here instead would be a test that runs
 * against a different renderer from the one a consumer gets.
 */

/**
 * What `createRoot` hands back.
 *
 * Derived rather than imported: `react-dom/client` in React exports a `Root` type, but the module
 * this alias resolves to — `preact/compat/client` — declares the return type inline and exports no
 * name for it, so importing the name would be a type error against the renderer the tests actually
 * run on.
 */
type Root = ReturnType<typeof createRoot>;

/** The container and root of one rendered tree. */
interface MountedTree {
  readonly container: HTMLElement;
  readonly root: Root;
}

/** Every tree rendered since the last cleanup, so one `afterEach` can unmount all of them. */
const mountedTrees: MountedTree[] = [];

/**
 * What a test can do with a rendered tree.
 *
 * `update` and `unmount` are the two that are not a query: a controlled component cannot be tested
 * without rendering it twice, and nothing is cleaned up between tests without an unmount.
 *
 * The queries search `document.body` and not the container, because a modal, a dropdown and a
 * tooltip are rendered through a portal onto the body, and a query that cannot see them would fail on
 * the components whose output deliberately leaves the tree it was given. `container` is still there
 * for the assertions about the container itself — that a component rendered nothing, for instance.
 */
export interface RenderResult {
  /** The element the tree was rendered into, which is attached to `document.body`. */
  readonly container: HTMLElement;
  /** Renders `element` again into the same root, which is how a controlled component is driven. */
  update(element: ReactNode): Promise<void>;
  /** Detaches the tree and empties the container. */
  unmount(): void;
  /** Every element matching `selector`, in document order. Empty rather than null when none match. */
  findAll<T extends Element = HTMLElement>(selector: string): T[];
  /** The one element matching `selector`, or a failure naming the selector and what was rendered. */
  find<T extends Element = HTMLElement>(selector: string): T;
  /** The one element whose text content is exactly `text`, or a failure listing what was rendered. */
  findByText(text: string): HTMLElement;
  /** The element matching `selector`, or null. For an assertion about something not being there. */
  query<T extends Element = HTMLElement>(selector: string): T | null;
  /** Every element's text content, trimmed, which is what most assertions in this suite compare. */
  textContent(): string;
}

/**
 * Unmounts every tree rendered since the last call. Called after each test by this module.
 *
 * Synchronous, because `act` around a synchronous callback is itself synchronous: the work Preact has
 * to do here — unmounting, and running the cleanup effects that go with it — happens before `act`
 * returns. The events below are synchronous for the same reason, and a test awaits them only
 * because every render helper in this module is async.
 */
export function cleanup(): void {
  const trees = [...mountedTrees];
  mountedTrees.length = 0;

  act(() => {
    for (const { container, root } of trees) {
      root.unmount();
      container.remove();
    }
  });
}

/**
 * Lets the work a component defers to a later turn happen: its timers, the microtasks those timers
 * queue, and the renders they cause.
 *
 * The library schedules real work on `setTimeout(..., 0)` in three places that a test would otherwise
 * catch mid-flight — a list that re-renders once its container has been measured, a dialog that
 * unlocks itself after its opening animation, and an autosizer that measures on a timeout — so a
 * rendered tree is not finished until this has run. It is not a long wait: one turn of the event loop,
 * and it does not move fake timers.
 */
export async function flush(): Promise<void> {
  if (vi.isFakeTimers()) {
    // A test that installed its own clock decides when deferred work happens, so flush does not wait
    // on a timer that will never fire; it advances the clock by nothing, which is enough for a tree
    // that is already settled to settle.
    act(() => {
      vi.advanceTimersByTime(0);
    });

    return;
  }

  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
}

afterEach(() => {
  cleanup();
});

/** A readable summary of what a document holds, for a failure message. */
function describeDocument(): string {
  const html = document.body.innerHTML.trim();

  return html === '' ? '(nothing was rendered)' : html.slice(0, 400);
}

/** Every element matching `selector`, or a failure that says what was actually rendered. */
function requireAll<T extends Element>(selector: string): T[] {
  const found = [...document.body.querySelectorAll<T>(selector)];

  if (found.length === 0) {
    throw new Error(`no element matched "${selector}". The document holds: ${describeDocument()}`);
  }

  return found;
}

/**
 * The innermost element whose trimmed text is exactly `text`, or a failure listing what is present.
 *
 * The innermost one, because every ancestor of a match has the same `textContent`: a component that
 * renders `<div><strong>Done</strong></div>` matches on all three, and the element a test means is the
 * one that holds the text rather than the ones that contain it.
 */
function requireByText(text: string): HTMLElement {
  const candidates = [...document.body.querySelectorAll<HTMLElement>('*')].filter(
    (element) => element.textContent?.trim() === text,
  );

  const innermost = candidates.find(
    (candidate) => !candidates.some((other) => other !== candidate && candidate.contains(other)),
  );

  if (innermost !== undefined) {
    return innermost;
  }

  const texts = [...document.body.querySelectorAll<HTMLElement>('*')]
    .map((element) => element.textContent?.trim() ?? '')
    .filter((candidate) => candidate !== '');

  throw new Error(
    `no element's text was "${text}". The texts rendered were: ${
      texts.length === 0 ? '(none)' : texts.join(' | ')
    }`,
  );
}

/**
 * Renders `element` into a fresh container attached to `document.body`, with effects flushed.
 *
 * The container is attached rather than detached on purpose: a component that measures itself, a
 * portal target or a stylesheet rule about `position: fixed` behaves differently outside the
 * document, and the runtime this ships in is inside it.
 *
 * It is `async` because effects are. Preact schedules rendering, and `act` is what waits for the
 * queue to drain, so a test that asserted without awaiting would be asserting about the tree as it
 * was before its effects ran.
 */
export async function render(element: ReactNode): Promise<RenderResult> {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const root = createRoot(container);
  mountedTrees.push({ container, root });

  const mounted: MountedTree = { container, root };

  const result: RenderResult = {
    container,
    update: async (next) => {
      act(() => {
        root.render(next);
      });

      await flush();
    },
    unmount: () => {
      const index = mountedTrees.indexOf(mounted);
      if (index >= 0) mountedTrees.splice(index, 1);

      act(() => {
        root.unmount();
        container.remove();
      });
    },
    findAll: <T extends Element>(selector: string) => requireAll<T>(selector),
    find: <T extends Element>(selector: string) => {
      const [first] = requireAll<T>(selector);

      if (first === undefined) {
        throw new Error(`no element matched "${selector}".`);
      }

      return first;
    },
    findByText: (text) => requireByText(text),
    query: <T extends Element>(selector: string) => document.body.querySelector<T>(selector),
    textContent: () => container.textContent ?? '',
  };

  act(() => {
    root.render(element);
  });

  await flush();

  return result;
}

/**
 * Dispatches a click that React's synthetic event system sees, and hands the event back.
 *
 * `element.click()` fires an event that does not bubble through the delegation root Preact installs
 * on the container, so a component whose handler is on an ancestor is not called by it. The event is
 * constructed and dispatched instead, which is what a real click does. `init` carries the modifiers —
 * a Ctrl-click is a different decision for a link than a plain one — and the event comes back so a
 * test can read what the handler did to it, `defaultPrevented` first among those.
 */
export function click(element: Element, init: MouseEventInit = {}): MouseEvent {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...init });

  act(() => {
    element.dispatchEvent(event);
  });

  return event;
}

/** Sets an input's value the way typing does, so the change handler sees a real change. */
export function type(input: HTMLInputElement, value: string): void {
  act(() => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/**
 * Sets a select's value and fires its `change` event.
 *
 * Separate from {@link type} because a `<select>` reports a change through `change` and not through
 * `input`, and a click on it opens a list rather than choosing anything.
 */
export function change(select: HTMLSelectElement, value: string): void {
  act(() => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

/**
 * Waits for `condition` to hold, polling the way a user would see it change.
 *
 * For the components that do their work on a timer — a debounced picker, an animation, a transition —
 * where the state a test is waiting for is only correct at a moment no `act` call can be aligned to.
 * The real clock is used, so a test that fakes timers has to advance them instead of awaiting this.
 */
export async function waitFor(
  condition: () => boolean,
  { timeout = 2000, interval = 10 }: { readonly timeout?: number; readonly interval?: number } = {},
): Promise<void> {
  const deadline = Date.now() + timeout;

  while (!condition()) {
    if (Date.now() >= deadline) {
      throw new Error('waited for the condition to hold and it never did');
    }

    await new Promise((resolve) => {
      setTimeout(resolve, interval);
    });
  }
}

/**
 * Re-exported for the events a component listens for on the window rather than on its own element.
 *
 * A key press dispatched at `window` reaches a listener this tree cannot wrap, and a state update
 * that happens outside `act` is flushed after the assertion rather than before it.
 */
export { act };
