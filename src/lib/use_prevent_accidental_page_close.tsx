import { useEventListener } from './use_event_listener';

export function usePreventAccidentalPageClose(enabled: boolean) {
  useEventListener('beforeunload', (event: Event) => {
    if (enabled) {
      event.preventDefault();
    }
  });
}
