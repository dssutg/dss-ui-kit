// SPDX-License-Identifier: MIT
/**
 * `copyToClipboard` prefers the async Clipboard API and falls back to execCommand when the API is
 * absent, rejects or cannot be used; the promise rejects only when even the fallback throws, and
 * `execCommand` reporting `false` still resolves, which is why the resolution path is pinned on its
 * own. The suite stubs `navigator.clipboard` (jsdom provides none) and `document.execCommand`
 * (unimplemented in jsdom) with tracked replacements, and asserts the lifecycle the callers could
 * observe: the `<textarea>` the fallback appends is removed by the time the promise settles, and
 * the API rejection is logged before the fallback runs.
 */
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { copyToClipboard } from './clipboard';

/** The `document.execCommand` jsdom ships as absent; tests swap and restore it. */
const ORIGINAL_EXEC_COMMAND = document.execCommand;

/** The `navigator.clipboard` state, restored after each test. */
let clipboardDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  document.execCommand = ORIGINAL_EXEC_COMMAND;
});

afterEach(() => {
  if (clipboardDescriptor) {
    Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
  } else {
    Reflect.deleteProperty(navigator, 'clipboard');
  }
  document.execCommand = ORIGINAL_EXEC_COMMAND;
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

/** Replaces `navigator.clipboard` until the test ends. */
function stubClipboard(clipboard: Partial<Clipboard> | undefined): void {
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
}

/** Replaces `document.execCommand` until the test ends. */
function stubExecCommand(behaviour: (command: string) => boolean): void {
  document.execCommand = behaviour;
}

describe('copyToClipboard', () => {
  test('writes with the Clipboard API when it exists', async () => {
    const writeText = vi.fn<typeof Clipboard.prototype.writeText>().mockResolvedValue(undefined);
    stubClipboard({ writeText });

    await copyToClipboard('hello');

    expect(writeText).toHaveBeenCalledWith('hello');
    expect(document.body.querySelectorAll('textarea')).toHaveLength(0);
  });

  test('falls back to execCommand when no Clipboard API exists', async () => {
    stubClipboard(undefined);
    const copies: string[] = [];
    stubExecCommand((command) => {
      copies.push(command);
      return true;
    });
    const appended = vi.spyOn(document.body, 'appendChild');

    await expect(copyToClipboard('hello')).resolves.toBeUndefined();

    expect(copies).toContain('copy');
    const appendedTextarea = appended.mock.calls.some(
      (call) => call[0] instanceof HTMLTextAreaElement,
    );
    expect(appendedTextarea).toBe(true);
    expect(document.body.querySelectorAll('textarea')).toHaveLength(0);
  });

  test('fails over to execCommand after a Clipboard API rejection, logging it', async () => {
    const writeFailure = new Error('document lost focus');
    stubClipboard({
      writeText: vi.fn<typeof Clipboard.prototype.writeText>().mockRejectedValue(writeFailure),
    });
    const copies: string[] = [];
    stubExecCommand((command) => {
      copies.push(command);
      return true;
    });
    const consoleError = vi.spyOn(console, 'error');

    await expect(copyToClipboard('hello')).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledWith('Failed to copy using clipboard API: ', writeFailure);
    expect(copies).toContain('copy');
  });

  test('rejects when even the fallback throws', async () => {
    stubClipboard(undefined);
    stubExecCommand(() => {
      throw new Error('clipboard denied');
    });

    await expect(copyToClipboard('hello')).rejects.toThrowError('clipboard denied');
    expect(document.body.querySelectorAll('textarea')).toHaveLength(0);
  });

  test('resolves when execCommand silently reports failure as false', async () => {
    stubClipboard(undefined);
    stubExecCommand(() => false);

    await expect(copyToClipboard('hello')).resolves.toBeUndefined();
  });
});
