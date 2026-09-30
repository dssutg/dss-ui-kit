import { useEventListener } from '@/lib/use_event_listener';

export function useSyncScroll<T extends HTMLElement>({
  container1,
  container2,
  enabled = true,
}: {
  readonly container1: T | null;
  readonly container2: T | null;
  readonly enabled?: boolean | undefined;
}) {
  useEventListener(
    'scroll',
    () => {
      if (enabled && container1 && container2) {
        container2.scrollTop = container1.scrollTop;
      }
    },
    container1,
  );

  useEventListener(
    'scroll',
    () => {
      if (enabled && container1 && container2) {
        container1.scrollTop = container2.scrollTop;
      }
    },
    container2,
  );
}
