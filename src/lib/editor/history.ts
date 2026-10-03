import { useCallback } from 'react';

export interface EditorRecord {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export interface EditorHistory {
  stack: (EditorRecord & { timestamp: number })[];
  offset: number;
}

export interface EditorHistoryRefs {
  readonly historyRef: { current: EditorHistory };
  readonly inputRef: { current: HTMLTextAreaElement | null };
  readonly onValueChange: ((value: string) => void) | undefined;
}

const HISTORY_LIMIT = 100;
const HISTORY_TIME_GAP = 3000;

/**
 * The lines before a caret position. A position outside the text is clamped to its start, so the
 * returned lines are always the ones the caret sits in or before.
 */
export function getLines(text: string, position: number): string[] {
  return text.slice(0, Math.max(0, position)).split('\n');
}

/**
 * Drop the redo operations, then the oldest entries, so that undo never walks further back than
 * `HISTORY_LIMIT` steps.
 *
 * `stack` is the stack as it stood *before* the redo operations were dropped, which is what the
 * overflow trim reads from.
 */
function discardRedoAndOldestEntries(
  history: EditorHistory,
  stack: EditorHistory['stack'],
  offset: number,
): void {
  // When something updates, drop the redo operations
  history.stack = stack.slice(0, offset + 1);

  // Limit the number of operations to 100
  const count = history.stack.length;

  if (count > HISTORY_LIMIT) {
    const extras = count - HISTORY_LIMIT;

    history.stack = stack.slice(extras, count);
    history.offset = Math.max(history.offset - extras, 0);
  }
}

/**
 * Whether a record carries on from the word the previous entry ended with, typed shortly after it.
 *
 * This is what makes undo remove a whole typed word rather than the keystroke that completed it.
 */
function isSameWordContinuation(
  last: EditorRecord & { timestamp: number },
  record: EditorRecord,
  timestamp: number,
): boolean {
  // A previous entry exists and was in short interval
  if (timestamp - last.timestamp >= HISTORY_TIME_GAP) {
    return false;
  }

  // Match the last word in the line
  const regex = /[^\da-z]([\da-z]+)$/i;

  // Get the previous line
  const previous = getLines(last.value, last.selectionStart).slice(-1)[0]?.match(regex);

  // Get the current line
  const current = getLines(record.value, record.selectionStart).slice(-1)[0]?.match(regex);

  const previousWord = previous?.[1];
  const currentWord = current?.[1];

  if (previousWord === undefined || currentWord === undefined) {
    return false;
  }

  // The last word of the previous line and current line match
  return currentWord.startsWith(previousWord);
}

/**
 * The editor's undo stack, together with the operations that read it, extend it and rewind it.
 *
 * An edit is only ever applied through `applyEdits`, which records it and then writes it into the
 * textarea, so undo and redo only ever restore a record that is already on the stack.
 */
export function useEditorHistory({ historyRef, inputRef, onValueChange }: EditorHistoryRefs) {
  const recordChange = useCallback(
    (record: EditorRecord, overwrite = false) => {
      const { stack, offset } = historyRef.current;

      if (stack.length && offset > -1) {
        discardRedoAndOldestEntries(historyRef.current, stack, offset);
      }

      const timestamp = Date.now();
      const last = overwrite ? historyRef.current.stack[historyRef.current.offset] : undefined;

      if (last && isSameWordContinuation(last, record, timestamp)) {
        // Overwrite previous entry so that undo will remove whole word
        historyRef.current.stack[historyRef.current.offset] = {
          ...record,
          timestamp,
        };

        return;
      }

      // Add the new operation to the stack
      historyRef.current.stack = [...historyRef.current.stack, { ...record, timestamp }];
      historyRef.current.offset = historyRef.current.offset + 1;
    },
    [historyRef],
  );

  const updateInput = (record: EditorRecord) => {
    const input = inputRef.current;

    if (!input) {
      return;
    }

    // Update values and selection state
    input.value = record.value;
    input.selectionStart = record.selectionStart;
    input.selectionEnd = record.selectionEnd;

    onValueChange?.(record.value);
  };

  const applyEdits = (record: EditorRecord) => {
    // Save last selection state
    const input = inputRef.current;
    const last = historyRef.current.stack[historyRef.current.offset];

    if (last && input) {
      historyRef.current.stack[historyRef.current.offset] = {
        ...last,
        selectionStart: input.selectionStart,
        selectionEnd: input.selectionEnd,
      };
    }

    // Save the changes
    recordChange(record);
    updateInput(record);
  };

  const undoEdit = () => {
    const { stack, offset } = historyRef.current;

    // Get the previous edit
    const record = stack[offset - 1];

    if (record) {
      // Apply the changes and update the offset
      updateInput(record);
      historyRef.current.offset = Math.max(offset - 1, 0);
    }
  };

  const redoEdit = () => {
    const { stack, offset } = historyRef.current;

    // Get the next edit
    const record = stack[offset + 1];

    if (record) {
      // Apply the changes and update the offset
      updateInput(record);
      historyRef.current.offset = Math.min(offset + 1, stack.length - 1);
    }
  };

  return { applyEdits, recordChange, redoEdit, undoEdit };
}
