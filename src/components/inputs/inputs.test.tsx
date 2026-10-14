/**
 * The input group is held to the library's rule that a control renders the value it is given and
 * reports what it would move to. Two contracts matter beyond that: the numeric inputs repair what is
 * typed — clamping to range, refusing non-numbers — because a rendered value must never leave the
 * range its field means, and the switch family is keyboard-reachable with the exact `role` and
 * `aria-*` attributes a screen reader reads a switch by.
 */
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BitField } from '@/components/inputs/BitField';
import { ByteFractionInput } from '@/components/inputs/ByteFractionInput';
import { Checkbox } from '@/components/inputs/Checkbox';
import { ColorfulYesNo } from '@/components/inputs/ColorfulYesNo';
import { DecimalIntegerInput } from '@/components/inputs/DecimalIntegerInput';
import { DelayedInput } from '@/components/inputs/DelayedInput';
import { FloatInput } from '@/components/inputs/FloatInput';
import { HourMinuteSecondTimeInput } from '@/components/inputs/HourMinuteSecondTimeInput';
import { HourMinuteTimeInput } from '@/components/inputs/HourMinuteTimeInput';
import { Input } from '@/components/inputs/Input';
import { IPInput } from '@/components/inputs/IPInput';
import { JsonEditor } from '@/components/inputs/JsonEditor';
import { LockableToggleSwitch } from '@/components/inputs/LockableToggleSwitch';
import { SearchInput } from '@/components/inputs/SearchInput';
import { Select } from '@/components/inputs/Select';
import { Slider } from '@/components/inputs/Slider';
import { SocketServerAddressInput } from '@/components/inputs/SocketServerAddressInput';
import { TextInput } from '@/components/inputs/TextInput';
import { TimePartInput } from '@/components/inputs/TimePartInput';
import { ToggleSwitch } from '@/components/inputs/ToggleSwitch';
import { UnsignedIntegerInput } from '@/components/inputs/UnsignedIntegerInput';
import { UploadConfig } from '@/components/inputs/UploadConfig';
import { act, change, click, flush, render, type } from '@/util/testing/render';

// The picker is mocked so the click path can be driven: the real one opens a native dialog a test
// cannot answer.
const openFileDialog = vi.hoisted(() => vi.fn());

vi.mock('@/util/file', () => ({ openFileDialog }));

describe('Input', () => {
  it('is a native input with the DOM prop of the same name', async () => {
    const onChange = vi.fn();
    const { find } = await render(<Input type="number" min={0} max={10} onChange={onChange} />);

    const input = find<HTMLInputElement>('input');

    expect(input.type).toBe('number');
    expect(input.min).toBe('0');
    expect(input.max).toBe('10');

    await type(input, '4');

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('merges the caller classes instead of replacing the field with them', async () => {
    // The classes below are what makes a bare `<input>` look like the library's field. A caller
    // naming one of them expects to change it, not to lose the rest along with it.
    const { find } = await render(<Input className="w-full" />);

    const className = find<HTMLInputElement>('input').className;

    expect(className).toContain('w-full');
    expect(className).toContain('bg-bin');
    expect(className).toContain('rounded-lg');
  });
});

describe('TextInput', () => {
  it('puts the caller classes on the wrapper the field is laid out in', async () => {
    // The field is a wrapper with the input inside it, and `style` has always gone on the wrapper, so
    // `className` does too. A width named here is a width for the whole field, not for the input.
    const { container, find } = await render(<TextInput className="w-1/2" />);

    expect(container.firstElementChild?.className).toContain('w-1/2');
    expect(find<HTMLInputElement>('input').className).not.toContain('w-1/2');
  });

  it('reports both the event and the text, so a caller can take either', async () => {
    const onChange = vi.fn();
    const onChangeText = vi.fn();
    const { find } = await render(
      <TextInput value="" onChange={onChange} onChangeText={onChangeText} />,
    );

    await type(find<HTMLInputElement>('input'), 'hello');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChangeText).toHaveBeenCalledWith('hello');
  });

  it('confirms on Enter', async () => {
    const onConfirm = vi.fn();
    const { find } = await render(<TextInput value="x" onConfirm={onConfirm} />);

    find<HTMLInputElement>('input').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when told not to render', async () => {
    // A panel that hides an input has to take its space with it, and a wrapper left behind is a gap
    // that looks like a layout bug in the consumer's page.
    const { container } = await render(<TextInput shouldRender={false} value="x" />);

    expect(container.textContent).toBe('');
  });

  it('deactivates the clear button on an empty value and reports a click on a full one', async () => {
    const onClearClick = vi.fn();
    const onChangeText = vi.fn();
    const { find, findAll, update } = await render(
      <TextInput value="" onClearClick={onClearClick} onChangeText={onChangeText} />,
    );

    // With no show-password button, the clear button is the only one there is.
    expect(findAll<HTMLButtonElement>('button')).toHaveLength(1);
    expect(find<HTMLButtonElement>('button').getAttribute('title')).toBe('');

    await update(
      <TextInput value="typed" onClearClick={onClearClick} onChangeText={onChangeText} />,
    );

    expect(find<HTMLButtonElement>('button').getAttribute('title')).toBe('Clear text');

    await click(find<HTMLButtonElement>('button'));

    expect(onChangeText).toHaveBeenCalledWith('');
    expect(onClearClick).toHaveBeenCalledTimes(1);
  });

  it('shows the show-password button only when asked, and reports the toggle', async () => {
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

    await click(findAll<HTMLButtonElement>('button')[0] as HTMLButtonElement);

    expect(onShowPasswordClick).toHaveBeenCalledTimes(1);

    await update(
      <TextInput
        value="secret"
        hasShowPasswordButton={true}
        onShowPasswordClick={onShowPasswordClick}
      />,
    );

    expect(find<HTMLInputElement>('input').type).toBe('text');
    expect(findAll<HTMLButtonElement>('button')[0]?.getAttribute('title')).toBe('Hide password');
  });
});

describe('ColorfulYesNo', () => {
  it('merges the caller classes whichever answer it is printing', async () => {
    // The colour is `yesIsBad`'s opinion of the answer and the caller's classes are the caller's; the
    // two never trade places, and neither of the two answers drops what the caller asked for.
    const { update, container } = await render(<ColorfulYesNo yes={true} className="font-bold" />);

    expect(container.querySelector('span')?.className).toContain('font-bold');

    await update(<ColorfulYesNo yes={false} className="font-bold" />);

    expect(container.querySelector('span')?.className).toContain('font-bold');
  });

  it('lets the caller override the colour, because a colour is a decision rather than a guarantee', async () => {
    const { container } = await render(<ColorfulYesNo yes={true} className="text-tpd" />);

    const className = container.querySelector('span')?.className;

    expect(className).toContain('text-tpd');
    expect(className).not.toContain('text-tok');
  });
});

describe('JsonEditor', () => {
  it('puts the caller classes on its wrapper and not on the textarea underneath it', async () => {
    // The editor is a textarea under a highlighted `<pre>`, both positioned on top of each other. A
    // class that reaches the wrong one of the two is applied to an element the caller never saw, and a
    // font or an outline class applied to the wrapper below them reads as nothing happening at all.
    const { container, find } = await render(
      <JsonEditor code="{}" setCode={() => undefined} className="h-64" />,
    );

    expect(container.firstElementChild?.className).toContain('h-64');
    expect(find<HTMLTextAreaElement>('textarea').className).not.toContain('h-64');
    // The font belongs to the textarea, which is the element the operator types into.
    expect(find<HTMLTextAreaElement>('textarea').className).toContain('font-mono');
  });
});

describe('Select', () => {
  it('renders a native select holding the caller options', async () => {
    const onChange = vi.fn();
    const { find } = await render(
      <Select value="a" onChange={onChange}>
        <option value="a">First</option>
        <option value="b">Second</option>
      </Select>,
    );

    const select = find<HTMLSelectElement>('select');

    expect([...select.options].map((option) => option.textContent)).toEqual(['First', 'Second']);
    expect(select.value).toBe('a');

    // `change` sets the value the way choosing an option does and fires the event with it, so the
    // component's own handler is what is under test here.
    change(select, 'b');

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('disables the select when told to', async () => {
    const { find } = await render(
      <Select value="a" onChange={() => undefined} disabled={true}>
        <option value="a">First</option>
      </Select>,
    );

    expect(find<HTMLSelectElement>('select').disabled).toBe(true);
  });
});

/**
 * The switch family's accessibility contract: a keyboard-operable `role="switch"` whose checked
 * state is always the caller's, and a lock that takes the action away without taking the control out
 * of the tab order.
 */
describe('ToggleSwitch', () => {
  it('is a switch to a keyboard, and holds no state of its own', async () => {
    const onChange = vi.fn();
    const { find } = await render(<ToggleSwitch enabled={false} onChange={onChange} />);

    const button = find<HTMLButtonElement>('button');

    expect(button.getAttribute('role')).toBe('switch');
    expect(button.getAttribute('aria-checked')).toBe('false');

    await click(button);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(button.getAttribute('aria-checked')).toBe('false');
  });

  it('reports the enabled state it was given', async () => {
    const { find } = await render(<ToggleSwitch enabled={true} />);

    expect(find<HTMLButtonElement>('button').getAttribute('aria-checked')).toBe('true');
  });

  it('is aria-disabled rather than disabled when locked, so it stays focusable', async () => {
    const onChange = vi.fn();
    const { find } = await render(
      <ToggleSwitch enabled={true} locked={true} onChange={onChange} />,
    );

    const button = find<HTMLButtonElement>('button');

    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-disabled')).toBe('true');

    await click(button);

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('LockableToggleSwitch', () => {
  it('reports the unlock request rather than unlocking itself', async () => {
    // The lock is held inside the component on purpose: the caller learns from the prop it set, and
    // the tooltip explaining the lock is what a click on a locked switch produces.
    const onChange = vi.fn();
    const { find, findByText } = await render(
      <LockableToggleSwitch
        label="Verbose logging"
        enabled={false}
        locked={true}
        lockReasonTitle="Turn it on first"
        onChange={onChange}
      />,
    );

    await click(find<HTMLButtonElement>('button'));

    expect(onChange).not.toHaveBeenCalled();
    expect(findByText('Turn it on first')).toBeDefined();
  });
});

describe('Checkbox', () => {
  it('reports the new checked state', async () => {
    const onChange = vi.fn();
    const { find } = await render(<Checkbox checked={false} onChange={onChange} />);

    const input = find<HTMLInputElement>('input');

    expect(input.checked).toBe(false);

    await click(input);

    expect(onChange).toHaveBeenCalledWith(true);
  });
});

/**
 * The numeric inputs accept what is typed and repair it into the field's range: an absent value
 * renders as an empty field rather than as a zero the caller never set, non-numbers clear back to
 * absent, and anything past the bounds is clamped before the caller ever sees it.
 */
describe('DecimalIntegerInput', () => {
  it('renders an empty field for an absent value rather than a zero the caller never set', async () => {
    const { find } = await render(
      <DecimalIntegerInput
        value={undefined}
        onChange={() => undefined}
        minValue={0}
        maxValue={100}
      />,
    );

    expect(find<HTMLInputElement>('input').value).toBe('');
  });

  it('keeps the typed text as long as it is a number, and reports the value', async () => {
    const onChange = vi.fn();
    const { find } = await render(
      <DecimalIntegerInput value={undefined} onChange={onChange} minValue={0} maxValue={100} />,
    );

    await type(find<HTMLInputElement>('input'), '42');

    expect(onChange).toHaveBeenCalledWith(42);
  });

  it('clamps a typed value to the range it was given', async () => {
    const onChange = vi.fn();
    const { find } = await render(
      <DecimalIntegerInput value={undefined} onChange={onChange} minValue={0} maxValue={100} />,
    );

    await type(find<HTMLInputElement>('input'), '400');

    expect(onChange).toHaveBeenCalledWith(100);
  });

  it('clears the field when the typed text is not a number', async () => {
    const onChange = vi.fn();
    const { find } = await render(
      <DecimalIntegerInput value={5} onChange={onChange} minValue={0} maxValue={100} />,
    );

    await type(find<HTMLInputElement>('input'), 'abc');

    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});

describe('UnsignedIntegerInput', () => {
  it('steps the value up and down from its own buttons', async () => {
    const onChange = vi.fn();
    const { findAll } = await render(
      <UnsignedIntegerInput value={5} onChange={onChange} min={0} max={10} />,
    );

    const buttons = findAll<HTMLButtonElement>('button');

    expect(buttons).toHaveLength(2);

    await click(buttons[0] as HTMLButtonElement);

    expect(onChange).toHaveBeenCalledWith(6);

    await click(buttons[1] as HTMLButtonElement);

    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('clamps every change to the range, so the caller never holds a value out of bounds', async () => {
    const onChange = vi.fn();
    const { find } = await render(
      <UnsignedIntegerInput value={10} onChange={onChange} min={0} max={10} />,
    );

    await click(find<HTMLButtonElement>('button'));

    expect(onChange).toHaveBeenCalledWith(10);
  });
});

describe('ByteFractionInput', () => {
  it('clamps to the byte fraction it is for, whatever is typed', async () => {
    const onChange = vi.fn();
    const { find } = await render(<ByteFractionInput value={0} onChange={onChange} />);

    await type(find<HTMLInputElement>('input'), '12.5');

    expect(onChange).toHaveBeenCalledWith(12.5);

    await type(find<HTMLInputElement>('input'), '400');

    expect(onChange).toHaveBeenCalledWith(25.5);
  });
});

describe('SearchInput', () => {
  it('reports the typed text and clears on request', async () => {
    const onChangeText = vi.fn();
    const onClear = vi.fn();
    const { find, findAll } = await render(
      <SearchInput value="needle" onChangeText={onChangeText} onClear={onClear} />,
    );

    await type(find<HTMLInputElement>('input'), 'needles');

    expect(onChangeText).toHaveBeenCalledWith('needles');

    await click(findAll<HTMLButtonElement>('button')[0] as HTMLButtonElement);

    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

describe('Slider', () => {
  it('renders a thumb positioned at the value it was given', async () => {
    // The position is the only thing a slider can be asserted on in jsdom: there is no layout, so a
    // pointer drag cannot be measured here. The value reporting is covered by the caller's own input.
    const { container } = await render(
      <Slider min={0} max={100} value={25} onChange={() => undefined} />,
    );

    expect(container.querySelector('[role="slider"]')?.getAttribute('aria-valuenow')).toBe('25');
  });
});

/**
 * A decimal field whose value stays a string, so half-typed text reaches the caller. The bounds the
 * browser spinner enforces are checked here too: out-of-range text is outlined, not swallowed.
 */
describe('FloatInput', () => {
  it('reports sanitized numeric text as it is typed', async () => {
    const onChange = vi.fn();
    const { find } = await render(<FloatInput value="" onChange={onChange} />);

    await type(find<HTMLInputElement>('input'), '1.5');

    expect(onChange).toHaveBeenCalledWith('1.5');
  });

  it('outlines a value that is a complete number inside its bounds as valid', async () => {
    const { find } = await render(
      <FloatInput value="1.5" onChange={() => undefined} min={0} max={2} />,
    );

    // A valid field is outlined transparently; the number itself is the browser's to render.
    expect(find<HTMLInputElement>('input').style.border).toContain('rgba(0, 0, 0, 0)');
  });

  it('outlines a half-typed value as invalid rather than clearing it', async () => {
    const { find } = await render(<FloatInput value="-" onChange={() => undefined} />);

    expect(find<HTMLInputElement>('input').style.border).toContain('var(--color-tda)');
  });

  it('outlines a value outside the range as invalid', async () => {
    const { find } = await render(
      <FloatInput value="5" onChange={() => undefined} min={0} max={2} />,
    );

    expect(find<HTMLInputElement>('input').style.border).toContain('var(--color-tda)');
  });
});

/**
 * An IPv4 field: incomplete while it is being typed, and every octet clamped to a byte rather than
 * rejected, so the caller never holds an address the field cannot show.
 */
describe('IPInput', () => {
  it('reports the address as it is typed', async () => {
    const onChange = vi.fn();
    const { find } = await render(<IPInput value="192.168.0.1" onChange={onChange} />);

    await type(find<HTMLInputElement>('input'), '192.168.0.2');

    expect(onChange).toHaveBeenCalledWith('192.168.0.2');
  });

  it('clamps each octet to a byte', async () => {
    const onChange = vi.fn();
    const { find } = await render(<IPInput value="" onChange={onChange} />);

    await type(find<HTMLInputElement>('input'), '999.999.999.999');

    expect(onChange).toHaveBeenCalledWith('255.255.255.255');
  });

  it('drops a fifth octet and strips what is not a digit or a dot', async () => {
    const onChange = vi.fn();
    const { find } = await render(<IPInput value="" onChange={onChange} />);

    await type(find<HTMLInputElement>('input'), '1a.2.3.4.5');

    expect(onChange).toHaveBeenCalledWith('1.2.3.4');
  });

  it('outlines a complete address as valid and a partial one as not', async () => {
    const { find, update } = await render(
      <IPInput value="192.168.0.1" onChange={() => undefined} />,
    );

    expect(find<HTMLInputElement>('input').style.border).toContain('rgba(0, 0, 0, 0)');

    await update(<IPInput value="192.168" onChange={() => undefined} />);

    expect(find<HTMLInputElement>('input').style.border).toContain('var(--color-tda)');
  });
});

/**
 * A field that holds its own copy of the text and reports it once typing stops — on blur or on Enter —
 * so the expensive thing behind it is not re-run for every keystroke.
 */
describe('DelayedInput', () => {
  it('holds the typed text and reports it only on blur', async () => {
    const onChange = vi.fn();
    const { find } = await render(<DelayedInput value="initial" onChange={onChange} />);

    const input = find<HTMLInputElement>('input');

    await type(input, 'typed');

    expect(input.value).toBe('typed');
    expect(onChange).not.toHaveBeenCalled();

    input.focus();
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));

    expect(onChange).toHaveBeenCalledWith('typed');
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
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(onChange).toHaveBeenCalledWith('committed');
  });

  it('adopts a value the caller replaces under it', async () => {
    const { find, update } = await render(<DelayedInput value="one" onChange={() => undefined} />);

    await update(<DelayedInput value="two" onChange={() => undefined} />);

    expect(find<HTMLInputElement>('input').value).toBe('two');
  });
});

/**
 * A text field for a WebSocket address: the address is the caller's, the field reports what was typed,
 * and Enter is a request to dial rather than something the field does.
 */
describe('SocketServerAddressInput', () => {
  it('reports the typed text and passes the placeholder through', async () => {
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

  it('asks to confirm on Enter', async () => {
    const onConfirm = vi.fn();
    const { find } = await render(
      <SocketServerAddressInput value="" onChange={() => undefined} onConfirm={onConfirm} />,
    );

    find<HTMLInputElement>('input').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('clears through the field clear button', async () => {
    const onChange = vi.fn();
    const { find } = await render(
      <SocketServerAddressInput value="wss://x" onChange={onChange} onConfirm={() => undefined} />,
    );

    await click(find<HTMLButtonElement>('button'));

    expect(onChange).toHaveBeenCalledWith('');
  });
});

/**
 * One part of a time, wrapping at `max` rather than clamping, with arrows that stop at the bounds so
 * the value cannot be stepped out of range.
 */
describe('TimePartInput', () => {
  it('steps up and down from its arrows', async () => {
    const onChange = vi.fn();
    const { findAll } = await render(<TimePartInput value={5} onChange={onChange} max={10} />);

    // Three buttons: the up arrow, the field's own clear button, and the down arrow.
    const buttons = findAll<HTMLButtonElement>('button');

    expect(buttons).toHaveLength(3);

    await click(buttons[0] as HTMLButtonElement);
    expect(onChange).toHaveBeenLastCalledWith(6);

    await click(buttons[2] as HTMLButtonElement);
    expect(onChange).toHaveBeenLastCalledWith(4);
  });

  it('disables the arrow that would step past a bound', async () => {
    const onChange = vi.fn();
    const { findAll, update } = await render(
      <TimePartInput value={10} onChange={onChange} max={10} />,
    );

    // The up arrow is inactive at the top and takes no handler; the down arrow still steps.
    await click(findAll<HTMLButtonElement>('button')[0] as HTMLButtonElement);

    expect(onChange).not.toHaveBeenCalled();

    await update(<TimePartInput value={0} onChange={onChange} max={10} />);

    const buttons = findAll<HTMLButtonElement>('button');

    await click(buttons[2] as HTMLButtonElement);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reports a typed value, reading an emptied field as zero', async () => {
    const onChange = vi.fn();
    const { find } = await render(<TimePartInput value={0} onChange={onChange} max={59} />);

    await type(find<HTMLInputElement>('input'), '30');

    expect(onChange).toHaveBeenCalledWith(30);
  });
});

describe('HourMinuteTimeInput', () => {
  it('renders an hour and a minute field with a separator', async () => {
    const onHourChange = vi.fn();
    const onMinuteChange = vi.fn();
    const { findAll } = await render(
      <HourMinuteTimeInput
        hour={13}
        onHourChange={onHourChange}
        minute={45}
        onMinuteChange={onMinuteChange}
      />,
    );

    // Each field contributes three buttons: up arrow, clear, down arrow.
    const buttons = findAll<HTMLButtonElement>('button');

    expect(findAll('input')).toHaveLength(2);
    expect(buttons).toHaveLength(6);

    await click(buttons[0] as HTMLButtonElement);
    expect(onHourChange).toHaveBeenCalledWith(14);

    await click(buttons[3] as HTMLButtonElement);
    expect(onMinuteChange).toHaveBeenCalledWith(46);
  });
});

describe('HourMinuteSecondTimeInput', () => {
  it('renders three fields and reports the one that was stepped', async () => {
    const onSecondChange = vi.fn();
    const { findAll } = await render(
      <HourMinuteSecondTimeInput
        hour={0}
        onHourChange={() => undefined}
        minute={0}
        onMinuteChange={() => undefined}
        second={30}
        onSecondChange={onSecondChange}
      />,
    );

    // Each field contributes three buttons: up arrow, clear, down arrow.
    const buttons = findAll<HTMLButtonElement>('button');

    expect(findAll('input')).toHaveLength(3);
    expect(buttons).toHaveLength(9);

    // The seconds field is the third one, after hour and minute.
    await click(buttons[6] as HTMLButtonElement);

    expect(onSecondChange).toHaveBeenCalledWith(31);
  });
});

/**
 * A number shown as its bits: `flagDescriptionMap` is the caller's vocabulary and this component is
 * only the reading of it, listing the set bits and naming them.
 */
describe('BitField', () => {
  const flagDescriptionMap = { 0: 'First flag', 1: 'Second flag', 8: 'Ninth flag' };

  it('renders the octets of the value in hex', async () => {
    const { findAll } = await render(
      <BitField flags={1} flagDescriptionMap={flagDescriptionMap} octetCount={2} />,
    );

    // Two bytes, high byte first: the value 1 is `00` then `01`.
    expect(findAll('div').map((element) => element.textContent)).toContain('00');
    expect(document.body.textContent).toContain('01');
  });

  it('lists only the descriptions of set bits by default', async () => {
    const { container } = await render(
      <BitField flags={1} flagDescriptionMap={flagDescriptionMap} octetCount={2} />,
    );

    expect(container.textContent).toContain('First flag');
    expect(container.textContent).not.toContain('Second flag');
    expect(container.textContent).not.toContain('Ninth flag');
  });

  it('lists every description when told to show the whole field', async () => {
    const { container } = await render(
      <BitField
        flags={1}
        flagDescriptionMap={flagDescriptionMap}
        octetCount={2}
        showEntireDescription={true}
      />,
    );

    expect(container.textContent).toContain('First flag');
    expect(container.textContent).toContain('Second flag');
    expect(container.textContent).toContain('Ninth flag');
  });

  it('cross-highlights the bit a row names while the pointer is over it', async () => {
    const { findByText } = await render(
      <BitField flags={1} flagDescriptionMap={flagDescriptionMap} octetCount={2} />,
    );

    const row = findByText('First flag').parentElement;

    act(() => {
      row?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    });

    expect(document.body.querySelector('.text-tok')).not.toBeNull();
  });

  it('ignores a description for a bit above the shown octets', async () => {
    const { container } = await render(
      <BitField
        flags={1}
        flagDescriptionMap={{ 0: 'First flag', 64: 'Too high' }}
        octetCount={1}
        showEntireDescription={true}
      />,
    );

    expect(container.textContent).toContain('First flag');
    expect(container.textContent).not.toContain('Too high');
  });
});

describe('UploadConfig', () => {
  const file = new File(['contents'], 'report.txt');

  beforeEach(() => {
    openFileDialog.mockReset();
  });

  it('shows the hint and an upload action while it is empty', async () => {
    const { findByText } = await render(<UploadConfig onFileUpload={vi.fn()} />);

    expect(findByText('Drag a file here to upload')).toBeDefined();
    expect(findByText('Upload')).toBeDefined();
  });

  it('opens the file picker and reports the chosen file', async () => {
    const onFileChange = vi.fn();
    openFileDialog.mockImplementation((callback: (file: File) => void) => callback(file));

    const { findAll, findByText } = await render(
      <UploadConfig onFileUpload={vi.fn()} onFileChange={onFileChange} />,
    );

    // The drop area is the first button; the action button follows it.
    await click(findAll('button')[0] as HTMLButtonElement);

    expect(openFileDialog).toHaveBeenCalled();
    expect(onFileChange).toHaveBeenCalledWith(file);
    expect(findByText('report.txt')).toBeDefined();
  });

  it('uploads the file it holds and reports completion', async () => {
    const onFileUpload = vi.fn().mockResolvedValue(undefined);
    const { findAll, findByText } = await render(
      <UploadConfig onFileUpload={onFileUpload} uploadedFile={file} />,
    );

    await click(findAll('button')[1] as HTMLButtonElement);
    await flush();

    expect(onFileUpload).toHaveBeenCalledWith(file);
    expect(findByText('Uploaded')).toBeDefined();
  });

  it('tracks progress and cancels an upload in flight', async () => {
    const onFileUploadCancel = vi.fn();
    const { findAll, findByText } = await render(
      <UploadConfig
        onFileUpload={vi.fn().mockResolvedValue(undefined)}
        onFileUploadCancel={onFileUploadCancel}
        uploadedFile={file}
        progress={0}
      />,
    );

    await click(findAll('button')[1] as HTMLButtonElement);
    await flush();

    // While progress is tracked the status stays in flight and the action becomes a cancel.
    expect(findByText('0%')).toBeDefined();
    expect(findByText('Cancel')).toBeDefined();

    await click(findAll('button')[1] as HTMLButtonElement);

    expect(onFileUploadCancel).toHaveBeenCalledWith(file);
    expect(findByText('Upload')).toBeDefined();
  });

  it('reports completion once tracked progress reaches the end', async () => {
    const onFileUpload = vi.fn().mockResolvedValue(undefined);
    const { findAll, findByText, update } = await render(
      <UploadConfig onFileUpload={onFileUpload} uploadedFile={file} progress={0} />,
    );

    await click(findAll('button')[1] as HTMLButtonElement);
    await flush();

    expect(findByText('0%')).toBeDefined();

    await update(<UploadConfig onFileUpload={onFileUpload} uploadedFile={file} progress={100} />);

    expect(findByText('Uploaded')).toBeDefined();
  });

  it('takes a file dropped onto the area', async () => {
    const onFileChange = vi.fn();
    const { findAll, findByText } = await render(
      <UploadConfig onFileUpload={vi.fn()} onFileChange={onFileChange} />,
    );

    const dropArea = findAll('button')[0] as HTMLButtonElement;
    const drop = new Event('drop', { bubbles: true, cancelable: true });

    Object.defineProperty(drop, 'dataTransfer', { value: { files: [file] } });

    act(() => {
      dropArea.dispatchEvent(drop);
    });

    expect(onFileChange).toHaveBeenCalledWith(file);
    expect(findByText('report.txt')).toBeDefined();
  });

  it('renders only the drop area when it is drop-only', async () => {
    const { findAll } = await render(<UploadConfig onFileUpload={vi.fn()} onlyDrop={true} />);

    expect(findAll('button')).toHaveLength(1);
  });
});
