import type { EditorRecord } from './editor_history';

/**
 * Surround the selected text with a pair of characters, the way an editor does when a bracket or a
 * quote key is pressed over a selection.
 *
 * The caret is left covering the whole wrapped selection, so that typing inside the new pair is
 * what the next keystroke replaces.
 */
export function wrapSelectionWithPair(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  chars: string[],
): EditorRecord {
  return {
    value:
      value.slice(0, Math.max(0, selectionStart)) +
      chars[0] +
      value.substring(selectionStart, selectionEnd) +
      chars[1] +
      value.slice(Math.max(0, selectionEnd)),
    // Update caret position
    selectionStart,
    selectionEnd: selectionEnd + 2,
  };
}
