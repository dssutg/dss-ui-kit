import type { KeyboardEvent } from 'react';
import type { EditorRecord } from './history';
import {
  getTabCharacter,
  indentNewLine,
  indentSelectedLines,
  insertTabCharacter,
  isTabCharacterBeforeCaret,
  removeTabCharacterBeforeCaret,
  unindentSelectedLines,
} from './indentation';
import { wrapSelectionWithPair } from './wrapping';

const KEYCODE_Y = 89;
const KEYCODE_Z = 90;
const KEYCODE_M = 77;
const KEYCODE_PARENS = 57;
const KEYCODE_BRACKETS = 219;
const KEYCODE_QUOTE = 222;
const KEYCODE_BACK_QUOTE = 192;

const isWindows =
  typeof window !== 'undefined' && 'navigator' in window && /win/i.test(navigator.platform);
const isMacLike =
  typeof window !== 'undefined' &&
  'navigator' in window &&
  /(mac|iphone|ipod|ipad)/i.test(navigator.platform);

/**
 * Whether a keydown is the redo shortcut for the platform: Cmd+Shift+Z on a Mac, Ctrl+Y on Windows,
 * and Ctrl+Shift+Z everywhere else.
 *
 * Key codes are used rather than key names because the editor reports its own key codes throughout,
 * and `event.key` is `'z'` on a layout where the shortcut letter is elsewhere.
 */
function isRedoShortcut(
  event: KeyboardEvent<HTMLTextAreaElement>,
  isMacLike: boolean,
  isWindows: boolean,
): boolean {
  if (isMacLike) {
    return event.metaKey && event.keyCode === KEYCODE_Z && event.shiftKey;
  }

  if (isWindows) {
    return event.ctrlKey && event.keyCode === KEYCODE_Y;
  }

  return event.ctrlKey && event.keyCode === KEYCODE_Z && event.shiftKey;
}

/**
 * The undo shortcut: Cmd+Z on a Mac, Ctrl+Z everywhere else, and never with Shift or Alt held, so
 * that it cannot swallow the redo shortcut that shares the same key.
 */
function isUndoShortcut(event: KeyboardEvent<HTMLTextAreaElement>): boolean {
  return (
    (isMacLike
      ? event.metaKey && event.keyCode === KEYCODE_Z
      : event.ctrlKey && event.keyCode === KEYCODE_Z) &&
    !event.shiftKey &&
    !event.altKey
  );
}

/**
 * The shortcut that stops the editor from capturing the Tab key, so that the operator can move the
 * focus out of the editor without reaching for the mouse. On a Mac the keystroke has to carry Shift
 * as well; elsewhere it does not.
 */
function isToggleTabCaptureShortcut(event: KeyboardEvent<HTMLTextAreaElement>): boolean {
  return event.keyCode === KEYCODE_M && event.ctrlKey && (isMacLike ? event.shiftKey : true);
}

/**
 * Whether the key can open and close a pair of characters at all. Which pair, and whether the
 * keystroke produces one at all, is decided by {@link getWrappingPair}.
 */
function isWrappingPairKey(event: KeyboardEvent<HTMLTextAreaElement>): boolean {
  return (
    event.keyCode === KEYCODE_PARENS ||
    event.keyCode === KEYCODE_BRACKETS ||
    event.keyCode === KEYCODE_QUOTE ||
    event.keyCode === KEYCODE_BACK_QUOTE
  );
}

/**
 * The pair of characters the keystroke opens and closes, or `undefined` when the keystroke opens no
 * pair at all — an unshifted parenthesis, and a shifted back quote, have no pair to wrap with.
 */
function getWrappingPair(event: KeyboardEvent<HTMLTextAreaElement>): string[] | undefined {
  if (event.keyCode === KEYCODE_PARENS && event.shiftKey) {
    return ['(', ')'];
  }

  if (event.keyCode === KEYCODE_BRACKETS) {
    return event.shiftKey ? ['{', '}'] : ['[', ']'];
  }

  if (event.keyCode === KEYCODE_QUOTE) {
    return event.shiftKey ? ['"', '"'] : ["'", "'"];
  }

  if (event.keyCode === KEYCODE_BACK_QUOTE && !event.shiftKey) {
    return ['`', '`'];
  }

  return undefined;
}

/**
 * What the keystroke handlers need from the editor: the edit entry point, the props that decide
 * which keys are handled at all, and the undo stack operations the shortcuts drive.
 */
export interface EditorKeyHandlers {
  readonly applyEdits: (record: EditorRecord) => void;
  readonly capture: boolean;
  readonly ignoreTabKey: boolean | undefined;
  readonly insertSpaces: boolean;
  readonly redoEdit: () => void;
  readonly setCapture: (update: (previous: boolean) => boolean) => void;
  readonly tabSize: number;
  readonly undoEdit: () => void;
}

function handleTabKeyDown(
  event: KeyboardEvent<HTMLTextAreaElement>,
  tabCharacter: string,
  applyEdits: (record: EditorRecord) => void,
): void {
  const { value, selectionStart, selectionEnd } = event.currentTarget;

  // Prevent focus change
  event.preventDefault();

  if (event.shiftKey) {
    // Unindent selected lines
    const record = unindentSelectedLines(value, selectionStart, selectionEnd, tabCharacter);

    if (record) {
      applyEdits(record);
    }

    return;
  }

  if (selectionStart !== selectionEnd) {
    // Indent selected lines
    applyEdits(indentSelectedLines(value, selectionStart, selectionEnd, tabCharacter));

    return;
  }

  applyEdits(insertTabCharacter(value, selectionStart, selectionEnd, tabCharacter));
}

function handleBackspaceKeyDown(
  event: KeyboardEvent<HTMLTextAreaElement>,
  tabCharacter: string,
  applyEdits: (record: EditorRecord) => void,
): void {
  const { value, selectionStart, selectionEnd } = event.currentTarget;

  if (isTabCharacterBeforeCaret(value, selectionStart, selectionEnd, tabCharacter)) {
    // Prevent default delete behavior
    event.preventDefault();

    applyEdits(removeTabCharacterBeforeCaret(value, selectionStart, selectionEnd, tabCharacter));
  }
}

function handleEnterKeyDown(
  event: KeyboardEvent<HTMLTextAreaElement>,
  applyEdits: (record: EditorRecord) => void,
): void {
  const { value, selectionStart, selectionEnd } = event.currentTarget;

  // Ignore selections
  if (selectionStart === selectionEnd) {
    const record = indentNewLine(value, selectionStart, selectionEnd);

    if (record) {
      event.preventDefault();

      applyEdits(record);
    }
  }
}

function handleWrappingPairKeyDown(
  event: KeyboardEvent<HTMLTextAreaElement>,
  applyEdits: (record: EditorRecord) => void,
): void {
  const { value, selectionStart, selectionEnd } = event.currentTarget;
  const chars = getWrappingPair(event);

  // If text is selected, wrap them in the characters
  if (selectionStart !== selectionEnd && chars) {
    event.preventDefault();

    applyEdits(wrapSelectionWithPair(value, selectionStart, selectionEnd, chars));
  }
}

/**
 * The keystrokes the editor acts on itself, in the order it recognises them: indentation first,
 * then the keys that rewrite what is around the caret, then the undo stack shortcuts.
 *
 * Each branch returns once it has handled its key, so a keystroke that matches no branch is left to
 * the textarea's own behaviour. The handlers read the text and the selection off the event as they
 * run, which is the text the browser holds at that point.
 */
export function handleEditorKeyDown(
  event: KeyboardEvent<HTMLTextAreaElement>,
  handlers: EditorKeyHandlers,
): void {
  const { applyEdits } = handlers;
  const tabCharacter = getTabCharacter(handlers.insertSpaces, handlers.tabSize);

  if (event.key === 'Tab' && !handlers.ignoreTabKey && handlers.capture) {
    handleTabKeyDown(event, tabCharacter, applyEdits);

    return;
  }

  if (event.key === 'Backspace') {
    handleBackspaceKeyDown(event, tabCharacter, applyEdits);

    return;
  }

  if (event.key === 'Enter') {
    handleEnterKeyDown(event, applyEdits);

    return;
  }

  if (isWrappingPairKey(event)) {
    handleWrappingPairKeyDown(event, applyEdits);

    return;
  }

  if (isUndoShortcut(event)) {
    event.preventDefault();

    handlers.undoEdit();

    return;
  }

  if (isRedoShortcut(event, isMacLike, isWindows) && !event.altKey) {
    event.preventDefault();

    handlers.redoEdit();

    return;
  }

  if (isToggleTabCaptureShortcut(event)) {
    event.preventDefault();

    // Toggle capturing tab key so users can focus away
    handlers.setCapture((previous) => !previous);
  }
}
