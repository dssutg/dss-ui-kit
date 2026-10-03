import { useEventListener } from './use_event_listener';

/**
 * Keeps two scrollable elements at the same scroll position.
 *
 * For two views of one document side by side. It mirrors the position rather than the content, so the
 * two must hold the same thing for the result to be right, and `enabled` exists for a panel that shows
 * one view at a narrow width.
 */
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
