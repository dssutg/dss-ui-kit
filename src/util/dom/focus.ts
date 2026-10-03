import { DOMRectContainsPoint } from './geometry';

/**
 * Whether the user's focus is currently in a text-entry input.
 *
 * Only real `INPUT` and `TEXTAREA` elements count, deliberately not `contenteditable` and not
 * `select`: the question this answers is whether a keyboard shortcut should be suppressed because
 * the user is typing, and a `contenteditable` node would have made the test a tree walk for a case
 * nothing here needed. A focused `select` is navigating a list, not entering text.
 *
 * Reading `document.activeElement` off a detached document can return `null`, which is why the
 * falsy check rather than a tag test alone.
 */
export function hasUserFocusedInput() {
  const focusedElement = document.activeElement;

  if (!focusedElement) {
    return false;
  }

  const tag = focusedElement.tagName;

  return tag === 'INPUT' || tag === 'TEXTAREA';
}

/**
 * Calls `onClick` when a click landed on the backdrop rather than inside `targetElement`.
 *
 * Containment is decided from the target's bounding rect rather than the event's `target`, because
 * the overlay pattern this exists for — a panel with a full-viewport backdrop element — loses the
 * distinction the moment the click hits a child of the panel. A click on the border row itself
 * counts as inside; see {@link DOMRectContainsPoint}.
 *
 * The event is stopped by default, before the containment check, so an outside click never reaches
 * whatever sits behind the overlay; pass `stopPropagation: false` when the caller needs the rest of
 * the tree to still see the event. A `null` target is tolerated rather than asserted because
 * overlays are regularly unmounted by the very key or scroll event arriving alongside the click.
 */
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
