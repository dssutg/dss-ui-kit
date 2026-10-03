/**
 * One binding in a key map: the action it runs, and nothing else.
 *
 * An object rather than the action itself so a binding can carry more than one field later without
 * every key map in the library changing shape.
 */
export interface KeyMapHandler<A> {
  action: A;
}

/**
 * Key codes to actions.
 *
 * Keyed by `KeyboardEvent.code` — the physical key — not by `key`, so a binding works on a keyboard
 * layout that spells the key differently. A shifted binding is written `Shift+<code>` as one key.
 */
export type KeyMap<A> = Readonly<Record<string, KeyMapHandler<A>>>;

/**
 * The functions a {@link KeyMap} names, one per action.
 *
 * A record rather than an array so {@link handleKeyMapKeyDown} can look an action up by name and a
 * missing one is a compile error instead of an undefined call.
 */
export type KeyMapActions<A extends string> = Readonly<Record<A, () => void>>;

/**
 * A key code as it is written on a key cap: `KeyA` as `A`, `Digit4` as `4`, `ArrowLeft` as
 * `Arrow Left`, `BracketLeft` as `[`.
 *
 * Only for display — in a shortcut hint or a settings row. A binding is matched on the code, not on
 * this, because the code is what is stable across layouts.
 */
export function getKeyMapCodeAsHotkey(code: string) {
  return code
    .replace(/(Key|Digit)/, '')
    .replace(/Equal$/, '=')
    .replace(/Minus$/, '-')
    .replace(/ArrowLeft$/, 'Arrow Left')
    .replace(/ArrowRight$/, 'Arrow Right')
    .replace(/ArrowUp$/, 'Arrow Up')
    .replace(/ArrowDown$/, 'Arrow Down')
    .replace(/BracketLeft$/, '[')
    .replace(/BracketRight$/, ']');
}

/**
 * Runs the action bound to a keyboard event, if any, and stops the event going anywhere else.
 *
 * The `Shift+` binding wins when shift is held and exists; a plain binding still runs with shift held
 * if there is no shifted one, which is what makes a binding work on a layout where shift produces a
 * different `code`. `preventDefault` and `stopPropagation` are called only when something is bound, so
 * an unbound key does not quietly swallow a browser shortcut.
 */
export function handleKeyMapKeyDown<A extends string>(
  keyMap: KeyMap<A>,
  actionMap: KeyMapActions<A>,
  event: KeyboardEvent,
) {
  const { code, shiftKey } = event;

  const handler = keyMap[code];
  const shiftHandler = keyMap[`Shift+${code}`];

  if (shiftKey && shiftHandler) {
    event.preventDefault();
    event.stopPropagation();
    actionMap[shiftHandler.action]();
  } else if (handler) {
    event.preventDefault();
    event.stopPropagation();
    actionMap[handler.action]();
  }
}
