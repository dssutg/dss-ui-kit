import type { EditorRecord } from './editor_history';
import { getLines } from './editor_history';

/**
 * The character sequence one Tab press inserts: spaces by default, a tab character when
 * `insertSpaces` is off, repeated to the configured tab size.
 */
export function getTabCharacter(insertSpaces: boolean, tabSize: number): string {
  return (insertSpaces ? ' ' : '\t').repeat(tabSize);
}

/**
 * Whether the text before the caret ends with one tab character and nothing is selected.
 *
 * This is the case where Backspace should remove a whole indent rather than the single character
 * the browser would delete by default.
 */
export function isTabCharacterBeforeCaret(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  tabCharacter: string,
): boolean {
  const textBeforeCaret = value.slice(0, Math.max(0, selectionStart));

  return textBeforeCaret.endsWith(tabCharacter) && selectionStart === selectionEnd;
}

/**
 * Remove the leading tab character from every line the selection touches.
 *
 * Returns `undefined` when no line in the selection actually starts with one, so that the caller
 * records no edit at all rather than one that rewrites the text with itself.
 */
export function unindentSelectedLines(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  tabCharacter: string,
): EditorRecord | undefined {
  const linesBeforeCaret = getLines(value, selectionStart);
  const startLine = linesBeforeCaret.length - 1;
  const endLine = getLines(value, selectionEnd).length - 1;
  const nextValue = value
    .split('\n')
    .map((line, index) => {
      if (index >= startLine && index <= endLine && line.startsWith(tabCharacter)) {
        return line.slice(tabCharacter.length);
      }

      return line;
    })
    .join('\n');

  if (value === nextValue) {
    return undefined;
  }

  const startLineText = linesBeforeCaret[startLine];

  return {
    value: nextValue,
    // Move the start cursor if first line in selection was modified
    // It was modified only if it started with a tab
    selectionStart: startLineText?.startsWith(tabCharacter)
      ? selectionStart - tabCharacter.length
      : selectionStart,
    // Move the end cursor by total number of characters removed
    selectionEnd: selectionEnd - (value.length - nextValue.length),
  };
}

/**
 * Insert the tab character at the start of every line the selection touches.
 */
export function indentSelectedLines(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  tabCharacter: string,
): EditorRecord {
  const linesBeforeCaret = getLines(value, selectionStart);
  const startLine = linesBeforeCaret.length - 1;
  const endLine = getLines(value, selectionEnd).length - 1;
  const startLineText = linesBeforeCaret[startLine];

  return {
    value: value
      .split('\n')
      .map((line, index) => {
        if (index >= startLine && index <= endLine) {
          return tabCharacter + line;
        }

        return line;
      })
      .join('\n'),
    // Move the start cursor by number of characters added in first line of selection
    // Don't move it if it there was no text before cursor
    selectionStart:
      startLineText !== undefined && /\S/.test(startLineText)
        ? selectionStart + tabCharacter.length
        : selectionStart,
    // Move the end cursor by total number of characters added
    selectionEnd: selectionEnd + tabCharacter.length * (endLine - startLine + 1),
  };
}

/**
 * Insert the tab character at the caret, replacing the selection.
 */
export function insertTabCharacter(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  tabCharacter: string,
): EditorRecord {
  const updatedSelection = selectionStart + tabCharacter.length;

  return {
    // Insert tab character at caret
    value:
      value.slice(0, Math.max(0, selectionStart)) +
      tabCharacter +
      value.slice(Math.max(0, selectionEnd)),
    // Update caret position
    selectionStart: updatedSelection,
    selectionEnd: updatedSelection,
  };
}

/**
 * Remove the tab character immediately before the caret, leaving the rest of the line alone.
 */
export function removeTabCharacterBeforeCaret(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  tabCharacter: string,
): EditorRecord {
  const updatedSelection = selectionStart - tabCharacter.length;

  return {
    // Remove tab character at caret
    value:
      value.slice(0, Math.max(0, selectionStart - tabCharacter.length)) +
      value.slice(Math.max(0, selectionEnd)),
    // Update caret position
    selectionStart: updatedSelection,
    selectionEnd: updatedSelection,
  };
}

/**
 * Insert a line break at the caret carrying over the indentation of the current line.
 *
 * Returns `undefined` for a line that is not indented, where Enter is left to the browser so that
 * it keeps its own behaviour at the start of a line.
 */
export function indentNewLine(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): EditorRecord | undefined {
  // Get the current line
  const [line] = getLines(value, selectionStart).slice(-1);
  const indentation = line?.match(/^\s+/)?.[0] ?? '';

  if (indentation === '') {
    return undefined;
  }

  // Preserve indentation on inserting a new line
  const indent = `\n${indentation}`;
  const updatedSelection = selectionStart + indent.length;

  return {
    // Insert indentation character at caret
    value:
      value.slice(0, Math.max(0, selectionStart)) + indent + value.slice(Math.max(0, selectionEnd)),
    // Update caret position
    selectionStart: updatedSelection,
    selectionEnd: updatedSelection,
  };
}
