// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoutingStore } from '@/util/routing/store';
import { act, render } from '@/util/testing/render';

/**
 * The routing store is the path an application routes on, so the suite is the decisions it makes
 * without one: where the path comes from at boot, what an address nothing knows resolves to, and
 * that a route scrolls home once and never twice for the same path.
 */
beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('createRoutingStore', () => {
  it("takes the URL's pathname when no path is named as known", () => {
    window.history.replaceState(null, '', '/settings');

    expect(createRoutingStore().getRoutingPath()).toBe('/settings');
  });

  it('boots from a known path in the URL', () => {
    window.history.replaceState(null, '', '/settings');

    const store = createRoutingStore({ knownPaths: ['/', '/settings'] });

    expect(store.getRoutingPath()).toBe('/settings');
  });

  it('falls back to the fallback path when the URL names no known path', () => {
    window.history.replaceState(null, '', '/anything-else');

    const store = createRoutingStore({ knownPaths: ['/', '/settings'] });

    expect(store.getRoutingPath()).toBe('/');
  });

  it('falls back to the fallback path the caller asked for', () => {
    window.history.replaceState(null, '', '/anything-else');

    const store = createRoutingStore({ knownPaths: ['/'], fallbackPath: '/main' });

    expect(store.getRoutingPath()).toBe('/main');
  });

  it('routes, scrolling home once, and ignores the path already held', () => {
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo;
    const store = createRoutingStore();

    store.routeTo('/settings');

    expect(store.getRoutingPath()).toBe('/settings');
    expect(scrollTo).toHaveBeenCalledOnce();

    store.routeTo('/settings');

    expect(scrollTo).toHaveBeenCalledOnce();
  });

  it('leaves the scroll alone when the caller opted out of it', () => {
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo;
    const store = createRoutingStore({ scrollOnRouteChange: false });

    store.routeTo('/settings');

    expect(store.getRoutingPath()).toBe('/settings');
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('re-renders the component holding the path when the path changes', async () => {
    const store = createRoutingStore();

    function Path() {
      const path = store.useRoutingPath();

      return <span>{path}</span>;
    }

    const rendered = await render(<Path />);

    expect(rendered.find('span').textContent).toBe('/');

    await act(() => {
      store.routeTo('/settings');
    });

    expect(rendered.find('span').textContent).toBe('/settings');
  });
});
