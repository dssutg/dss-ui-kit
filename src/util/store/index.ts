import { useSyncExternalStore } from 'react';

/**
 * A block of state that lives outside React: read it, patch it, subscribe to it, and render the
 * part of it a component needs.
 *
 * The state is plain values replaced wholesale — a patch is a partial, and there is nothing to
 * update in place. That is the whole of the model, and it is why one store can serve as the shared
 * state of an application without a subscription knowing which part of it changed.
 */
export interface Store<T> {
  /** The current state, for a reader outside React. */
  getState(): T;
  /** Replaces the fields a patch names and notifies the subscribers. */
  setState(patch: Partial<T>): void;
  /** Subscribes to every change; the returned function unsubscribes. */
  subscribe(listener: () => void): () => void;
  /**
   * The part of the state a component renders.
   *
   * A component names what it wants with a selector rather than holding the whole state: a change
   * notifies every subscriber, but `useSyncExternalStore` skips the re-render when the selected
   * value is unchanged — so a change to an unrelated field costs the component nothing.
   */
  useSelector<U>(selector: (state: T) => U): U;
}

/**
 * Creates a store over `initialState`, the application-wide state that is not a component's own.
 *
 * The store is plain data plus a subscriber list, which is what makes it usable from outside React
 * as well as from a component: {@link Store.getState} reads it in an event handler,
 * {@link Store.setState} writes it from one, and {@link Store.useSelector} renders it. Nothing in
 * it fetches, persists or names what the state is about — the shape of the state is the caller's,
 * and this is only the machinery that holds it.
 */
export function createStore<T extends object>(initialState: T): Store<T> {
  let state = initialState;

  const listeners = new Set<() => void>();

  return {
    getState: () => state,

    setState(patch) {
      state = { ...state, ...patch };

      for (const listener of listeners) {
        listener();
      }
    },

    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    useSelector(selector) {
      return useSyncExternalStore(
        (listener) => {
          listeners.add(listener);

          return () => {
            listeners.delete(listener);
          };
        },
        () => selector(state),
      );
    },
  };
}
