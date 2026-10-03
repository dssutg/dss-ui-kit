/**
 * Tests for the key map: how a `KeyboardEvent.code` is rendered as a hotkey label a user reads,
 * and how a key-down dispatches the action bound to the code, honouring Shift. A failure here
 * would mean shortcuts do the wrong thing — or swallow keys nothing is bound to.
 */

import { describe, expect, test } from 'vitest';
import { getKeyMapCodeAsHotkey, handleKeyMapKeyDown, type KeyMap, type KeyMapActions } from './';

/**
 * A `KeyboardEvent.code` becomes the label the key cap shows, and an unmapped code passes through
 * unchanged rather than becoming something unreadable.
 */
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

/**
 * Dispatch: a bound code runs its action, a shifted code prefers the `Shift+` binding when there
 * is one, and any handled event is stopped — while an unbound key is neither run nor swallowed.
 */
describe('handleKeyMapKeyDown', () => {
  const createKeyboardEvent = (code: string, shiftKey = false) => {
    const event = {
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
    };

    return event;
  };

  const keyMap: KeyMap<'copy' | 'paste' | 'selectAll'> = {
    KeyC: { action: 'copy' },
    'Shift+KeyC': { action: 'selectAll' },
    KeyV: { action: 'paste' },
  };

  const run = () => {
    const calls: string[] = [];
    const actions: KeyMapActions<'copy' | 'paste' | 'selectAll'> = {
      copy: () => calls.push('copy'),
      paste: () => calls.push('paste'),
      selectAll: () => calls.push('selectAll'),
    };

    return { actions, calls };
  };

  test('runs the action bound to the code', () => {
    const { actions, calls } = run();
    const event = createKeyboardEvent('KeyC');

    handleKeyMapKeyDown(keyMap, actions, event as unknown as KeyboardEvent);

    expect(calls).toEqual(['copy']);
  });

  test('the Shift+ binding wins when shift is held', () => {
    const { actions, calls } = run();
    const event = createKeyboardEvent('KeyC', true);

    handleKeyMapKeyDown(keyMap, actions, event as unknown as KeyboardEvent);

    expect(calls).toEqual(['selectAll']);
  });

  test('a plain binding still runs with shift held when there is no shifted one', () => {
    const { actions, calls } = run();
    const event = createKeyboardEvent('KeyV', true);

    handleKeyMapKeyDown(keyMap, actions, event as unknown as KeyboardEvent);

    expect(calls).toEqual(['paste']);
  });

  test('stops the event when something is bound', () => {
    const { actions } = run();
    const event = createKeyboardEvent('KeyC');

    handleKeyMapKeyDown(keyMap, actions, event as unknown as KeyboardEvent);

    expect(event.preventedDefault).toBe(true);
    expect(event.stoppedPropagation).toBe(true);
  });

  test('an unbound key runs nothing and is not swallowed', () => {
    const { actions, calls } = run();
    const event = createKeyboardEvent('KeyX');

    handleKeyMapKeyDown(keyMap, actions, event as unknown as KeyboardEvent);

    expect(calls).toEqual([]);
    expect(event.preventedDefault).toBe(false);
    expect(event.stoppedPropagation).toBe(false);
  });
});
