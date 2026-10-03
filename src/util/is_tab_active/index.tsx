/**
 * Whether the browser tab the application runs in is the one on screen.
 *
 * A `visibilitychange` listener installed once at module load keeps the answer current, so a component
 * does not have to subscribe to the document itself: the tab going to the background is exactly when a
 * component wants to spend less, and the answer here is one property read rather than a listener of
 * one's own.
 *
 * Loaded for its side effect — the listener is registered when this module is imported, wherever it
 * is imported from.
 */

let isTabActive = true;

document.addEventListener('visibilitychange', () => {
  isTabActive = !document.hidden;
});

/**
 * Whether the tab is currently visible, which is what `document.hidden` would answer, cached.
 *
 * The value updates on `visibilitychange`, so it is correct on the turn after the event, which is the
 * turn anything reading it runs on.
 */
export function isAppTabActive() {
  return isTabActive;
}
