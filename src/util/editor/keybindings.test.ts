// The key handling is pure: no DOM is touched, and the node environment is the one a keystroke
// arrives in outside a browser. This file does not need document at all.
// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { getLines } from './history';
import { type EditorKeyHandlers, handleEditorKeyDown } from './keybindings';

const KEYCODES = {
  Z: 90,
  Y: 89,
  M: 77,
  PARENS: 57,
  BRACKETS: 219,
  QUOTE: 222,
  BACK_QUOTE: 192,
} as const;

/** A keydown the handlers can read the way a textarea would report one. */
function keyDownEvent(options: {
  key?: string;
  keyCode?: number;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  value?: string;
  selectionStart?: number;
  selectionEnd?: number;
}): KeyboardEvent<HTMLTextAreaElement> {
  const {
    key = 'Unidentified',
    keyCode = 0,
    ctrlKey = false,
    shiftKey = false,
    altKey = false,
    metaKey = false,
    value = '',
    selectionStart = 0,
    selectionEnd = 0,
  } = options;

  let prevented = false;

  const target = {
    value,
    selectionStart,
    selectionEnd,
  } as HTMLTextAreaElement;

  return {
    key,
    keyCode,
    ctrlKey,
    shiftKey,
    altKey,
    metaKey,
    currentTarget: target,
    preventDefault() {
      prevented = true;
    },
    get defaultPrevented() {
      return prevented;
    },
  } as unknown as KeyboardEvent<HTMLTextAreaElement>;
}

function handlersWithRecorder(): EditorKeyHandlers & {
  edits: { value: string; selectionStart: number; selectionEnd: number }[];
} {
  const edits: { value: string; selectionStart: number; selectionEnd: number }[] = [];

  return {
    edits,
    applyEdits: (record) => {
      edits.push(record);
    },
    capture: true,
    ignoreTabKey: false,
    insertSpaces: true,
    redoEdit: () => undefined,
    setCapture: () => undefined,
    tabSize: 4,
    undoEdit: () => undefined,
  };
}

describe('handleEditorKeyDown', () => {
  test('Tab indents a selection spread across lines', () => {
    const handlers = handlersWithRecorder();
    const event = keyDownEvent({
      key: 'Tab',
      value: 'a\nb\nc',
      selectionStart: 2,
      selectionEnd: 4,
    });

    handleEditorKeyDown(event, handlers);

    expect(handlers.edits).toEqual([
      {
        value: 'a\n    b\n    c',
        selectionStart: 2,
        selectionEnd: 12,
      },
    ]);
    expect(event.defaultPrevented).toBe(true);
  });

  test('Shift+Tab unindents', () => {
    const handlers = handlersWithRecorder();
    const event = keyDownEvent({
      key: 'Tab',
      shiftKey: true,
      value: '    a',
      selectionStart: 2,
      selectionEnd: 5,
    });

    handleEditorKeyDown(event, handlers);

    expect(handlers.edits).toEqual([
      {
        value: 'a',
        selectionStart: 2,
        selectionEnd: 1,
      },
    ]);
  });

  test('Tab inserts the tab character at the caret when nothing is selected', () => {
    const handlers = handlersWithRecorder();
    const event = keyDownEvent({ key: 'Tab', value: 'ab', selectionStart: 1, selectionEnd: 1 });

    handleEditorKeyDown(event, handlers);

    expect(handlers.edits).toEqual([{ value: 'a    b', selectionStart: 5, selectionEnd: 5 }]);
  });

  test('ignoreTabKey leaves Tab to the browser', () => {
    const handlers = handlersWithRecorder();
    handlers.ignoreTabKey = true;
    const event = keyDownEvent({ key: 'Tab', value: 'ab', selectionStart: 1, selectionEnd: 1 });

    handleEditorKeyDown(event, handlers);

    expect(handlers.edits).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  test('Backspace over a tab character removes the whole indent', () => {
    const handlers = handlersWithRecorder();
    const event = keyDownEvent({
      key: 'Backspace',
      value: 'a    ',
      selectionStart: 5,
      selectionEnd: 5,
    });

    handleEditorKeyDown(event, handlers);

    expect(handlers.edits).toEqual([{ value: 'a', selectionStart: 1, selectionEnd: 1 }]);
  });

  test('Enter carries the indentation of the current line over', () => {
    const handlers = handlersWithRecorder();
    const event = keyDownEvent({
      key: 'Enter',
      value: '  text',
      selectionStart: 6,
      selectionEnd: 6,
    });

    handleEditorKeyDown(event, handlers);

    expect(handlers.edits).toEqual([{ value: '  text\n  ', selectionStart: 9, selectionEnd: 9 }]);
  });

  test('Enter on an unindented line is left to the browser', () => {
    const handlers = handlersWithRecorder();
    const event = keyDownEvent({ key: 'Enter', value: 'text', selectionStart: 4, selectionEnd: 4 });

    handleEditorKeyDown(event, handlers);

    expect(handlers.edits).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  test('a wrapping key over a selection wraps it in the pair', () => {
    const handlers = handlersWithRecorder();
    const event = keyDownEvent({
      keyCode: KEYCODES.PARENS,
      shiftKey: true,
      value: 'ab',
      selectionStart: 0,
      selectionEnd: 2,
    });

    handleEditorKeyDown(event, handlers);

    expect(handlers.edits).toEqual([{ value: '(ab)', selectionStart: 0, selectionEnd: 4 }]);
    expect(event.defaultPrevented).toBe(true);
  });

  test('a bracket key wraps with brackets or braces by shift', () => {
    const handlers = handlersWithRecorder();
    const event = keyDownEvent({
      keyCode: KEYCODES.BRACKETS,
      value: 'ab',
      selectionStart: 0,
      selectionEnd: 2,
    });

    handleEditorKeyDown(event, handlers);

    expect(handlers.edits[0]?.value).toBe('[ab]');
  });

  test('Ctrl+Z undoes, Ctrl+Shift+Z redoes', () => {
    const undoCalls: number[] = [];
    const redoCalls: number[] = [];
    const handlers = handlersWithRecorder();
    handlers.undoEdit = () => undoCalls.push(1);
    handlers.redoEdit = () => redoCalls.push(1);

    handleEditorKeyDown(keyDownEvent({ keyCode: KEYCODES.Z, ctrlKey: true }), handlers);
    expect(undoCalls).toEqual([1]);
    expect(redoCalls).toEqual([]);

    handleEditorKeyDown(
      keyDownEvent({ keyCode: KEYCODES.Z, ctrlKey: true, shiftKey: true }),
      handlers,
    );
    expect(redoCalls).toEqual([1]);
  });

  test('Ctrl+M toggles tab capture', () => {
    const toggles: boolean[] = [];
    const handlers = handlersWithRecorder();
    handlers.setCapture = (update) => {
      toggles.push(update(handlers.capture));
    };

    handleEditorKeyDown(keyDownEvent({ keyCode: KEYCODES.M, ctrlKey: true }), handlers);

    expect(toggles).toEqual([false]);
  });
});

describe('getLines', () => {
  test('answers the lines up to and including the one the caret is in', () => {
    expect(getLines('one\ntwo\nthree', 8)).toEqual(['one', 'two', '']);
    expect(getLines('one', 3)).toEqual(['one']);
  });
});
