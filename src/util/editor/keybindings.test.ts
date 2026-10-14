// SPDX-License-Identifier: MIT
// The key handling is pure: no DOM is touched, but the platform constants (`isMacLike`,
// `isWindows`) are read from `navigator.platform` once at module load, so the suites that drive
// those branches reload the module under a redefined platform. jsdom ships an empty platform, which
// leaves the module on the every-other-OS branch the default instance covers.
// @vitest-environment jsdom
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { getLines } from './history';
import { type EditorKeyHandlers, handleEditorKeyDown } from './keybindings';

afterEach(() => {
  delete (window.navigator as unknown as { platform?: string }).platform;
  vi.resetModules();
});

/**
 * A fresh copy of the keybindings module with `navigator.platform` set to `platform` first, since
 * the module reads the platform into constants at import time and nothing else can change them.
 */
async function loadForPlatform(platform: string): Promise<typeof import('./keybindings')> {
  vi.resetModules();
  Object.defineProperty(window.navigator, 'platform', {
    configurable: true,
    value: platform,
  });

  return await import('./keybindings');
}

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
}): ReactKeyboardEvent<HTMLTextAreaElement> {
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
  } as unknown as ReactKeyboardEvent<HTMLTextAreaElement>;
}

/** A mutable recorder, so a test can state the behaviour it drives rather than reaching into it. */
function handlersWithRecorder(overrides: Partial<EditorKeyHandlers> = {}): EditorKeyHandlers & {
  edits: { value: string; selectionStart: number; selectionEnd: number }[];
} {
  const edits: { value: string; selectionStart: number; selectionEnd: number }[] = [];

  const base: EditorKeyHandlers = {
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

  return { ...(base as EditorKeyHandlers), ...overrides, edits };
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

  test('Shift+Tab over lines that carry no indent records no edit', () => {
    const handlers = handlersWithRecorder();
    const event = keyDownEvent({
      key: 'Tab',
      shiftKey: true,
      value: 'a\nb',
      selectionStart: 0,
      selectionEnd: 3,
    });

    handleEditorKeyDown(event, handlers);

    expect(handlers.edits).toEqual([]);
  });

  test('Tab inserts the tab character at the caret when nothing is selected', () => {
    const handlers = handlersWithRecorder();
    const event = keyDownEvent({ key: 'Tab', value: 'ab', selectionStart: 1, selectionEnd: 1 });

    handleEditorKeyDown(event, handlers);

    expect(handlers.edits).toEqual([{ value: 'a    b', selectionStart: 5, selectionEnd: 5 }]);
  });

  test('ignoreTabKey leaves Tab to the browser', () => {
    const handlers = handlersWithRecorder({ ignoreTabKey: true });
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
    const handlers = handlersWithRecorder({
      undoEdit: () => undoCalls.push(1),
      redoEdit: () => redoCalls.push(1),
    });

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
    const handlers = handlersWithRecorder({
      setCapture: (update: (previous: boolean) => boolean) => {
        toggles.push(update(true));
      },
    });

    handleEditorKeyDown(keyDownEvent({ keyCode: KEYCODES.M, ctrlKey: true }), handlers);

    expect(toggles).toEqual([false]);
  });

  test('Tab is left to the browser while tab capture is off', () => {
    const handlers = handlersWithRecorder({ capture: false });
    const event = keyDownEvent({ key: 'Tab', value: 'ab', selectionStart: 1, selectionEnd: 1 });

    handleEditorKeyDown(event, handlers);

    expect(handlers.edits).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  test('Backspace without an indent unit behind the caret is left to the browser', () => {
    const handlers = handlersWithRecorder();
    const event = keyDownEvent({
      key: 'Backspace',
      value: 'ab',
      selectionStart: 2,
      selectionEnd: 2,
    });

    handleEditorKeyDown(event, handlers);

    expect(handlers.edits).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  test('Enter over a selection is left to the browser', () => {
    const handlers = handlersWithRecorder();
    const event = keyDownEvent({
      key: 'Enter',
      value: '  text',
      selectionStart: 1,
      selectionEnd: 4,
    });

    handleEditorKeyDown(event, handlers);

    expect(handlers.edits).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  test('a wrapping key without a selection is left to the browser', () => {
    const handlers = handlersWithRecorder();
    const event = keyDownEvent({
      keyCode: KEYCODES.PARENS,
      shiftKey: true,
      value: 'ab',
      selectionStart: 1,
      selectionEnd: 1,
    });

    handleEditorKeyDown(event, handlers);

    expect(handlers.edits).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  test('an unshifted parenthesis opens no pair at all', () => {
    const handlers = handlersWithRecorder();
    const event = keyDownEvent({
      key: '(',
      keyCode: KEYCODES.PARENS,
      value: 'ab',
      selectionStart: 0,
      selectionEnd: 2,
    });

    handleEditorKeyDown(event, handlers);

    expect(handlers.edits).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  test('a quote key wraps with the shift-matched quote character', () => {
    const handlers = handlersWithRecorder();
    const shifted = keyDownEvent({
      keyCode: KEYCODES.QUOTE,
      shiftKey: true,
      value: 'ab',
      selectionStart: 0,
      selectionEnd: 2,
    });

    handleEditorKeyDown(shifted, handlers);

    expect(handlers.edits[0]?.value).toBe('"ab"');

    const unshifted = keyDownEvent({
      key: "'",
      keyCode: KEYCODES.QUOTE,
      value: 'ab',
      selectionStart: 0,
      selectionEnd: 2,
    });

    handleEditorKeyDown(unshifted, handlers);

    expect(handlers.edits[1]?.value).toBe("'ab'");
  });

  test('a shifted bracket key wraps with braces', () => {
    const handlers = handlersWithRecorder();
    const event = keyDownEvent({
      key: '{',
      keyCode: KEYCODES.BRACKETS,
      shiftKey: true,
      value: 'ab',
      selectionStart: 0,
      selectionEnd: 2,
    });

    handleEditorKeyDown(event, handlers);

    expect(handlers.edits[0]?.value).toBe('{ab}');
  });

  test('an unshifted back quote wraps with back quotes', () => {
    const handlers = handlersWithRecorder();
    const event = keyDownEvent({
      key: '`',
      keyCode: KEYCODES.BACK_QUOTE,
      value: 'ab',
      selectionStart: 0,
      selectionEnd: 2,
    });

    handleEditorKeyDown(event, handlers);

    expect(handlers.edits[0]?.value).toBe('`ab`');
  });

  test('Ctrl+Alt+Z is neither undo nor redo', () => {
    const undoCalls: number[] = [];
    const redoCalls: number[] = [];
    const handlers = handlersWithRecorder({
      undoEdit: () => undoCalls.push(1),
      redoEdit: () => redoCalls.push(1),
    });
    const event = keyDownEvent({ keyCode: KEYCODES.Z, ctrlKey: true, altKey: true });

    handleEditorKeyDown(event, handlers);

    expect(undoCalls).toEqual([]);
    expect(redoCalls).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  test('Ctrl+Shift+Alt+Z is redo without the alt modifier', () => {
    const undoCalls: number[] = [];
    const redoCalls: number[] = [];
    const handlers = handlersWithRecorder({
      undoEdit: () => undoCalls.push(1),
      redoEdit: () => redoCalls.push(1),
    });
    const event = keyDownEvent({
      keyCode: KEYCODES.Z,
      ctrlKey: true,
      shiftKey: true,
      altKey: true,
    });

    handleEditorKeyDown(event, handlers);

    expect(undoCalls).toEqual([]);
    expect(redoCalls).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('getLines', () => {
  test('answers the lines up to and including the one the caret is in', () => {
    expect(getLines('one\ntwo\nthree', 8)).toEqual(['one', 'two', '']);
    expect(getLines('one', 3)).toEqual(['one']);
  });
});

describe('handleEditorKeyDown on a Mac', () => {
  test('Cmd+Z undoes and Ctrl+Z does nothing here', async () => {
    const keybindings = await loadForPlatform('MacIntel');
    const undoCalls: number[] = [];
    const redone: boolean[] = [];
    const handlers = handlersWithRecorder({
      undoEdit: () => undoCalls.push(1),
      redoEdit: () => redone.push(true),
    });

    keybindings.handleEditorKeyDown(keyDownEvent({ keyCode: KEYCODES.Z, metaKey: true }), handlers);

    expect(undoCalls).toEqual([1]);

    keybindings.handleEditorKeyDown(keyDownEvent({ keyCode: KEYCODES.Z, ctrlKey: true }), handlers);

    expect(undoCalls).toEqual([1]);
    expect(redone).toEqual([]);
  });

  test('Cmd+Shift+Z redoes, which undo with shift is not allowed to swallow', async () => {
    const keybindings = await loadForPlatform('MacIntel');
    const redoCalls: number[] = [];
    const handlers = handlersWithRecorder({
      redoEdit: () => redoCalls.push(1),
    });

    keybindings.handleEditorKeyDown(
      keyDownEvent({ keyCode: KEYCODES.Z, metaKey: true, shiftKey: true }),
      handlers,
    );

    expect(redoCalls).toEqual([1]);
  });

  test('Ctrl+Shift+M toggles tab capture and Ctrl+M alone does not', async () => {
    const keybindings = await loadForPlatform('MacIntel');
    const toggles: boolean[] = [];
    const handlers = handlersWithRecorder({
      setCapture: (update: (previous: boolean) => boolean) => {
        toggles.push(update(true));
      },
    });

    keybindings.handleEditorKeyDown(keyDownEvent({ keyCode: KEYCODES.M, ctrlKey: true }), handlers);

    expect(toggles).toEqual([]);

    keybindings.handleEditorKeyDown(
      keyDownEvent({ keyCode: KEYCODES.M, ctrlKey: true, shiftKey: true }),
      handlers,
    );

    expect(toggles).toEqual([false]);
  });
});

describe('handleEditorKeyDown on Windows', () => {
  test('Ctrl+Y redoes, Ctrl+Z undoes, and Ctrl+Shift+Z does not redo here', async () => {
    const keybindings = await loadForPlatform('Win32');
    const undoCalls: number[] = [];
    const redoCalls: number[] = [];
    const handlers = handlersWithRecorder({
      undoEdit: () => undoCalls.push(1),
      redoEdit: () => redoCalls.push(1),
    });

    keybindings.handleEditorKeyDown(keyDownEvent({ keyCode: KEYCODES.Y, ctrlKey: true }), handlers);

    expect(redoCalls).toEqual([1]);

    keybindings.handleEditorKeyDown(keyDownEvent({ keyCode: KEYCODES.Z, ctrlKey: true }), handlers);

    expect(undoCalls).toEqual([1]);
    expect(redoCalls).toEqual([1]);
  });

  test('Ctrl+M toggles tab capture, with or without Shift', async () => {
    const keybindings = await loadForPlatform('Win32');
    const toggles: boolean[] = [];
    const handlers = handlersWithRecorder({
      setCapture: (update: (previous: boolean) => boolean) => {
        toggles.push(update(true));
      },
    });

    keybindings.handleEditorKeyDown(keyDownEvent({ keyCode: KEYCODES.M, ctrlKey: true }), handlers);

    keybindings.handleEditorKeyDown(
      keyDownEvent({ keyCode: KEYCODES.M, ctrlKey: true, shiftKey: true }),
      handlers,
    );

    expect(toggles).toEqual([false, false]);
  });
});
