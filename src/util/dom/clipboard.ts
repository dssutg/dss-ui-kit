/**
 * Copies text to the clipboard, resolving once the copy has happened.
 *
 * The async Clipboard API (`navigator.clipboard`) is preferred, but it exists only in secure
 * contexts and can still reject for reasons outside the caller's control — a denied permission, the
 * document losing focus mid-call. Rather than surface that as a copy that silently failed, a
 * rejection falls back to the deprecated `document.execCommand('copy')` route, which is what
 * non-secure pages and older browsers have to use anyway.
 *
 * The fallback briefly appends a hidden, fixed-position `<textarea>` and focuses it, which steals
 * focus from whatever the user had selected; that is an acceptable cost for an explicit
 * user-initiated copy, and the reason this must not be called on page load or inside effects.
 *
 * The promise rejects only if even the fallback throws. `execCommand('copy')` reports failure by
 * returning `false` rather than throwing, so a fallback copy that the browser silently dropped still
 * resolves — callers wanting certainty over the copy would need to read the clipboard back
 * themselves, which no component here does.
 */
export function copyToClipboard(text: string): Promise<void> {
  function fallbackCopy(text: string, resolve: () => void, reject: (reason?: unknown) => void) {
    const textarea = document.createElement('textarea');

    textarea.value = text;

    // Prevent scrolling to the bottom of the page in IE
    textarea.style.position = 'fixed';
    // Hide the textarea
    textarea.style.opacity = '0';
    // Prevent interactions
    textarea.style.pointerEvents = 'none';

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      // Copy the text
      document.execCommand('copy');
      resolve();
    } catch (error) {
      reject(error);
    } finally {
      // Clean up
      textarea.remove();
    }
  }

  return new Promise((resolve, reject) => {
    // Check for the clipboard API
    if (navigator.clipboard !== undefined) {
      // Use the clipboard API if available
      navigator.clipboard
        .writeText(text)
        .then(() => resolve())
        .catch((error) => {
          console.error('Failed to copy using clipboard API: ', error);
          fallbackCopy(text, resolve, reject);
        });
    } else {
      // Fallback for older browsers and non-secure contexts
      fallbackCopy(text, resolve, reject);
    }
  });
}
