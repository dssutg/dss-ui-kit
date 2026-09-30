import { useEffect } from 'react';

// Detect clicks outside component

export function useOutsideComponentClick(
  componentRef: React.RefObject<HTMLElement | null>,
  onOutside: () => void,
) {
  useEffect(() => {
    if (!componentRef?.current) {
      return undefined;
    }

    const element = componentRef.current;

    const onClickInsideWindow = (event: MouseEvent) => {
      if (!element.contains(event.target as Node)) {
        onOutside();
      }
    };

    window.addEventListener('click', onClickInsideWindow, true);

    return () => window.removeEventListener('click', onClickInsideWindow, true);
  }, [componentRef, onOutside]);
}
