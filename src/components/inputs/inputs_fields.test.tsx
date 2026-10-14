// SPDX-License-Identifier: MIT
// The field-shaped inputs and the values they repair and report.
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { ByteFractionInput } from '@/components/inputs/ByteFractionInput';
import { Checkbox } from '@/components/inputs/Checkbox';
import { DelayedInput } from '@/components/inputs/DelayedInput';
import { LockableToggleSwitch } from '@/components/inputs/LockableToggleSwitch';
import { SocketServerAddressInput } from '@/components/inputs/SocketServerAddressInput';
import { TextInput } from '@/components/inputs/TextInput';
import { TimePartInput } from '@/components/inputs/TimePartInput';
import { ToggleSwitch } from '@/components/inputs/ToggleSwitch';
import { useVirtualizedList, VirtualizedList } from '@/components/inputs/VirtualizedList';
import { act, click, flush, render, type } from '@/util/testing/render';

/**
 * The field-level controls of the input group: the props a caller reaches through — the styling
 * contract of the text field, the label variants of a checkbox, the commit timing of the delayed
 * field and the lock behaviour of the switches — and the list whose rows appear only once the
 * container has been measured.
 */

/** A scrolling container a test can drive `scrollTop` on. */
interface ScrollableRef {
  current: HTMLDivElement | null;
}

/** Reads an element of an indexed query, failing when the index has no element. */
function elementAt<T extends Element>(elements: readonly T[], index: number): T {
  const element = elements[index];

  if (element === undefined) {
    throw new Error(`no element at index ${index}`);
  }

  return element;
}

/** Dispatches a keydown at `target` inside `act`, so the handler runs and its update settles. */
function pressKey(target: Element, key: string): void {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

/** Dispatches a scroll at `element` with the scroll position it should report. */
async function scrollTo(element: HTMLElement, scrollTop: number): Promise<void> {
  element.scrollTop = scrollTop;

  act(() => {
    element.dispatchEvent(new Event('scroll', { bubbles: true }));
  });

  await flush();
}

/** Renders {@link VirtualizedList} with the stubbed viewport's geometry. */
function virtualizedList(
  listRef: ScrollableRef,
  props: {
    readonly itemCount: number;
    readonly itemSize: number;
    readonly onScroll?: (event: unknown) => void;
    readonly overScanCount?: number;
  },
) {
  return (
    <VirtualizedList
      className="list-scroll"
      containerRef={listRef}
      height="200px"
      itemCount={props.itemCount}
      itemSize={props.itemSize}
      {...(props.onScroll === undefined ? {} : { onScroll: props.onScroll })}
      {...(props.overScanCount === undefined ? {} : { overScanCount: props.overScanCount })}
      rowRenderer={(row) => (
        <div className="row" key={row.index} style={row.style}>
          {row.index}
        </div>
      )}
      width="300px"
    />
  );
}

/** What the hook fixture takes: the list geometry and the ref the hook is handed. */
interface HookFixtureProps {
  readonly hookRef?: ScrollableRef | undefined;
  readonly itemCount: number;
  readonly itemSize: number;
  readonly overScanCount?: number | undefined;
}

/** A component that reports what {@link useVirtualizedList} sees. */
function VirtualizedListHookFixture({
  hookRef,
  itemCount,
  itemSize,
  overScanCount,
}: HookFixtureProps) {
  const { startIndex, endIndex, containerRef, getItemStyle } = useVirtualizedList({
    itemCount,
    itemSize,
    overScanCount,
    ref: hookRef,
  });

  const rows = Array.from({ length: endIndex - startIndex + 1 }, (_, offset) => {
    const index = startIndex + offset;

    return (
      <div className="row" key={index} style={getItemStyle(index)}>
        {index}
      </div>
    );
  });

  return (
    <div className="hook-fixture">
      <div ref={hookRef ?? null} className="hook-scrolling">
        <div className="rows">{rows}</div>
      </div>
      <div className="range">{`${startIndex}:${endIndex}`}</div>
      <div className="container-ref">{containerRef === hookRef ? 'external' : 'own'}</div>
    </div>
  );
}

/** Attached scrolling element of a rendered list or hook fixture. */
function attachedContainer(ref: ScrollableRef): HTMLElement {
  if (ref.current === null) {
    throw new Error('the fixture never attached its container');
  }

  return ref.current;
}

describe('TextInput', () => {
  it('renders the full contract of the props a caller sets', async () => {
    const inputRef: { current: HTMLInputElement | null } = { current: null };
    const { container, find } = await render(
      <TextInput
        id="address-field"
        type="search"
        spellCheck={false}
        pattern="[a-z]+"
        placeholder="type here"
        value="ready"
        min={0}
        max={10}
        step={2}
        width="240px"
        minWidth="180px"
        textColor="var(--color-tpd)"
        placeholderColor="var(--color-bok)"
        outline="1px solid var(--color-bin)"
        inputPadding="0.75rem"
        inputStyle={{ height: '2.5rem' }}
        inputRef={inputRef}
        inputAutoFocus={true}
        hiddenText={false}
      />,
    );

    const input = find<HTMLInputElement>('input');

    expect(input.id).toBe('address-field');
    expect(input.type).toBe('search');
    expect(input.getAttribute('spellcheck')).toBeNull();
    expect(input.pattern).toBe('[a-z]+');
    expect(input.placeholder).toBe('type here');
    expect(input.value).toBe('ready');
    expect(input.min).toBe('0');
    expect(input.max).toBe('10');
    expect(input.step).toBe('2');
    expect(input.autofocus).toBe(true);
    expect(input.style.color).toBe('var(--color-tpd)');
    expect(input.style.padding).toBe('0.75rem');
    expect(input.style.border).toContain('1px solid var(--color-bin)');
    expect(input.style.height).toBe('2.5rem');
    expect(input.style.getPropertyValue('--placeholder-color')).toBe('var(--color-bok)');
    expect(inputRef.current).toBe(input);

    const wrapper = container.querySelector<HTMLElement>('div');

    expect(wrapper?.style.width).toBe('240px');
    expect(wrapper?.style.minWidth).toBe('180px');

    await click(find<HTMLButtonElement>('button'));

    expect(input.value).toBe('ready');
  });

  it('reports keydowns to the caller and confirms only on Enter', async () => {
    const onConfirm = vi.fn();
    const onKeyDown = vi.fn();
    const { find } = await render(
      <TextInput value="x" onConfirm={onConfirm} onKeyDown={onKeyDown} />,
    );

    const input = find<HTMLInputElement>('input');

    pressKey(input, 'Escape');

    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    pressKey(input, 'Enter');

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onKeyDown).toHaveBeenCalledTimes(2);
  });

  it('ignores a keydown when the caller holds no handlers', async () => {
    const { find } = await render(<TextInput value="x" />);

    const input = find<HTMLInputElement>('input');

    pressKey(input, 'a');
    pressKey(input, 'Enter');

    expect(input.value).toBe('x');
  });

  it('reports the text alone when the caller wants only the text', async () => {
    const onChangeText = vi.fn();
    const { find } = await render(<TextInput value="" onChangeText={onChangeText} />);

    await type(find<HTMLInputElement>('input'), 'a');

    expect(onChangeText).toHaveBeenCalledWith('a');
  });

  it('reports the event alone when the caller wants only the event', async () => {
    const onChange = vi.fn();
    const { find } = await render(<TextInput value="" onChange={onChange} />);

    await type(find<HTMLInputElement>('input'), 'b');

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('clears through the button and calls the handlers it was given', async () => {
    const onClearClick = vi.fn();
    const onChangeText = vi.fn();
    const { find, findAll, update } = await render(
      <TextInput value="typed" onClearClick={onClearClick} />,
    );

    await click(find<HTMLButtonElement>('button'));

    expect(onClearClick).toHaveBeenCalledTimes(1);

    await update(<TextInput value="typed" onChangeText={onChangeText} />);

    await click(elementAt(findAll<HTMLButtonElement>('button'), 0));

    expect(onChangeText).toHaveBeenCalledWith('');
  });

  it('renders the password toggle per the hidden-text decision and reports it', async () => {
    const onShowPasswordClick = vi.fn();
    const { find, findAll, update } = await render(
      <TextInput
        value="secret"
        hiddenText={true}
        hasShowPasswordButton={true}
        onShowPasswordClick={onShowPasswordClick}
      />,
    );

    expect(find<HTMLInputElement>('input').type).toBe('password');
    expect(findAll<HTMLButtonElement>('button')).toHaveLength(2);
    expect(elementAt(findAll<HTMLButtonElement>('button'), 0).title).toBe('Show password');

    await click(elementAt(findAll<HTMLButtonElement>('button'), 0));

    expect(onShowPasswordClick).toHaveBeenCalledTimes(1);

    await update(
      <TextInput
        value="secret"
        hasShowPasswordButton={true}
        onShowPasswordClick={onShowPasswordClick}
      />,
    );

    expect(find<HTMLInputElement>('input').type).toBe('text');
    expect(elementAt(findAll<HTMLButtonElement>('button'), 0).title).toBe('Hide password');
  });

  it('renders nothing when told not to', async () => {
    const { container } = await render(<TextInput shouldRender={false} value="hidden" />);

    expect(container.textContent).toBe('');
  });
});

describe('ByteFractionInput', () => {
  it('renders the value it is given and reports the digits of what is typed', async () => {
    const onChange = vi.fn();
    const { find } = await render(<ByteFractionInput value={12.5} onChange={onChange} />);

    expect(find<HTMLInputElement>('input').value).toBe('12.5');

    await type(find<HTMLInputElement>('input'), '-5');

    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('reports zero when text with no number is typed', async () => {
    const onChange = vi.fn();
    const { find } = await render(<ByteFractionInput value={12} onChange={onChange} />);

    await type(find<HTMLInputElement>('input'), 'abc');

    expect(onChange).toHaveBeenCalledWith(0);
  });
});

describe('Checkbox', () => {
  it('reports the clicked state with the mark shown while checked', async () => {
    const onChange = vi.fn();
    const { container, find } = await render(
      <Checkbox checked={true} label="Archive" onChange={onChange} />,
    );

    expect(container.querySelector('svg')).not.toBeNull();

    const input = find<HTMLInputElement>('input');

    expect(input.checked).toBe(true);
    expect(find('label').getAttribute('for')).toBe(input.id);

    await click(input);

    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('renders no label element for the label values that are nothing', async () => {
    const { query, update } = await render(<Checkbox checked={false} onChange={() => undefined} />);

    expect(query('span')).toBeNull();

    await update(<Checkbox checked={false} label={null} onChange={() => undefined} />);

    expect(query('span')).toBeNull();

    await update(<Checkbox checked={false} label={false} onChange={() => undefined} />);

    expect(query('span')).toBeNull();

    await update(<Checkbox checked={false} label={''} onChange={() => undefined} />);

    expect(query('span')).toBeNull();
  });

  it('renders the label it is given with the styles the caller sets', async () => {
    const { container, find } = await render(
      <Checkbox
        checked={false}
        label="Archive"
        labelStyle={{ fontWeight: 700 }}
        className="text-tpd"
        style={{ marginTop: '4px' }}
        onChange={() => undefined}
      />,
    );

    expect(find('span').textContent).toBe('Archive');
    expect(find('span').style.fontWeight).toBe('700');

    const wrapper = container.querySelector<HTMLElement>('div');

    expect(wrapper?.className).toContain('text-tpd');
    expect(wrapper?.style.marginTop).toBe('4px');
  });
});

describe('DelayedInput', () => {
  it('reports the settled value and the caller blur handler on blur', async () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    const { find } = await render(
      <DelayedInput value="initial" onChange={onChange} onBlur={onBlur} />,
    );

    const input = find<HTMLInputElement>('input');

    input.focus();
    await type(input, 'settled');

    expect(input.value).toBe('settled');
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith('settled');
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('keeps the value for keys that report nothing, Enter included', async () => {
    const onChange = vi.fn();
    const { find } = await render(
      <DelayedInput value="" onChange={onChange} changeOnEnterKey={false} />,
    );

    const input = find<HTMLInputElement>('input');

    input.focus();
    await type(input, 'draft');

    pressKey(input, 'a');
    pressKey(input, 'Enter');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('applies the caller filter while typing, before the value settles', async () => {
    const { find } = await render(
      <DelayedInput
        value=""
        onChange={() => undefined}
        getFilteredValue={(text) => text.toUpperCase()}
      />,
    );

    await type(find<HTMLInputElement>('input'), 'abc');

    expect(find<HTMLInputElement>('input').value).toBe('ABC');
  });

  it('commits on Enter by blurring the field when the caller asked for it', async () => {
    const onChange = vi.fn();
    const { find } = await render(
      <DelayedInput value="" onChange={onChange} changeOnEnterKey={true} />,
    );

    const input = find<HTMLInputElement>('input');

    input.focus();
    await type(input, 'committed');

    pressKey(input, 'Enter');

    expect(onChange).toHaveBeenCalledWith('committed');
    expect(document.activeElement).not.toBe(input);
  });

  it('renders per the presentation props the caller sets', async () => {
    const { find, update } = await render(
      <DelayedInput value="x" onChange={() => undefined} spellCheck={true} autoFocus={true} />,
    );

    expect(find<HTMLInputElement>('input').getAttribute('spellcheck')).toBe('true');
    expect(find<HTMLInputElement>('input').autofocus).toBe(true);

    await update(<DelayedInput value="x" onChange={() => undefined} spellCheck={false} />);

    expect(find<HTMLInputElement>('input').getAttribute('spellcheck')).toBeNull();
    expect(find<HTMLInputElement>('input').autofocus).toBe(false);
  });
});

describe('SocketServerAddressInput', () => {
  it('reports the typed text, the placeholder and the clear through the caller', async () => {
    const onChange = vi.fn();
    const { find } = await render(
      <SocketServerAddressInput
        value=""
        onChange={onChange}
        onConfirm={() => undefined}
        placeholder="wss://host"
      />,
    );

    const input = find<HTMLInputElement>('input');

    expect(input.placeholder).toBe('wss://host');

    await type(input, 'wss://example');

    expect(onChange).toHaveBeenCalledWith('wss://example');
  });

  it('reports an emptied address through its clear button', async () => {
    const onChange = vi.fn();
    const { find } = await render(
      <SocketServerAddressInput value="wss://x" onChange={onChange} onConfirm={() => undefined} />,
    );

    await click(find<HTMLButtonElement>('button'));

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('asks to confirm on Enter and not when the key is anything else', async () => {
    const onConfirm = vi.fn();
    const { find } = await render(
      <SocketServerAddressInput value="" onChange={() => undefined} onConfirm={onConfirm} />,
    );

    const input = find<HTMLInputElement>('input');

    pressKey(input, 'Escape');

    expect(onConfirm).not.toHaveBeenCalled();

    pressKey(input, 'Enter');

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('ToggleSwitch', () => {
  it('renders the label on the left, grown, and reports the click', async () => {
    const onChange = vi.fn();
    const { find } = await render(
      <ToggleSwitch
        enabled={true}
        label="Enabled feature"
        rightSide={false}
        shouldLabelGrow={true}
        enabledBgClassName="bg-tok"
        labelStyle={{ fontWeight: 700 }}
        barStyle={{ borderRadius: '2px' }}
        className="text-tpd"
        onChange={onChange}
      />,
    );

    const button = find<HTMLButtonElement>('button');

    expect(button.className).toContain('text-tpd');
    expect(find('.flex-grow').textContent).toBe('Enabled feature');
    expect(find('.flex-grow').className).toContain('text-ellipsis');

    await click(button);

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('reports a locked click to the lock handler and nothing else', async () => {
    const onChange = vi.fn();
    const onLockedClick = vi.fn();
    const { container, find } = await render(
      <ToggleSwitch
        enabled={true}
        locked={true}
        title="Locked for maintenance"
        onLockedClick={onLockedClick}
        onChange={onChange}
      />,
    );

    const button = find<HTMLButtonElement>('button');

    expect(button.title).toBe('Locked for maintenance');
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(container.querySelector('.text-ellipsis')).toBeNull();

    await click(button);

    expect(onLockedClick).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('LockableToggleSwitch', () => {
  it('shows the lock reason when the locked switch is clicked', async () => {
    const onChange = vi.fn();
    const { find } = await render(
      <LockableToggleSwitch
        label="Verbose logging"
        enabled={false}
        locked={true}
        lockReasonTitle="Turn it on first"
        className="mt-2"
        onChange={onChange}
      />,
    );

    expect(document.body.querySelector('.scale-y-1')).toBeNull();

    await click(find<HTMLButtonElement>('button'));
    await flush();

    expect(document.body.querySelector('.scale-y-1')).not.toBeNull();
    expect(document.body.textContent).toContain('Turn it on first');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps the tooltip hidden for a lock with no reason', async () => {
    const { find } = await render(
      <LockableToggleSwitch
        label="Verbose logging"
        enabled={false}
        locked={true}
        onChange={() => undefined}
      />,
    );

    await click(find<HTMLButtonElement>('button'));
    await flush();

    expect(document.body.querySelector('.scale-y-1')).toBeNull();
  });

  it('keeps the tooltip hidden for an empty lock reason', async () => {
    const { find } = await render(
      <LockableToggleSwitch
        label="Verbose logging"
        enabled={false}
        locked={true}
        lockReasonTitle={''}
        onChange={() => undefined}
      />,
    );

    await click(find<HTMLButtonElement>('button'));
    await flush();

    expect(document.body.querySelector('.scale-y-1')).toBeNull();
  });

  it('renders unlocked by default and forwards the change', async () => {
    const onChange = vi.fn();
    const { container, find } = await render(
      <LockableToggleSwitch
        label="Auto refresh"
        enabled={true}
        shouldLabelGrow={true}
        rightSide={false}
        className="mt-2"
        style={{ width: '220px' }}
        onChange={onChange}
      />,
    );

    const wrapper = container.querySelector<HTMLElement>('div');

    expect(wrapper?.className).toContain('mt-2');
    expect(wrapper?.style.width).toBe('220px');
    expect(find<HTMLButtonElement>('button').getAttribute('aria-checked')).toBe('true');

    await click(find<HTMLButtonElement>('button'));
    await flush();

    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('TimePartInput', () => {
  it('renders the value and reports a typed value clamped into the range', async () => {
    const onChange = vi.fn();
    const { find } = await render(<TimePartInput value={2} onChange={onChange} max={12} />);

    expect(find<HTMLInputElement>('input').value).toBe('2');

    await type(find<HTMLInputElement>('input'), '30');

    expect(onChange).toHaveBeenCalledWith(12);
  });

  it('steps the value from its arrows', async () => {
    const onChange = vi.fn();
    const { findAll } = await render(<TimePartInput value={11} onChange={onChange} max={12} />);

    // Three buttons: the up arrow, the field's own clear button, and the down arrow.
    const buttons = findAll<HTMLButtonElement>('button');

    expect(buttons).toHaveLength(3);

    await click(elementAt<HTMLButtonElement>(buttons, 0));

    expect(onChange).toHaveBeenLastCalledWith(12);

    await click(elementAt<HTMLButtonElement>(buttons, 2));

    expect(onChange).toHaveBeenLastCalledWith(10);
  });
});

describe('VirtualizedList', () => {
  it('renders the rows the viewport needs and follows scrolling', async () => {
    const onScroll = vi.fn();
    const listRef: ScrollableRef = { current: null };
    const { container, findAll } = await render(
      virtualizedList(listRef, { itemCount: 100, itemSize: 10, onScroll }),
    );

    const wrapper = container.querySelector<HTMLElement>('.list-scroll');

    expect(wrapper?.style.width).toBe('300px');
    expect(wrapper?.style.height).toBe('200px');
    expect(wrapper?.style.overflow).toBe('auto');

    // The stubbed viewport is 768 high, so 77 rows of 10 fit the first measurement.
    expect(findAll('.row')).toHaveLength(77);
    expect(elementAt(findAll('.row'), 0).textContent).toBe('0');
    expect(elementAt(findAll('.row'), 76).textContent).toBe('76');

    const spacer = container.querySelector<HTMLElement>('.list-scroll > div');

    expect(spacer?.style.height).toBe('1000px');

    const element = attachedContainer(listRef);

    await scrollTo(element, 50);

    expect(onScroll).toHaveBeenCalledTimes(1);
    expect(elementAt(findAll('.row'), 0).textContent).toBe('4');
    expect(elementAt(findAll('.row'), 77).textContent).toBe('81');
    expect(findAll('.row')).toHaveLength(78);
  });

  it('grows the rendered range with the over-scan rows', async () => {
    const listRef: ScrollableRef = { current: null };
    const { findAll, update } = await render(
      virtualizedList(listRef, { itemCount: 100, itemSize: 10 }),
    );

    expect(findAll('.row')).toHaveLength(77);

    await update(virtualizedList(listRef, { itemCount: 100, itemSize: 10, overScanCount: 1 }));

    expect(findAll('.row')).toHaveLength(78);
    expect(elementAt(findAll('.row'), 0).textContent).toBe('0');
    expect(elementAt(findAll('.row'), 77).textContent).toBe('77');
  });
});

describe('useVirtualizedList', () => {
  it('stays at the start while no element carries the hook ref', async () => {
    const { find, findAll } = await render(
      <VirtualizedListHookFixture itemCount={5} itemSize={10} />,
    );

    expect(find('.range').textContent).toBe('0:0');
    expect(find('.container-ref').textContent).toBe('own');
    expect(findAll('.row')).toHaveLength(1);
  });

  it('recalculates when the caller attaches the container, and follows scrolling', async () => {
    const hookRef: ScrollableRef = { current: null };
    const { find, findAll, update } = await render(
      <VirtualizedListHookFixture hookRef={hookRef} itemCount={20} itemSize={10} />,
    );

    // The ref is not attached yet on the first pass, so the hook has nothing to measure.
    expect(find('.range').textContent).toBe('0:0');
    expect(find('.container-ref').textContent).toBe('external');

    await update(<VirtualizedListHookFixture hookRef={hookRef} itemCount={20} itemSize={10} />);

    expect(find('.range').textContent).toBe('0:19');
    expect(findAll('.row')).toHaveLength(20);

    const element = attachedContainer(hookRef);

    await scrollTo(element, 50);

    expect(find('.range').textContent).toBe('4:19');
    expect(findAll('.row')).toHaveLength(16);

    await scrollTo(element, 120);

    expect(find('.range').textContent).toBe('12:19');
    expect(findAll('.row')).toHaveLength(8);
  });

  it('stops recalculating when the over-scan covers the whole list', async () => {
    const hookRef: ScrollableRef = { current: null };
    const { find, update } = await render(
      <VirtualizedListHookFixture
        hookRef={hookRef}
        itemCount={2}
        itemSize={10}
        overScanCount={2}
      />,
    );

    expect(find('.range').textContent).toBe('0:0');

    await update(
      <VirtualizedListHookFixture
        hookRef={hookRef}
        itemCount={2}
        itemSize={10}
        overScanCount={2}
      />,
    );

    expect(find('.range').textContent).toBe('0:1');

    const element = attachedContainer(hookRef);

    await scrollTo(element, 40);

    expect(find('.range').textContent).toBe('0:1');
  });
});
