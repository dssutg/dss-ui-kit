import { useEffect, useRef, useState } from 'react';

/**
 * The library's event bus.
 *
 * A single `CustomEvent` on `window` carries every message, so an emitter and a listener do not have
 * to know about each other and a component can be torn down without unwiring anyone. The bus is
 * generic: it has no opinion about what an event means, which is why there is no list of event names
 * here. A consumer declares its own.
 *
 * For the untyped form, {@link emitEvent} and {@link useEvent} take any string.
 *
 * For the typed form, a consumer augments {@link EventTypes} by declaration merging and gets its own
 * event names checked in both directions:
 *
 * ```ts
 * declare module 'dss-ui-kit' {
 *   interface EventTypes {
 *     CART_CHANGED: { itemCount: number };
 *   }
 * }
 * ```
 *
 * Then `emitTypedEvent('CART_CHANGED', { itemCount: 3 })` and
 * `useTypedEvent('CART_CHANGED', ({ itemCount }) => …)` are both type-checked, and a misspelled name
 * is a compile error rather than a message nobody is listening for.
 *
 * The interface is empty on purpose. An empty interface is what makes declaration merging possible;
 * a consumer that never augments it can still use the untyped form.
 */
// biome-ignore lint/style/noEmptyInterface: an empty interface is the extension point consumers merge into
export type EventTypes = {};

interface EventDetail<T = undefined> {
  id: string;
  data?: T | undefined;
}

const EVENT_CATEGORY = 'ui-kit:event';

/**
 * Emits an event.
 *
 * A `data` of `undefined` is dropped, so a listener sees `undefined` for an event that carries no
 * payload and cannot tell the difference between "emitted with no payload" and "never emitted".
 */
export function emitEvent<T>(eventId: string, data?: T): void {
  // The key is omitted rather than set to `undefined`, so a listener can tell an event that carries
  // no payload from one that was never emitted.
  const detail: EventDetail<T> = data === undefined ? { id: eventId } : { id: eventId, data };

  window.dispatchEvent(new CustomEvent<EventDetail<T>>(EVENT_CATEGORY, { detail }));
}

/**
 * Subscribes to an event for as long as the calling component is mounted.
 *
 * The callback is held in a ref and updated on every render, so a caller does not have to memoise it
 * and cannot subscribe twice by accident. An event that arrives before the first paint of a component
 * is missed, as with any subscription: this is for reacting to change, not for reading initial state.
 */
export function useEvent<T>(eventId: string, callback: (data: T | undefined) => void): void {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    function handleEvent(event: Event) {
      const detail = (event as CustomEvent<EventDetail<T>>).detail;
      if (detail.id === eventId) {
        callbackRef.current(detail.data);
      }
    }

    window.addEventListener(EVENT_CATEGORY, handleEvent);
    return () => {
      window.removeEventListener(EVENT_CATEGORY, handleEvent);
    };
  }, [eventId]);
}

/**
 * Subscribes to an event exactly once, for code outside React that runs once rather than on render.
 *
 * The listener removes itself after the first matching event, so this is for a one-shot reaction. For
 * anything that re-runs, use {@link useEvent}.
 */
export function onEvent<T>(eventId: string, callback: (data: T | undefined) => void): void {
  function handleEvent(event: Event) {
    const detail = (event as CustomEvent<EventDetail<T>>).detail;
    if (detail.id !== eventId) {
      return;
    }
    window.removeEventListener(EVENT_CATEGORY, handleEvent);
    callback(detail.data);
  }

  window.addEventListener(EVENT_CATEGORY, handleEvent);
}

/**
 * Emits an event whose name and payload shape are declared in {@link EventTypes}.
 *
 * A name the consumer has not declared is a compile error, so the typed and untyped forms cannot
 * drift apart unnoticed.
 */
export function emitTypedEvent<T extends keyof EventTypes>(eventId: T, data: EventTypes[T]): void {
  emitEvent(eventId, data);
}

/** Subscribes to a declared event for the lifetime of the calling component. */
export function useTypedEvent<T extends keyof EventTypes>(
  eventId: T,
  callback: (data: EventTypes[T]) => void,
): void {
  useEvent<EventTypes[T]>(eventId, (data) => {
    if (data !== undefined) {
      callback(data);
    }
  });
}

/**
 * The payload of the most recent emission of a declared event, or `null` before the first one.
 *
 * Use this to render a value another part of the application changed. It is a snapshot, not a
 * subscription to the source: an event that fires while the component is unmounted is not seen, so a
 * component that mounts late reads `null` and should fetch what it needs.
 */
export function useTypedEventData<T extends keyof EventTypes>(eventId: T): EventTypes[T] | null {
  const [data, setData] = useState<EventTypes[T] | null>(null);

  useEvent<EventTypes[T]>(eventId, (incoming) => {
    if (incoming !== undefined) {
      setData(incoming);
    }
  });

  return data;
}
