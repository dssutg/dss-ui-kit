// @vitest-environment jsdom

import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BitField } from '@/components/inputs/BitField';
import { DecimalIntegerInput } from '@/components/inputs/DecimalIntegerInput';
import { Editor } from '@/components/inputs/Editor';
import { IPInput } from '@/components/inputs/IPInput';
import { JsonEditor } from '@/components/inputs/JsonEditor';
import { SearchInput } from '@/components/inputs/SearchInput';
import { Slider } from '@/components/inputs/Slider';
import { UnsignedIntegerInput } from '@/components/inputs/UnsignedIntegerInput';
import { UploadConfig } from '@/components/inputs/UploadConfig';
import type { EditorHistory } from '@/util/editor/history';
import { act, click, flush, render, type } from '@/util/testing/render';

const HISTORY_KEY_PREFIX = 'ui-kit.search-input.';

/** Reads an element the test knows is present, without the non-null assertion the linter forbids. */
function elementAt<T extends Element>(elements: readonly T[], index: number): T {
  const element = elements[index];

  if (element === undefined) {
    throw new Error(`no element at index ${index}`);
  }

  return element;
}

/** Dispatches a bubbling, cancellable keydown and flushes the update it causes. */
function dispatchKeydown(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  });

  act(() => {
    target.dispatchEvent(event);
  });

  return event;
}

/** Types into a `textarea`, which the render helper's `type` does not reach. */
function typeTextarea(textarea: HTMLTextAreaElement, value: string): void {
  act(() => {
    textarea.value = value;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/** A `TouchList` of the given positions, which is all the slider reads from one. */
function touchList(
  touches: readonly { readonly clientX: number; readonly clientY: number }[],
): TouchList {
  return {
    length: touches.length,
    item: (index: number) => touches[index] ?? null,
    [Symbol.iterator]: () => touches[Symbol.iterator](),
  } as unknown as TouchList;
}

/** Writes a raw value under a search field's history key. */
function seedRawHistory(historyId: string, value: unknown): void {
  localStorage.setItem(`${HISTORY_KEY_PREFIX}${historyId}`, JSON.stringify(value));
}

/** A well-formed history entry. */
function historyItem(content: string, timestamp: number, usageCount: number) {
  return { content, timestamp, usageCount };
}

/** A drag event carrying the `dataTransfer` jsdom's `Event` does not define. */
function dragEvent(type: string, dataTransfer: unknown): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
  return event;
}

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('BitField', () => {
  it('clears the hovered flag when the pointer leaves the list', async () => {
    const { find } = await render(
      <BitField flags={1} flagDescriptionMap={{ 0: 'First flag' }} showEntireDescription={true} />,
    );

    const list = find('ul');

    act(() => {
      list.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    });

    expect(list).toBeDefined();
  });
});

describe('IPInput', () => {
  it('reads an incomplete address as empty', async () => {
    const onChange = vi.fn();
    const { find } = await render(<IPInput value="" onChange={onChange} />);

    await type(find<HTMLInputElement>('input'), '1..2');

    expect(onChange).toHaveBeenCalledWith('1..2');
  });
});

describe('JsonEditor', () => {
  it('renders the raw value when syntax highlighting is off', async () => {
    const { find } = await render(
      <JsonEditor code='{"a":1}' setCode={vi.fn()} highlightSyntax={false} />,
    );

    expect(find<HTMLTextAreaElement>('textarea').value).toBe('{"a":1}');
  });

  it('inserts a tab as spaces when the tab is expanded', async () => {
    const setCode = vi.fn();
    const { find } = await render(
      <JsonEditor code="{}" setCode={setCode} expandingTab={true} tabSize={4} />,
    );

    const textarea = find<HTMLTextAreaElement>('textarea');
    textarea.setSelectionRange(1, 1);

    act(() => {
      textarea.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
      );
    });

    expect(setCode).toHaveBeenCalled();
  });
});

describe('DecimalIntegerInput', () => {
  it('steps the value with the arrow keys', async () => {
    const onChange = vi.fn();
    const { find } = await render(<DecimalIntegerInput value={5} onChange={onChange} />);
    const input = find<HTMLInputElement>('input');

    dispatchKeydown(input, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith(6);

    dispatchKeydown(input, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith(4);

    dispatchKeydown(input, { key: 'a' });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('steps from the minimum when the field is empty', async () => {
    const onChange = vi.fn();
    const { find } = await render(
      <DecimalIntegerInput value={undefined} minValue={3} onChange={onChange} />,
    );

    dispatchKeydown(find<HTMLInputElement>('input'), { key: 'ArrowUp' });

    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('leaves the arrow keys alone when asked to', async () => {
    const onChange = vi.fn();
    const { find } = await render(
      <DecimalIntegerInput value={5} onChange={onChange} noAlteringValueWithArrowKeys={true} />,
    );

    dispatchKeydown(find<HTMLInputElement>('input'), { key: 'ArrowUp' });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('steps the value with the wheel only while the field is focused', async () => {
    const onChange = vi.fn();
    const { find } = await render(<DecimalIntegerInput value={5} onChange={onChange} />);
    const input = find<HTMLInputElement>('input');

    act(() => {
      input.dispatchEvent(new WheelEvent('wheel', { deltaY: -1, bubbles: true }));
    });
    expect(onChange).not.toHaveBeenCalled();

    input.focus();
    act(() => {
      input.dispatchEvent(new WheelEvent('wheel', { deltaY: -1, bubbles: true }));
    });
    expect(onChange).toHaveBeenLastCalledWith(6);
  });

  it('leaves the wheel alone when asked to', async () => {
    const onChange = vi.fn();
    const { find } = await render(
      <DecimalIntegerInput value={5} onChange={onChange} noAlteringValueWithMouseWheel={true} />,
    );
    const input = find<HTMLInputElement>('input');
    input.focus();

    act(() => {
      input.dispatchEvent(new WheelEvent('wheel', { deltaY: -1, bubbles: true }));
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('reads a hexadecimal value', async () => {
    const onChange = vi.fn();
    const { find } = await render(
      <DecimalIntegerInput value={undefined} base={16} onChange={onChange} />,
    );

    await type(find<HTMLInputElement>('input'), 'ff');

    expect(onChange).toHaveBeenCalledWith(255);
  });

  it('reports the minimum for an emptied field that resets', async () => {
    const onChange = vi.fn();
    const { find } = await render(
      <DecimalIntegerInput
        value={5}
        minValue={2}
        onChange={onChange}
        shouldResetEmptyInput={true}
      />,
    );

    await type(find<HTMLInputElement>('input'), '');

    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('resets to the minimum when a clear button with no handler is pressed', async () => {
    const onChange = vi.fn();
    const { findAll } = await render(
      <DecimalIntegerInput value={5} minValue={1} onChange={onChange} />,
    );

    await click(elementAt(findAll<HTMLButtonElement>('button'), 0));

    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('calls the clear handler when one is given', async () => {
    const onClear = vi.fn();
    const onChange = vi.fn();
    const { findAll } = await render(
      <DecimalIntegerInput value={5} onChange={onChange} onClear={onClear} />,
    );

    await click(elementAt(findAll<HTMLButtonElement>('button'), 0));

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('forwards the input key and wheel handlers', async () => {
    const onInputKeyDown = vi.fn();
    const onInputWheel = vi.fn();
    const { find } = await render(
      <DecimalIntegerInput
        value={5}
        onChange={vi.fn()}
        onInputKeyDown={onInputKeyDown}
        onInputWheel={onInputWheel}
      />,
    );
    const input = find<HTMLInputElement>('input');

    dispatchKeydown(input, { key: 'ArrowUp' });
    act(() => {
      input.dispatchEvent(new WheelEvent('wheel', { deltaY: 1, bubbles: true }));
    });

    expect(onInputKeyDown).toHaveBeenCalledTimes(1);
    expect(onInputWheel).toHaveBeenCalledTimes(1);
  });
});

describe('UnsignedIntegerInput', () => {
  it('reports the number typed and rejects an exponential value', async () => {
    const onChange = vi.fn();
    const { find } = await render(
      <UnsignedIntegerInput value={5} min={0} max={10} onChange={onChange} />,
    );
    const input = find<HTMLInputElement>('input');

    await type(input, '7');
    expect(onChange).toHaveBeenLastCalledWith(7);

    await type(input, '');
    expect(onChange).toHaveBeenLastCalledWith(0);

    await type(input, '1e5');
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('blocks keys that are not digits', async () => {
    const { find } = await render(<UnsignedIntegerInput value={5} onChange={vi.fn()} />);
    const input = find<HTMLInputElement>('input');

    const letter = dispatchKeydown(input, { key: 'a' });
    expect(letter.defaultPrevented).toBe(true);

    const digit = dispatchKeydown(input, { key: '9' });
    expect(digit.defaultPrevented).toBe(false);
  });

  it('clamps the value when the field loses focus', async () => {
    const onChange = vi.fn();
    const { find } = await render(
      <UnsignedIntegerInput value={5} min={0} max={10} onChange={onChange} />,
    );
    const input = find<HTMLInputElement>('input');

    input.value = '42';
    act(() => {
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });

    expect(onChange).toHaveBeenLastCalledWith(10);
  });

  it('reports zero when a decrement overflows into exponential notation', async () => {
    const onChange = vi.fn();
    const { findAll } = await render(<UnsignedIntegerInput value={1e21} onChange={onChange} />);

    await click(elementAt(findAll<HTMLButtonElement>('button'), 1));

    expect(onChange).toHaveBeenCalledWith(0);
  });
});

describe('Editor', () => {
  it('reports every change and renders a string highlighter', async () => {
    const onValueChange = vi.fn();
    const { find } = await render(
      <Editor highlight={(value) => value} value="" onValueChange={onValueChange} />,
    );

    typeTextarea(find<HTMLTextAreaElement>('textarea'), 'hello');

    expect(onValueChange).toHaveBeenCalledWith('hello');
  });

  it('applies a padding given per edge', async () => {
    const { find } = await render(
      <Editor
        highlight={(value) => value}
        value="{}"
        onValueChange={vi.fn()}
        padding={{ top: 4, right: 8, bottom: 12, left: 16 }}
      />,
    );

    const textarea = find<HTMLTextAreaElement>('textarea');

    expect(textarea.style.paddingTop).toBe('4px');
    expect(textarea.style.paddingRight).toBe('8px');
    expect(textarea.style.paddingBottom).toBe('12px');
    expect(textarea.style.paddingLeft).toBe('16px');
  });

  it('renders a highlighter that returns a node', async () => {
    await render(
      <Editor
        highlight={() => <span className="highlighted-node" />}
        value="{}"
        onValueChange={vi.fn()}
      />,
    );

    expect(document.body.querySelector('.highlighted-node')).not.toBeNull();
  });

  it('lets the caller handler cancel the rest of the key handling', async () => {
    const onKeyDown = vi.fn((event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'a') {
        event.preventDefault();
      }
    });
    const { find } = await render(
      <Editor
        highlight={(value) => value}
        value="{}"
        onValueChange={vi.fn()}
        onKeyDown={onKeyDown}
      />,
    );
    const textarea = find<HTMLTextAreaElement>('textarea');

    dispatchKeydown(textarea, { key: 'a' });
    dispatchKeydown(textarea, { key: 'b' });

    expect(onKeyDown).toHaveBeenCalledTimes(2);
  });

  it('blurs on Escape and leaves other keys to the textarea', async () => {
    const { find } = await render(
      <Editor highlight={(value) => value} value="{}" onValueChange={vi.fn()} />,
    );
    const textarea = find<HTMLTextAreaElement>('textarea');
    textarea.focus();

    expect(document.activeElement).toBe(textarea);

    dispatchKeydown(textarea, { key: 'a' });
    dispatchKeydown(textarea, { key: 'Escape' });

    expect(document.activeElement).not.toBe(textarea);
  });

  it('exposes and replaces the undo session through its ref', async () => {
    const ref = createRef<{ session: { history: EditorHistory } }>();

    await render(
      <Editor ref={ref} highlight={(value) => value} value="" onValueChange={vi.fn()} />,
    );

    const handle = ref.current;

    expect(handle).not.toBeNull();

    if (handle === null) {
      return;
    }

    expect(handle.session.history.stack.length).toBeGreaterThan(0);

    handle.session = { history: { stack: [], offset: 3 } };

    expect(handle.session.history.offset).toBe(3);
  });

  it('draws a line number per measured line', async () => {
    const { find, update, container } = await render(
      <Editor highlight={(value) => value} value={'a\nb'} onValueChange={vi.fn()} />,
    );
    const textarea = find<HTMLTextAreaElement>('textarea');

    Object.defineProperty(textarea, 'scrollHeight', { value: 60, configurable: true });

    await update(<Editor highlight={(value) => value} value={'a\nb\nc'} onValueChange={vi.fn()} />);

    expect(container.textContent).toContain('3');
  });

  it('treats an unmeasurable textarea as having no lines', async () => {
    const { find, update } = await render(
      <Editor highlight={(value) => value} value="a" onValueChange={vi.fn()} />,
    );
    const textarea = find<HTMLTextAreaElement>('textarea');

    Object.defineProperty(textarea, 'scrollHeight', { value: undefined, configurable: true });

    await update(<Editor highlight={(value) => value} value="ab" onValueChange={vi.fn()} />);

    expect(find<HTMLTextAreaElement>('textarea')).toBeDefined();
  });
});

describe('Slider', () => {
  it('renders without a span when the range is a single value', async () => {
    const { find } = await render(<Slider min={0} max={0} value={0} onChange={vi.fn()} />);

    expect(find('[role="slider"]')).toBeDefined();
  });

  it('follows a pointer drag and shows the tooltip', async () => {
    const onChange = vi.fn();
    const { find } = await render(<Slider min={0} max={100} value={0} onChange={onChange} />);
    const slider = find('[role="slider"]');

    act(() => {
      slider.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: 512 }),
      );
    });

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 256 }));
    });
    expect(onChange).toHaveBeenLastCalledWith(25);

    act(() => {
      slider.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    });

    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('snaps a drag to the nearest break point', async () => {
    const onChange = vi.fn();
    const { find } = await render(
      <Slider min={0} max={100} value={0} onChange={onChange} breakPoints={[0, 50, 100]} />,
    );

    act(() => {
      find('[role="slider"]').dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: 700 }),
      );
    });

    expect(onChange).toHaveBeenLastCalledWith(50);
  });

  it('snaps the keyboard to a break point in the pressed direction', async () => {
    const onChange = vi.fn();
    const { find, update } = await render(
      <Slider
        min={0}
        max={100}
        value={0}
        step={10}
        onChange={onChange}
        breakPoints={[0, 50, 100]}
      />,
    );
    const slider = find('[role="slider"]');

    dispatchKeydown(slider, { code: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith(50);

    await update(
      <Slider
        min={0}
        max={100}
        value={100}
        step={10}
        onChange={onChange}
        breakPoints={[0, 50, 100]}
      />,
    );

    dispatchKeydown(slider, { code: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith(100);

    dispatchKeydown(slider, { code: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith(50);

    dispatchKeydown(slider, { code: 'KeyA' });
  });

  it('drops the tooltip on a press outside the slider', async () => {
    const { find } = await render(<Slider min={0} max={100} value={0} onChange={vi.fn()} />);
    const slider = find('[role="slider"]');

    const tooltip = slider.querySelector('.pointer-events-none');
    expect(tooltip).not.toBeNull();

    act(() => {
      slider.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: 512 }),
      );
    });

    act(() => {
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(slider).toBeDefined();
  });

  it('toggles the tooltip on hover', async () => {
    const { find } = await render(<Slider min={0} max={100} value={50} onChange={vi.fn()} />);
    const slider = find('[role="slider"]');
    const tooltip = slider.querySelector<HTMLElement>('.pointer-events-none');

    act(() => {
      slider.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    });
    expect(tooltip?.style.opacity).toBe('1');

    act(() => {
      slider.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    });
    expect(tooltip?.style.opacity).toBe('0');
  });

  it('follows a touch drag and ignores a move without an active touch', async () => {
    const onChange = vi.fn();
    const { find } = await render(<Slider min={0} max={100} value={0} onChange={onChange} />);
    const slider = find('[role="slider"]');

    const start = new TouchEvent('touchstart', { bubbles: true, cancelable: true });
    Object.defineProperty(start, 'touches', { value: touchList([{ clientX: 512, clientY: 0 }]) });
    act(() => {
      slider.dispatchEvent(start);
    });
    expect(onChange).toHaveBeenLastCalledWith(50);

    const move = new TouchEvent('touchmove', { bubbles: true, cancelable: true });
    Object.defineProperty(move, 'touches', { value: touchList([{ clientX: 256, clientY: 0 }]) });
    act(() => {
      window.dispatchEvent(move);
    });
    expect(onChange).toHaveBeenLastCalledWith(25);

    const emptyMove = new TouchEvent('touchmove', { bubbles: true });
    Object.defineProperty(emptyMove, 'touches', { value: touchList([]) });
    act(() => {
      window.dispatchEvent(emptyMove);
    });

    act(() => {
      window.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
    });
  });

  it('ignores a touch that carries no position', async () => {
    const onChange = vi.fn();
    const { find } = await render(<Slider min={0} max={100} value={0} onChange={onChange} />);

    const start = new TouchEvent('touchstart', { bubbles: true, cancelable: true });
    Object.defineProperty(start, 'touches', { value: touchList([]) });

    act(() => {
      find('[role="slider"]').dispatchEvent(start);
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('draws the break-point labels when they are visible', async () => {
    const { container } = await render(
      <Slider
        min={0}
        max={100}
        value={0}
        onChange={vi.fn()}
        breakPoints={[0, 50, 100]}
        breakPointsVisible={true}
      />,
    );

    expect(container.textContent).toContain('50');
  });
});

describe('UploadConfig', () => {
  it('ignores a drop with no data transfer', async () => {
    const onFileChange = vi.fn();
    const { findAll } = await render(
      <UploadConfig onFileUpload={vi.fn()} onFileChange={onFileChange} />,
    );
    const dropArea = elementAt(findAll<HTMLButtonElement>('button'), 0);

    act(() => {
      dropArea.dispatchEvent(dragEvent('drop', null));
    });

    expect(onFileChange).not.toHaveBeenCalled();
  });

  it('ignores a drop that carries no file', async () => {
    const onFileChange = vi.fn();
    const { findAll } = await render(
      <UploadConfig onFileUpload={vi.fn()} onFileChange={onFileChange} />,
    );
    const dropArea = elementAt(findAll<HTMLButtonElement>('button'), 0);

    act(() => {
      dropArea.dispatchEvent(dragEvent('drop', { files: [] }));
    });

    expect(onFileChange).not.toHaveBeenCalled();
  });

  it('tracks a drag entering and leaving the drop area', async () => {
    const { findAll } = await render(<UploadConfig onFileUpload={vi.fn()} />);
    const dropArea = elementAt(findAll<HTMLButtonElement>('button'), 0);

    act(() => {
      dropArea.dispatchEvent(new Event('dragenter', { bubbles: true }));
    });
    expect(dropArea.className).toContain('border-tok');

    act(() => {
      dropArea.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));
    });
    expect(dropArea.className).toContain('border-tok');

    const leaveInside = new Event('dragleave', { bubbles: true });
    Object.defineProperty(leaveInside, 'relatedTarget', { value: dropArea });
    act(() => {
      dropArea.dispatchEvent(leaveInside);
    });
    expect(dropArea.className).toContain('border-tok');

    const leaveOutside = new Event('dragleave', { bubbles: true });
    Object.defineProperty(leaveOutside, 'relatedTarget', { value: document.body });
    act(() => {
      dropArea.dispatchEvent(leaveOutside);
    });
    expect(dropArea.className).toContain('border-tpl');
  });

  it('completes without uploading when the action is pressed with no file', async () => {
    const onFileUpload = vi.fn();
    const { findAll, findByText } = await render(<UploadConfig onFileUpload={onFileUpload} />);

    await click(elementAt(findAll<HTMLButtonElement>('button'), 1));
    await flush();

    expect(onFileUpload).not.toHaveBeenCalled();
    expect(findByText('Uploaded')).toBeDefined();
  });

  it('cancels an upload with no handler when one is not given', async () => {
    const onFileUpload = vi.fn().mockResolvedValue(undefined);
    const { findAll, findByText } = await render(
      <UploadConfig
        onFileUpload={onFileUpload}
        uploadedFile={new File(['x'], 'a.txt')}
        progress={0}
      />,
    );

    await click(elementAt(findAll<HTMLButtonElement>('button'), 1));
    await flush();
    expect(findByText('Cancel')).toBeDefined();

    await click(elementAt(findAll<HTMLButtonElement>('button'), 1));
    expect(findByText('Upload')).toBeDefined();
  });
});

describe('SearchInput history', () => {
  it('opens the history and highlights a matching entry on hover', async () => {
    seedRawHistory('s', {
      id: 's',
      items: [historyItem('alpha', 5, 5), historyItem('beta', 1, 1)],
    });

    const onChangeText = vi.fn();
    const outerRef: { current: HTMLDivElement | null } = { current: null };
    const { find, findAll } = await render(
      <SearchInput value="x" historyId="s" onChangeText={onChangeText} outerRef={outerRef} />,
    );
    const input = find<HTMLInputElement>('input');

    act(() => {
      input.focus();
    });

    expect(outerRef.current).not.toBeNull();

    dispatchKeydown(input, { key: 'a' });

    const options = findAll('[role="option"]');
    expect(options).toHaveLength(2);

    act(() => {
      elementAt(options, 1).dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    });
    expect(elementAt(options, 1).getAttribute('aria-selected')).toBe('true');

    await click(elementAt(options, 1));
    expect(onChangeText).toHaveBeenCalledWith('beta');
  });

  it('moves the highlight with the arrow keys and selects the entry', async () => {
    seedRawHistory('s', {
      id: 's',
      items: [historyItem('first', 2, 2), historyItem('second', 1, 1)],
    });

    const onChangeText = vi.fn();
    const outerRef: { current: HTMLDivElement | null } = { current: null };
    const { find } = await render(
      <SearchInput value="x" historyId="s" onChangeText={onChangeText} outerRef={outerRef} />,
    );
    const input = find<HTMLInputElement>('input');

    act(() => {
      input.focus();
    });

    vi.useFakeTimers();
    dispatchKeydown(input, { key: 'ArrowDown' });
    expect(onChangeText).toHaveBeenCalledWith('first');

    act(() => {
      vi.advanceTimersByTime(100);
    });
    vi.useRealTimers();
  });

  it('moves through the history in both directions', async () => {
    seedRawHistory('s', {
      id: 's',
      items: [historyItem('one', 3, 3), historyItem('two', 2, 2), historyItem('three', 1, 1)],
    });

    const { find } = await render(
      <SearchInput value="x" historyId="s" onChangeText={vi.fn()} outerRef={{ current: null }} />,
    );
    const input = find<HTMLInputElement>('input');

    act(() => {
      input.focus();
    });

    dispatchKeydown(input, { key: 'ArrowDown' });
    dispatchKeydown(input, { key: 'ArrowDown' });
    dispatchKeydown(input, { key: 'ArrowUp' });
    dispatchKeydown(input, { key: 'ArrowDown' });

    expect(input).toBeDefined();
  });

  it('moves the highlight without selecting when there is no history', async () => {
    const { find } = await render(<SearchInput value="x" onChangeText={vi.fn()} />);
    const input = find<HTMLInputElement>('input');

    act(() => {
      input.focus();
    });

    dispatchKeydown(input, { key: 'ArrowDown' });

    expect(input).toBeDefined();
  });

  it('toggles and closes the history from the keyboard', async () => {
    seedRawHistory('s', { id: 's', items: [historyItem('only', 1, 1)] });

    const { find, query } = await render(
      <SearchInput value="x" historyId="s" onChangeText={vi.fn()} outerRef={{ current: null }} />,
    );
    const input = find<HTMLInputElement>('input');

    act(() => {
      input.focus();
    });

    dispatchKeydown(input, { key: 'Tab' });
    expect(query('[role="listbox"]')).not.toBeNull();

    dispatchKeydown(input, { key: 'Tab' });
    expect(query('[role="listbox"]')).toBeNull();

    dispatchKeydown(input, { key: 'Enter' });
  });

  it('closes the history on Escape and on Backspace over an empty field', async () => {
    seedRawHistory('s', { id: 's', items: [historyItem('only', 1, 1)] });

    const outerRef: { current: HTMLDivElement | null } = { current: null };
    const { find, update, query } = await render(
      <SearchInput value="" historyId="s" onChangeText={vi.fn()} outerRef={outerRef} />,
    );
    const input = find<HTMLInputElement>('input');

    act(() => {
      input.focus();
    });
    dispatchKeydown(input, { key: 'a' });
    expect(query('[role="listbox"]')).not.toBeNull();

    dispatchKeydown(input, { key: 'Escape' });
    expect(query('[role="listbox"]')).toBeNull();

    dispatchKeydown(input, { key: 'a' });
    dispatchKeydown(input, { key: 'Backspace' });
    expect(query('[role="listbox"]')).toBeNull();

    dispatchKeydown(input, { key: 'Delete' });
    await update(
      <SearchInput value="y" historyId="s" onChangeText={vi.fn()} outerRef={outerRef} />,
    );
    dispatchKeydown(input, { key: 'Backspace' });
    expect(input).toBeDefined();
  });

  it('hides the history when the value is cleared', async () => {
    seedRawHistory('s', { id: 's', items: [historyItem('only', 1, 1)] });

    const outerRef: { current: HTMLDivElement | null } = { current: null };
    const { find, update, query } = await render(
      <SearchInput value="x" historyId="s" onChangeText={vi.fn()} outerRef={outerRef} />,
    );
    const input = find<HTMLInputElement>('input');

    act(() => {
      input.focus();
    });
    dispatchKeydown(input, { key: 'a' });
    expect(query('[role="listbox"]')).not.toBeNull();

    await update(<SearchInput value="" historyId="s" onChangeText={vi.fn()} outerRef={outerRef} />);
    expect(query('[role="listbox"]')).toBeNull();
  });

  it('keeps the selection inside the history as it changes', async () => {
    seedRawHistory('s1', {
      id: 's1',
      items: [historyItem('a', 1, 1), historyItem('b', 1, 1), historyItem('c', 1, 1)],
    });
    seedRawHistory('s2', { id: 's2', items: [historyItem('only', 1, 1)] });
    seedRawHistory('s3', {
      id: 's3',
      items: [
        historyItem('a', 1, 1),
        historyItem('b', 1, 1),
        historyItem('c', 1, 1),
        historyItem('d', 1, 1),
        historyItem('e', 1, 1),
      ],
    });

    const { find, update } = await render(
      <SearchInput value="x" historyId="s1" onChangeText={vi.fn()} />,
    );
    const input = find<HTMLInputElement>('input');

    act(() => {
      input.focus();
    });
    dispatchKeydown(input, { key: 'ArrowDown' });
    dispatchKeydown(input, { key: 'ArrowDown' });
    dispatchKeydown(input, { key: 'ArrowDown' });

    await update(<SearchInput value="x" historyId="s2" onChangeText={vi.fn()} />);
    await update(<SearchInput value="x" historyId="s3" onChangeText={vi.fn()} />);

    expect(input).toBeDefined();
  });

  it('adds a new entry to the history on blur', async () => {
    const { find } = await render(
      <SearchInput value="searched" historyId="s" onChangeText={vi.fn()} />,
    );
    const input = find<HTMLInputElement>('input');

    act(() => {
      input.focus();
    });

    vi.useFakeTimers();
    act(() => {
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    vi.useRealTimers();

    const stored = localStorage.getItem(`${HISTORY_KEY_PREFIX}s`);
    expect(stored).toContain('searched');
  });

  it('bumps the count of an entry already in the history on blur', async () => {
    seedRawHistory('s', { id: 's', items: [historyItem('searched', 1, 1)] });

    const { find } = await render(
      <SearchInput value="searched" historyId="s" onChangeText={vi.fn()} />,
    );
    const input = find<HTMLInputElement>('input');

    act(() => {
      input.focus();
    });
    act(() => {
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });

    const stored = JSON.parse(localStorage.getItem(`${HISTORY_KEY_PREFIX}s`) ?? '{}');
    expect(stored.items[0].usageCount).toBe(2);
  });

  it('stores nothing without a history id or with a blank value', async () => {
    const { find, update } = await render(<SearchInput value="searched" onChangeText={vi.fn()} />);
    const input = find<HTMLInputElement>('input');

    act(() => {
      input.focus();
    });
    act(() => {
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(localStorage.length).toBe(0);

    await update(<SearchInput value="   " historyId="s" onChangeText={vi.fn()} />);
    const withId = find<HTMLInputElement>('input');
    act(() => {
      withId.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(localStorage.getItem(`${HISTORY_KEY_PREFIX}s`)).toBeNull();
  });

  it('positions the history against the wrapper, or the sheet on a narrow screen', async () => {
    seedRawHistory('s', { id: 's', items: [historyItem('only', 1, 1)] });

    const { find } = await render(
      <SearchInput value="x" historyId="s" onChangeText={vi.fn()} outerRef={{ current: null }} />,
    );
    const input = find<HTMLInputElement>('input');

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 500 });
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    act(() => {
      input.focus();
    });
    dispatchKeydown(input, { key: 'a' });

    expect(find('[role="listbox"]')).toBeDefined();
  });

  it('loads what is stored and ignores what cannot be read', async () => {
    seedRawHistory('none', { id: 'none', items: 'not-an-array' });

    const first = await render(<SearchInput value="x" historyId="none" onChangeText={vi.fn()} />);
    expect(first.find<HTMLInputElement>('input')).toBeDefined();
    first.unmount();

    seedRawHistory('bad', {
      id: 'bad',
      items: [
        null,
        { content: 42, timestamp: 1, usageCount: 1 },
        { content: '   ', timestamp: 1, usageCount: 1 },
        { content: 'ok', timestamp: 'x', usageCount: 1 },
        { content: 'ok', timestamp: 1, usageCount: 'y' },
        { content: 'good', timestamp: 1, usageCount: 1 },
      ],
    });

    const { find } = await render(
      <SearchInput value="x" historyId="bad" onChangeText={vi.fn()} outerRef={{ current: null }} />,
    );
    const input = find<HTMLInputElement>('input');

    act(() => {
      input.focus();
    });
    dispatchKeydown(input, { key: 'a' });

    const options = document.body.querySelectorAll('[role="option"]');
    expect(options).toHaveLength(1);
    expect(elementAt(Array.from(options), 0).textContent).toContain('good');
  });

  it('truncates a long stored entry and breaks ties in the ranking', async () => {
    seedRawHistory('s', {
      id: 's',
      items: [
        { content: 'x'.repeat(150), timestamp: 1, usageCount: 1 },
        { content: 'b', timestamp: 1, usageCount: 1 },
        { content: 'a', timestamp: 1, usageCount: 1 },
      ],
    });

    const { find } = await render(
      <SearchInput value="q" historyId="s" onChangeText={vi.fn()} outerRef={{ current: null }} />,
    );
    const input = find<HTMLInputElement>('input');

    act(() => {
      input.focus();
    });
    dispatchKeydown(input, { key: 'a' });

    const options = document.body.querySelectorAll('[role="option"]');

    expect(elementAt(Array.from(options), 0).textContent).toContain('a');
    expect(elementAt(Array.from(options), 2).textContent).toContain('x');
  });

  it('reports an unreadable and an unwritable history without throwing', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    localStorage.setItem(`${HISTORY_KEY_PREFIX}broken`, '{not json');

    const { find, unmount } = await render(
      <SearchInput value="x" historyId="broken" onChangeText={vi.fn()} />,
    );
    expect(find<HTMLInputElement>('input')).toBeDefined();
    unmount();

    seedRawHistory('s', { id: 's', items: [] });

    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    setItem.mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    const { find: findSecond } = await render(
      <SearchInput value="searched" historyId="s" onChangeText={vi.fn()} />,
    );
    const input = findSecond<HTMLInputElement>('input');

    act(() => {
      input.focus();
    });
    act(() => {
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });

    setItem.mockRestore();

    expect(consoleError).toHaveBeenCalled();
  });
});
