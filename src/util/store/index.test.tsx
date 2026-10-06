// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createStore } from '@/util/store';
import { act, render } from '@/util/testing/render';

/**
 * The store is state a component reads through a selector, so the suite is the two promises it
 * makes: a patch changes only the fields it names, and a subscriber re-renders on a change to what
 * it selected and not on one to anything else.
 */
describe('createStore', () => {
  it('reads the state it was given and replaces only the fields a patch names', () => {
    const initialState = { path: '/', animated: true };
    const store = createStore(initialState);

    store.setState({ path: '/settings' });

    expect(store.getState()).toEqual({ path: '/settings', animated: true });
    expect(initialState).toEqual({ path: '/', animated: true });
  });

  it('notifies its subscribers of every change and stops when unsubscribed', () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.setState({ count: 1 });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.setState({ count: 2 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getState()).toEqual({ count: 2 });
  });

  it('re-renders what a selector reads, and skips what it does not', async () => {
    const store = createStore({ path: '/', animated: true });

    function Path() {
      const path = store.useSelector((state) => state.path);

      return <span>{path === '/' ? 'home' : path}</span>;
    }

    const rendered = await render(<Path />);

    expect(rendered.find('span').textContent).toBe('home');

    await act(() => {
      store.setState({ animated: false });
    });

    expect(rendered.find('span').textContent).toBe('home');

    await act(() => {
      store.setState({ path: '/settings' });
    });

    expect(rendered.find('span').textContent).toBe('/settings');
  });
});
