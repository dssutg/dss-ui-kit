import { describe, expect, test } from 'vitest';
import { getLines } from './history';
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

describe('getLines', () => {
  test('splits the text before a caret into lines', () => {
    expect(getLines('a\nb\nc', 3)).toEqual(['a', 'b']);
  });

  test('clamps a position outside the text to its start', () => {
    expect(getLines('a\nb', -5)).toEqual(['']);
  });
});

describe('getTabCharacter', () => {
  test('repeats spaces to the tab size', () => {
    expect(getTabCharacter(true, 4)).toBe('    ');
  });

  test('repeats the tab character when spaces are off', () => {
    expect(getTabCharacter(false, 4)).toBe('\t\t\t\t');
  });
});

describe('isTabCharacterBeforeCaret', () => {
  test('is true when the text before the caret ends with a whole tab character and nothing is selected', () => {
    expect(isTabCharacterBeforeCaret('a  ', 3, 3, '  ')).toBe(true);
    expect(isTabCharacterBeforeCaret('a b', 3, 3, '  ')).toBe(false);
  });

  test('is false over a selection', () => {
    expect(isTabCharacterBeforeCaret('a  ', 2, 3, '  ')).toBe(false);
  });
});

describe('indentSelectedLines', () => {
  test('prefixes every line the selection touches', () => {
    const record = indentSelectedLines('a\nb\nc', 2, 4, '>>');

    expect(record.value).toBe('a\n>>b\n>>c');
    expect(record.selectionEnd).toBe(8);
  });

  test('moves the caret when the first line carries text', () => {
    const record = indentSelectedLines('a\nb', 1, 1, '>');

    expect(record.selectionStart).toBe(2);
  });
});

describe('unindentSelectedLines', () => {
  test('removes one leading tab character from every line the selection touches', () => {
    const record = unindentSelectedLines('>>a\n>>b\n c', 2, 8, '>>');

    expect(record?.value).toBe('a\nb\n c');
  });

  test('returns undefined when no line in the selection is indented', () => {
    // No record, so the caller records no edit rather than one that rewrites the text with itself.
    expect(unindentSelectedLines('a\nb', 0, 1, '>>')).toBeUndefined();
  });
});

describe('insertTabCharacter', () => {
  test('inserts at the caret and replaces a selection', () => {
    expect(insertTabCharacter('ab', 1, 1, '\t')).toEqual({
      value: 'a\tb',
      selectionStart: 2,
      selectionEnd: 2,
    });
    expect(insertTabCharacter('abc', 1, 2, '>')).toEqual({
      value: 'a>c',
      selectionStart: 2,
      selectionEnd: 2,
    });
  });
});

describe('removeTabCharacterBeforeCaret', () => {
  test('removes the character before the caret and nothing else', () => {
    expect(removeTabCharacterBeforeCaret('a\tb', 2, 2, '\t')).toEqual({
      value: 'ab',
      selectionStart: 1,
      selectionEnd: 1,
    });
  });
});

describe('indentNewLine', () => {
  test('carries the current line indentation into the new line', () => {
    const record = indentNewLine('  text', 6, 6);

    expect(record?.value).toBe('  text\n  ');
    expect(record?.selectionStart).toBe(9);
  });

  test('returns undefined for a line that is not indented', () => {
    // Enter is left to the browser where there is no indentation to carry.
    expect(indentNewLine('text', 4, 4)).toBeUndefined();
  });
});

describe('wrapSelectionWithPair', () => {
  test('surrounds the selection with the pair and leaves the caret covering it', () => {
    const record = wrapSelectionWithPair('abc', 1, 2, ['(', ')']);

    expect(record.value).toBe('a(b)c');
    expect(record.selectionStart).toBe(1);
    expect(record.selectionEnd).toBe(4);
  });
});
