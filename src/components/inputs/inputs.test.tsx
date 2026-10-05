/**
 * The input group is held to the library's rule that a control renders the value it is given and
 * reports what it would move to. Two contracts matter beyond that: the numeric inputs repair what is
 * typed — clamping to range, refusing non-numbers — because a rendered value must never leave the
 * range its field means, and the switch family is keyboard-reachable with the exact `role` and
 * `aria-*` attributes a screen reader reads a switch by.
 */
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { ByteFractionInput } from '@/components/inputs/ByteFractionInput';
import { Checkbox } from '@/components/inputs/Checkbox';
import { ColorfulYesNo } from '@/components/inputs/ColorfulYesNo';
import { DecimalIntegerInput } from '@/components/inputs/DecimalIntegerInput';
import { Input } from '@/components/inputs/Input';
import { JsonEditor } from '@/components/inputs/JsonEditor';
import { LockableToggleSwitch } from '@/components/inputs/LockableToggleSwitch';
import { SearchInput } from '@/components/inputs/SearchInput';
import { Select } from '@/components/inputs/Select';
import { Slider } from '@/components/inputs/Slider';
import { TextInput } from '@/components/inputs/TextInput';
import { ToggleSwitch } from '@/components/inputs/ToggleSwitch';
import { UnsignedIntegerInput } from '@/components/inputs/UnsignedIntegerInput';
import { change, click, render, type } from '@/util/testing/render';

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
        hiddenText
        hasShowPasswordButton
        onShowPasswordClick={onShowPasswordClick}
      />,
    );

    expect(find<HTMLInputElement>('input').type).toBe('password');
    expect(findAll<HTMLButtonElement>('button')).toHaveLength(2);

    await click(findAll<HTMLButtonElement>('button')[0] as HTMLButtonElement);

    expect(onShowPasswordClick).toHaveBeenCalledTimes(1);

    await update(
      <TextInput value="secret" hasShowPasswordButton onShowPasswordClick={onShowPasswordClick} />,
    );

    expect(find<HTMLInputElement>('input').type).toBe('text');
    expect(findAll<HTMLButtonElement>('button')[0]?.getAttribute('title')).toBe('Hide password');
  });
});

describe('ColorfulYesNo', () => {
  it('merges the caller classes whichever answer it is printing', async () => {
    // The colour is `yesIsBad`'s opinion of the answer and the caller's classes are the caller's; the
    // two never trade places, and neither of the two answers drops what the caller asked for.
    const { update, container } = await render(<ColorfulYesNo yes className="font-bold" />);

    expect(container.querySelector('span')?.className).toContain('font-bold');

    await update(<ColorfulYesNo yes={false} className="font-bold" />);

    expect(container.querySelector('span')?.className).toContain('font-bold');
  });

  it('lets the caller override the colour, because a colour is a decision rather than a guarantee', async () => {
    const { container } = await render(<ColorfulYesNo yes className="text-tpd" />);

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
      <Select value="a" onChange={() => undefined} disabled>
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
    const { find } = await render(<ToggleSwitch enabled />);

    expect(find<HTMLButtonElement>('button').getAttribute('aria-checked')).toBe('true');
  });

  it('is aria-disabled rather than disabled when locked, so it stays focusable', async () => {
    const onChange = vi.fn();
    const { find } = await render(<ToggleSwitch enabled locked onChange={onChange} />);

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
        locked
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
