// SPDX-License-Identifier: MIT
/**
 * `useEditorHistory` is the editor's undo stack: `applyEdits` is the only way an edit enters it and
 * the textarea it drives, `recordChange` extends it without touching the input, and undo/redo walk
 * the stack one entry at a time. The suite drives the hook through that surface in jsdom —
 * textarea included — and reads the stack through the ref the caller owns, since the contract is
 * what a caller holding that ref observes: overwritten word continuations, redo entries dropped on
 * the next edit, and the 100-entry limit that silently drops the oldest entries.
 */
// @vitest-environment jsdom
import { useRef } from 'react';
import { beforeEach, describe, expect, test } from 'vitest';
import { render } from '@/util/testing/render';
import { type EditorHistory, useEditorHistory } from './history';

/** What the probe exposes for assertions: the caller's ref, the input ref, and the operations. */
interface Captured {
  readonly historyRef: { current: EditorHistory };
  readonly inputRef: { current: HTMLTextAreaElement | null };
  readonly ops: ReturnType<typeof useEditorHistory>;
}

/** The values `onValueChange` reported, filled by the default probe wiring. */
const valueChanges: string[] = [];

let captured: Captured | undefined;

/** The captured state of the last render, failing loudly when a test forgot to render a probe. */
function probe(): Captured {
  if (captured === undefined) {
    throw new Error('a probe must be rendered before its operations are driven');
  }

  return captured;
}

/** The textarea the probe rendered, which every updateInput-driven assertion reads. */
function inputElement(): HTMLTextAreaElement {
  const input = probe().inputRef.current;

  if (input === null) {
    throw new Error('this test rendered its probe without an input');
  }

  return input;
}

function HistoryProbe({
  onValueChange,
  withInput = true,
}: {
  readonly onValueChange?: ((value: string) => void) | undefined;
  readonly withInput?: boolean;
}) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const historyRef = useRef<EditorHistory>({ stack: [], offset: -1 });
  const ops = useEditorHistory({
    historyRef,
    inputRef,
    onValueChange: onValueChange ?? ((value) => valueChanges.push(value)),
  });

  captured = { historyRef, inputRef, ops };

  return withInput ? <textarea ref={inputRef} /> : null;
}

beforeEach(() => {
  captured = undefined;
  valueChanges.length = 0;
});

describe('useEditorHistory', () => {
  test('records the first edit and writes it into the textarea', async () => {
    await render(<HistoryProbe />);

    const state = probe();

    state.ops.applyEdits({ value: 'a', selectionStart: 1, selectionEnd: 1 });

    expect(state.historyRef.current.stack).toEqual([
      { value: 'a', selectionStart: 1, selectionEnd: 1, timestamp: expect.any(Number) },
    ]);
    expect(state.historyRef.current.offset).toBe(0);

    const input = state.inputRef.current;

    expect(input?.value).toBe('a');
    expect(input?.selectionStart).toBe(1);
    expect(input?.selectionEnd).toBe(1);
    expect(valueChanges).toEqual(['a']);
  });

  test('saves the textarea selection onto the entry before a new edit', async () => {
    await render(<HistoryProbe />);

    const state = probe();
    const input = inputElement();

    state.ops.applyEdits({ value: 'hello', selectionStart: 2, selectionEnd: 4 });

    // The operator moved the caret after the first edit landed; the next edit stores that
    // selection on the previous entry, so undo puts the caret where the operator left it.
    input.selectionStart = 0;
    input.selectionEnd = 1;

    state.ops.applyEdits({ value: 'hello', selectionStart: 1, selectionEnd: 1 });

    expect(state.historyRef.current.stack[0]?.selectionStart).toBe(0);
    expect(state.historyRef.current.stack[0]?.selectionEnd).toBe(1);
    expect(state.historyRef.current.offset).toBe(1);
  });

  test('recordChange extends the stack without touching the input', async () => {
    await render(<HistoryProbe />);

    const state = probe();
    const input = state.inputRef.current;

    state.ops.recordChange({ value: 'z', selectionStart: 0, selectionEnd: 0 });

    expect(state.historyRef.current.stack.at(-1)?.value).toBe('z');
    expect(state.historyRef.current.offset).toBe(0);
    expect(input?.value).toBe('');
    expect(valueChanges).toEqual([]);
  });

  test('undo walks back one entry and redo forward, refusing steps off the stack', async () => {
    await render(<HistoryProbe />);

    const state = probe();
    const input = state.inputRef.current;

    state.ops.applyEdits({ value: '11', selectionStart: 1, selectionEnd: 1 });
    state.ops.applyEdits({ value: '22', selectionStart: 2, selectionEnd: 2 });

    state.ops.undoEdit();

    expect(probe().historyRef.current.offset).toBe(0);
    expect(input?.value).toBe('11');
    expect(valueChanges).toEqual(['11', '22', '11']);

    state.ops.undoEdit();

    // One entry before the first is no entry at all: the stack stays put.
    expect(probe().historyRef.current.offset).toBe(0);
    expect(input?.value).toBe('11');

    state.ops.redoEdit();

    expect(probe().historyRef.current.offset).toBe(1);
    expect(input?.value).toBe('22');

    state.ops.redoEdit();

    // One entry past the top is no entry either.
    expect(probe().historyRef.current.offset).toBe(1);
    expect(input?.value).toBe('22');
  });

  test('the next edit after an undo drops the redo entries', async () => {
    await render(<HistoryProbe />);

    const state = probe();
    const input = state.inputRef.current;

    state.ops.applyEdits({ value: '11', selectionStart: 1, selectionEnd: 1 });
    state.ops.applyEdits({ value: '22', selectionStart: 2, selectionEnd: 2 });
    state.ops.applyEdits({ value: '33', selectionStart: 2, selectionEnd: 2 });
    state.ops.undoEdit();

    state.ops.applyEdits({ value: '44', selectionStart: 2, selectionEnd: 2 });

    expect(probe().historyRef.current.stack.map((entry) => entry.value)).toEqual([
      '11',
      '22',
      '44',
    ]);
    expect(probe().historyRef.current.offset).toBe(2);
    expect(input?.value).toBe('44');

    state.ops.redoEdit();

    // The dropped entry cannot be redone: there is nothing after the top any more.
    expect(input?.value).toBe('44');
  });

  test('overwrites the last entry when a typed word carries on from it', async () => {
    await render(<HistoryProbe />);

    const state = probe();

    state.ops.recordChange({ value: 'a word', selectionStart: 6, selectionEnd: 6 });
    state.ops.recordChange({ value: 'a words', selectionStart: 7, selectionEnd: 7 }, true);

    // Undo after "words" removes the whole word, so the two keystrokes are one entry.
    expect(probe().historyRef.current.stack).toHaveLength(1);
    expect(probe().historyRef.current.stack[0]?.value).toBe('a words');
    expect(probe().historyRef.current.stack[0]?.selectionStart).toBe(7);
    expect(probe().historyRef.current.offset).toBe(0);
  });

  test('opens a new entry when the previous one is more than a moment older', async () => {
    await render(<HistoryProbe />);

    const state = probe();

    state.ops.recordChange({ value: 'a word', selectionStart: 6, selectionEnd: 6 });

    const last = state.historyRef.current.stack[0];

    if (last === undefined) {
      throw new Error('the record was not appended');
    }

    last.timestamp = Date.now() - 4000;

    state.ops.recordChange({ value: 'a words', selectionStart: 7, selectionEnd: 7 }, true);

    expect(probe().historyRef.current.stack).toHaveLength(2);
    expect(probe().historyRef.current.stack.at(-1)?.value).toBe('a words');
  });

  test('opens a new entry when either line ends in something no word is made of', async () => {
    await render(<HistoryProbe />);

    const state = probe();

    // The previous entry ends without a word the continuation could extend.
    state.ops.recordChange({ value: '', selectionStart: 0, selectionEnd: 0 });
    state.ops.recordChange({ value: 'a word', selectionStart: 6, selectionEnd: 6 }, true);

    expect(probe().historyRef.current.stack).toHaveLength(2);

    // The current one does, and it is not an extension of the previous word.
    state.ops.recordChange({ value: 'a word other', selectionStart: 12, selectionEnd: 12 }, true);

    expect(probe().historyRef.current.stack).toHaveLength(3);

    // ... and one that ends in a non-word character has no word to match either.
    state.ops.recordChange({ value: 'a word other !', selectionStart: 14, selectionEnd: 14 }, true);

    expect(probe().historyRef.current.stack).toHaveLength(4);
  });

  test('overwriting nothing but the stack top still counts as asking to overwrite', async () => {
    await render(<HistoryProbe />);

    const state = probe();

    state.ops.recordChange({ value: 'a word', selectionStart: 6, selectionEnd: 6 }, true);

    // An empty stack has no last entry an overwrite could land on, so the record is appended.
    expect(probe().historyRef.current.stack).toHaveLength(1);
    expect(probe().historyRef.current.stack[0]?.value).toBe('a word');
  });

  test('drops the oldest entries once the stack is longer than the limit', async () => {
    await render(<HistoryProbe />);

    const state = probe();

    // Values the word-continuation check cannot read a word out of, so every edit is its own entry.
    for (let i = 0; i < 102; i++) {
      state.ops.applyEdits({ value: `v${i}`, selectionStart: 0, selectionEnd: 0 });
    }

    expect(probe().historyRef.current.stack).toHaveLength(101);
    expect(probe().historyRef.current.stack[0]?.value).toBe('v1');
    expect(probe().historyRef.current.offset).toBe(100);
  });

  test('works with no textarea attached, recording edits without writing to an input', async () => {
    await render(<HistoryProbe onValueChange={undefined} withInput={false} />);

    const state = probe();

    state.ops.applyEdits({ value: 'no input', selectionStart: 2, selectionEnd: 2 });

    expect(probe().historyRef.current.stack).toHaveLength(1);
    expect(probe().historyRef.current.stack[0]?.selectionStart).toBe(2);
    expect(valueChanges).toEqual([]);

    // With an entry behind it, the second edit would save a selection onto it — an absent input
    // has none to save, so the entry keeps the selection it was recorded with.
    state.ops.applyEdits({ value: 'no input at all', selectionStart: 4, selectionEnd: 4 });

    expect(probe().historyRef.current.stack[0]?.selectionStart).toBe(2);
    expect(probe().historyRef.current.offset).toBe(1);

    state.ops.undoEdit();

    expect(probe().historyRef.current.offset).toBe(0);
    expect(state.inputRef.current).toBeNull();

    state.ops.redoEdit();

    expect(probe().historyRef.current.offset).toBe(1);
  });
});
