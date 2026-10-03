/**
 * The button group's contract follows the library's controlled-component rule: every control renders
 * the state it was handed and reports the state it would move to. The suite also pins the two
 * accessibility edges the group owns — a button labelled behind an icon, and a keyboard navigable
 * group — plus the difference between the `inactive` visual variant and the `disabled` attribute.
 */
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/buttons/Button';
import { ButtonGroup } from '@/components/buttons/ButtonGroup';
import { IconButton } from '@/components/buttons/IconButton';
import { ToggleButton } from '@/components/buttons/ToggleButton';
import { click, render } from '@/util/testing/render';

describe('Button', () => {
  it('renders a real button and reports a click', async () => {
    const onClick = vi.fn();
    const { find } = await render(<Button title="Save" onClick={onClick} />);

    const button = find<HTMLButtonElement>('button');

    expect(button.type).toBe('button');
    expect(button.textContent).toContain('Save');

    await click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('writes the html button type through, so a button in a form can submit it', async () => {
    const { find } = await render(<Button title="Send" htmlButtonType="submit" />);

    expect(find<HTMLButtonElement>('button').type).toBe('submit');
  });

  it('makes an inactive button unclickable with the pointer, but keeps it a real button', async () => {
    // `inactive` is a visual variant rather than the `disabled` attribute, and the difference matters:
    // the button stays in the layout and stays focusable, and only the pointer is taken away.
    const onClick = vi.fn();
    const { find } = await render(<Button title="Save" type="inactive" onClick={onClick} />);

    const button = find<HTMLButtonElement>('button');

    expect(button.disabled).toBe(false);
    expect(button.className).toContain('pointer-events-none');
  });
});

describe('IconButton', () => {
  it('labels itself, because the icon is hidden from the accessibility tree', async () => {
    const { find } = await render(<IconButton icon="plus" ariaLabel="Add a row" />);

    const button = find<HTMLButtonElement>('button');

    expect(button.getAttribute('aria-label')).toBe('Add a row');
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('falls back to the tooltip when there is no aria label', async () => {
    // `aria-label=""` would name the button as empty, which is worse than naming it by its tooltip.
    const { find } = await render(<IconButton icon="plus" title="Add" />);

    expect(find<HTMLButtonElement>('button').getAttribute('aria-label')).toBe('Add');
  });

  it('drops the handler when inactive', async () => {
    const onClick = vi.fn();
    const { find } = await render(<IconButton icon="plus" inactive onClick={onClick} />);

    await click(find<HTMLButtonElement>('button'));

    expect(onClick).not.toHaveBeenCalled();
  });
});

/**
 * A group of buttons acting as one selection: the selection is the caller's, and the group is
 * reachable from the keyboard, which is what makes it a radio group in behaviour.
 */
describe('ButtonGroup', () => {
  const items = [
    { id: 'a', title: 'First' },
    { id: 'b', title: 'Second' },
    { id: 'c', title: 'Third' },
  ] as const;

  it('renders one button per item and marks the selected one', async () => {
    const { findAll } = await render(
      <ButtonGroup itemId="b" items={items} onItemChange={() => undefined} />,
    );

    const buttons = findAll<HTMLButtonElement>('button');

    expect(buttons.map((button) => button.textContent?.trim())).toEqual([
      'First',
      'Second',
      'Third',
    ]);
    expect(buttons[1]?.className).toContain('border-tli');
    expect(buttons[0]?.className).toContain('border-bsp');
  });

  it('reports the clicked id rather than moving the selection itself', async () => {
    const onItemChange = vi.fn();
    const { findAll } = await render(
      <ButtonGroup itemId="a" items={items} onItemChange={onItemChange} />,
    );

    await click(findAll<HTMLButtonElement>('button')[2] as HTMLButtonElement);

    expect(onItemChange).toHaveBeenCalledWith('c');
  });

  it('moves the selection with the arrow keys and wraps at both ends', async () => {
    const onItemChange = vi.fn();
    const { find } = await render(
      <ButtonGroup itemId="a" items={items} onItemChange={onItemChange} />,
    );

    const first = find<HTMLButtonElement>('button');

    first.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', bubbles: true }));
    expect(onItemChange).toHaveBeenLastCalledWith('c');

    first.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }));
    expect(onItemChange).toHaveBeenLastCalledWith('b');

    first.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true }));
    expect(onItemChange).toHaveBeenCalledTimes(2);
  });
});

/**
 * A two-option switch that names the option it will switch to rather than the one it is on. Given a
 * value outside its options it refuses rather than rendering a control with nowhere to go.
 */
describe('ToggleButton', () => {
  it('names the option it will switch to, and reports it', async () => {
    const options = [
      { value: 'line', title: 'Line', icon: 'grid' },
      { value: 'ring', title: 'Ring', icon: 'more' },
    ] as const;

    const onChange = vi.fn();
    const { find } = await render(
      <ToggleButton value="line" options={options} onChange={onChange} />,
    );

    const button = find<HTMLButtonElement>('button');

    expect(button.getAttribute('title')).toBe('Ring');

    await click(button);

    expect(onChange).toHaveBeenCalledWith('ring');
  });

  it('refuses a value that is not one of its options', async () => {
    // A toggle with no current option has nothing to show and nowhere to switch to, so this is a
    // mistake in the call rather than a state worth rendering.
    const options = [{ value: 'line', title: 'Line', icon: 'grid' }] as const;

    await expect(
      render(<ToggleButton value="bar" options={options} onChange={() => undefined} />),
    ).rejects.toThrow('"bar" is not one of its options');
  });
});
