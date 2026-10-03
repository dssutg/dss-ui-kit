import { useCallback, useState } from 'react';
import { useEventListener } from '@/util/hooks/use_event_listener';
import { useGranularEffect } from '@/util/hooks/use_granular_effect';
import { clamp } from '@/util/math';

/**
 * How far through the document the reader is, as a percentage from 0 to 100.
 *
 * The document, not a container, and without a scroll listener of its own beyond the one
 * {@link useEventListener} installs — which is why it is a hook a component such as
 * {@link ScrollProgressBar} can call without knowing where it will be mounted.
 */
export function useDocumentScrollPercentage() {
  const [scrollPercentage, setScrollPercentage] = useState(0);

  const updateScrollPercentage = useCallback(() => {
    const container = document.documentElement;
    const scroll = window.scrollY ?? container.scrollTop ?? 0;
    const height = Math.max(1, container.scrollHeight - container.clientHeight);
    const percent = clamp((scroll * 100) / height, 0, 100);

    setScrollPercentage(percent);
  }, []);

  useEventListener('scroll', updateScrollPercentage);

  useGranularEffect(
    () => {
      updateScrollPercentage();
    },
    [],
    [updateScrollPercentage],
  );

  return scrollPercentage;
}
