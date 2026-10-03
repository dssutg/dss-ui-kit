import { useEffect, useRef } from 'react';

/**
 * What {@link useEventListener} calls an event with.
 *
 * The event type is the caller's, because the DOM types are loose: a listener for a custom event names
 * the shape it expects and gets a claim the caller is responsible for.
 */
export type EventListenerCallback<E> = (event: E) => void;

/**
 * Adds an event listener for as long as the component is mounted, with the latest callback.
 *
 * The callback is held in a ref, so a caller does not have to memoise it and a render does not
 * re-subscribe: the listener that is attached is always the newest callback. `element` defaults to
 * `window`, and `null` registers nothing — which is how a listener is held off until the element it
 * listens to exists.
 */
export function useEventListener<E>(
  eventType: string,
  callback: EventListenerCallback<E>,
  element: EventTarget | null = window,
) {
  const callbackRef = useRef<EventListenerCallback<E>>(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (element === null || element === undefined) {
      return undefined;
    }

    const handler: EventListener = (event: Event) => {
      callbackRef.current(event as E);
    };

    element.addEventListener(eventType, handler);

    return () => {
      element.removeEventListener(eventType, handler);
    };
  }, [eventType, element]);
}
