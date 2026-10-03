import { useEventListener } from './use_event_listener';

/**
 * Asks the browser to confirm before the page is closed, while `enabled` is true.
 *
 * This is the browser's own dialog, so the message is the browser's and cannot be written from here;
 * all a caller can do is ask. Turn it on for an unsaved form and off once it is saved — a confirmation
 * on every navigation is a confirmation nobody reads.
 */
export function usePreventAccidentalPageClose(enabled: boolean) {
  useEventListener('beforeunload', (event: Event) => {
    if (enabled) {
      event.preventDefault();
    }
  });
}
