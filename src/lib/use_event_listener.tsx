import { useEffect, useRef } from 'react';

// For registering event listeners
type EventListenerCallback<E> = (event: E) => void;

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
