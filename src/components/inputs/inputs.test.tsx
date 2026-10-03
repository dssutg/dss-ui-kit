// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { ByteFractionInput } from '@/components/inputs/ByteFractionInput';
import { Checkbox } from '@/components/inputs/Checkbox';
import { DecimalIntegerInput } from '@/components/inputs/DecimalIntegerInput';
import { Input } from '@/components/inputs/Input';
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
});

describe('TextInput', () => {
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
