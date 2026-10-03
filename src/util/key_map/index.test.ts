import { describe, expect, test } from 'vitest';
import { getKeyMapCodeAsHotkey, handleKeyMapKeyDown, type KeyMap, type KeyMapActions } from './';

describe('getKeyMapCodeAsHotkey', () => {
  test('renders Key codes as the key cap shows them', () => {
    expect(getKeyMapCodeAsHotkey('KeyA')).toBe('A');
  });

  test('renders Digit codes as the digit', () => {
    expect(getKeyMapCodeAsHotkey('Digit4')).toBe('4');
  });

  test('renders arrow codes with a space', () => {
    expect(getKeyMapCodeAsHotkey('ArrowLeft')).toBe('Arrow Left');
    expect(getKeyMapCodeAsHotkey('ArrowRight')).toBe('Arrow Right');
    expect(getKeyMapCodeAsHotkey('ArrowUp')).toBe('Arrow Up');
    expect(getKeyMapCodeAsHotkey('ArrowDown')).toBe('Arrow Down');
  });

  test('renders bracket codes as the bracket', () => {
    expect(getKeyMapCodeAsHotkey('BracketLeft')).toBe('[');
    expect(getKeyMapCodeAsHotkey('BracketRight')).toBe(']');
  });

  test('renders Equal and Minus as the character', () => {
    expect(getKeyMapCodeAsHotkey('Equal')).toBe('=');
    expect(getKeyMapCodeAsHotkey('Minus')).toBe('-');
  });

  test('leaves a code it has no rendering for unchanged', () => {
    expect(getKeyMapCodeAsHotkey('Escape')).toBe('Escape');
    expect(getKeyMapCodeAsHotkey('Enter')).toBe('Enter');
  });
});

describe('handleKeyMapKeyDown', () => {
  const createKeyboardEvent = (code: string, shiftKey = false): KeyboardEvent =>
    ({
      code,
      shiftKey,
      preventedDefault: false,
      stoppedPropagation: false,
      preventDefault() {
        this.preventedDefault = true;
      },
      stopPropagation() {
        this.stoppedPropagation = true;
      },
    }) as unknown as KeyboardEvent;

  const keyMap: KeyMap<'copy' | 'paste' | 'selectAll'> = {
    KeyC: { action: 'copy' },
    'Shift+KeyC': { action: 'selectAll' },
    KeyV: { action: 'paste' },
  };

  const run = (keyMapLocal: KeyMap<'copy' | 'paste' | 'selectAll'>) => {
    const calls: string[] = [];
    const actions: KeyMapActions<'copy' | 'paste' | 'selectAll'> = {
      copy: () => calls.push('copy'),
      paste: () => calls.push('paste'),
      selectAll: () => calls.push('selectAll'),
    };

    return { actions, calls };
  };

  test('runs the action bound to the code', () => {
    const { actions, calls } = run(keyMap);
    const event = createKeyboardEvent('KeyC');

    handleKeyMapKeyDown(keyMap, actions, event);

    expect(calls).toEqual(['copy']);
  });

  test('the Shift+ binding wins when shift is held', () => {
    const { actions, calls } = run(keyMap);
    const event = createKeyboardEvent('KeyC', true);

    handleKeyMapKeyDown(keyMap, actions, event);

    expect(calls).toEqual(['selectAll']);
  });

  test('a plain binding still runs with shift held when there is no shifted one', () => {
    const { actions, calls } = run(keyMap);
    const event = createKeyboardEvent('KeyV', true);

    handleKeyMapKeyDown(keyMap, actions, event);

    expect(calls).toEqual(['paste']);
  });

  test('stops the event when something is bound', () => {
    const { actions } = run(keyMap);
    const event = createKeyboardEvent('KeyC');

    handleKeyMapKeyDown(keyMap, actions, event);

    expect(event.preventedDefault).toBe(true);
    expect(event.stoppedPropagation).toBe(true);
  });

  test('an unbound key runs nothing and is not swallowed', () => {
    const { actions, calls } = run(keyMap);
    const event = createKeyboardEvent('KeyX');

    handleKeyMapKeyDown(keyMap, actions, event);

    expect(calls).toEqual([]);
    expect(event.preventedDefault).toBe(false);
    expect(event.stoppedPropagation).toBe(false);
  });
});
