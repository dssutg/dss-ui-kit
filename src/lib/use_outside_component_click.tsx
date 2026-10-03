import { useEffect } from 'react';

/**
 * Calls back when a click lands outside an element — for closing a popover or a dropdown.
 *
 * The listener is on the capture phase, so a click on a control that stops propagation is still seen:
 * a menu whose own trigger stops the click from bubbling would otherwise never close. A ref that is
 * still null on mount registers nothing rather than throwing.
 */
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
