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
