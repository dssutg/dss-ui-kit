import { DOMRectContainsPoint } from './dom_geometry';

export function hasUserFocusedInput() {
  const focusedElement = document.activeElement;

  if (!focusedElement) {
    return false;
  }

  const tag = focusedElement.tagName;

  return tag === 'INPUT' || tag === 'TEXTAREA';
}

export function onBackdropClick<T extends HTMLElement>(
  targetElement: T | null,
  clickEvent: MouseEvent,
  onClick: () => void,
  {
    stopPropagation = true,
  }: {
    readonly stopPropagation?: boolean | undefined;
  } = {},
) {
  if (stopPropagation) {
    clickEvent.stopPropagation();
  }

  if (targetElement) {
    const rect = targetElement.getBoundingClientRect();

    if (!DOMRectContainsPoint(rect, clickEvent.clientX, clickEvent.clientY)) {
      onClick();
    }
  }
}
