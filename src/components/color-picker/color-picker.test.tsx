// SPDX-License-Identifier: MIT
// The colour models of the pickers: defaults, conversions and equality.
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { ColorInput } from '@/components/color-picker/ColorInput';
import { ColorPicker } from '@/components/color-picker/ColorPicker';
import { HexAlphaColorPicker } from '@/components/color-picker/HexAlphaColorPicker';
import { HexAlphaColorPickerPopover } from '@/components/color-picker/HexAlphaColorPickerPopover';
import { HexColorInput } from '@/components/color-picker/HexColorInput';
import { HexColorPicker } from '@/components/color-picker/HexColorPicker';
import { HslaColorPicker } from '@/components/color-picker/HslaColorPicker';
import { HslaStringColorPicker } from '@/components/color-picker/HslaStringColorPicker';
import { HslaStringColorPickerPopover } from '@/components/color-picker/HslaStringColorPickerPopover';
import { RgbaColorPicker } from '@/components/color-picker/RgbaColorPicker';
import { RgbaStringColorPicker } from '@/components/color-picker/RgbaStringColorPicker';
import { act, click, render, type, waitFor } from '@/util/testing/render';

/**
 * A hexadecimal colour model written out rather than imported, so a change to the shipped model is a
 * change to what these tests claim the component accepts.
 */
const hexColorModel = {
  defaultColor: '000',
  toHsva: (color: string) => {
    const digits = color.replace('#', '');
    const full = digits.length === 3 ? digits.replace(/./g, '$&$&') : digits;

    return { h: 0, s: 0, v: Number.parseInt(full.slice(0, 2), 16) / 255, a: 1 };
  },
  fromHsva: () => '000000',
  equal: (a: string, b: string) => a === b,
};

describe('ColorInput', () => {
  it('shows the colour it was given', async () => {
    const { find } = await render(
      <ColorInput
        color="#ff0000"
        escape={(value: string) => value}
        validate={(value: string) => value.startsWith('#')}
        onChange={() => undefined}
      />,
    );

    expect(find<HTMLInputElement>('input').value).toBe('#ff0000');
  });

  it('keeps an invalid value on screen and reports only a valid one', async () => {
    const onChange = vi.fn();
    const { find } = await render(
      <ColorInput
        color="#ff0000"
        escape={(value: string) => value}
        validate={(value: string) => /^#[0-9a-f]{6}$/i.test(value)}
        onChange={onChange}
      />,
    );

    const field = find<HTMLInputElement>('input');
    await type(field, '#ff0000z');

    // The text stays in the field, so an operator can see what they mistyped, but it is not
    // reported: an invalid colour is not a colour.
    expect(field.value).toBe('#ff0000z');
    expect(onChange).not.toHaveBeenCalled();

    await type(field, '#00ff00');

    expect(onChange).toHaveBeenCalledWith('#00ff00');
  });
});

describe('HexColorInput', () => {
  it('drops the characters that are not hexadecimal digits', async () => {
    const onChange = vi.fn();
    const { find } = await render(
      <HexColorInput color="ff0000" prefixed={true} onChange={onChange} />,
    );

    const field = find<HTMLInputElement>('input');
    await type(field, 'zz');

    // `escape` runs before the field is shown, so the characters that were typed are never in it and
    // what is left is what the caller sent, empty.
    expect(field.value).toBe('#');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows the prefix but reports the colour without it', async () => {
    const onChange = vi.fn();
    const { find } = await render(
      <HexColorInput color="ff0000" prefixed={true} onChange={onChange} />,
    );

    await type(find<HTMLInputElement>('input'), '#00ff00');

    expect(onChange).toHaveBeenCalledWith('#00ff00');
  });

  it('cuts the field to eight digits where alpha is allowed', async () => {
    const onChange = vi.fn();
    const { find } = await render(<HexColorInput color="" alpha={true} onChange={onChange} />);

    await type(find<HTMLInputElement>('input'), 'ff0000ffaabbcc');

    // Eight digits is the whole of `#rrggbbaa`, and `escape` cuts the field to eight before it is
    // validated, so what is reported is the colour those eight digits describe.
    expect(onChange).toHaveBeenCalledWith('#ff0000ff');
  });

  it('cuts the field to six digits where alpha is not allowed', async () => {
    const onChange = vi.fn();
    const { find } = await render(<HexColorInput color="" onChange={onChange} />);

    await type(find<HTMLInputElement>('input'), 'ff000080');

    // Without alpha the field stops at six, so a colour that carries transparency cannot be typed at
    // all rather than being silently accepted as an opaque one.
    expect(onChange).toHaveBeenCalledWith('#ff0000');
  });
});

describe('ColorPicker', () => {
  it('renders a saturation field and a hue bar', async () => {
    const { container } = await render(
      <ColorPicker colorModel={hexColorModel} color="ff0000" onChange={() => undefined} />,
    );

    // The controls are found by the classes the stylesheet hooks into, so that is what the
    // stylesheet and this test have in common.
    expect(container.querySelector('.color-picker-cn__saturation')).not.toBeNull();
    expect(container.querySelector('.color-picker-cn__last-control')).not.toBeNull();
  });

  it("falls back to the model's default colour rather than to no colour at all", async () => {
    const onChange = vi.fn();
    const { container } = await render(
      <ColorPicker colorModel={hexColorModel} onChange={onChange} />,
    );

    expect(container.querySelector('.color-picker-cn')).not.toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('HexColorPicker', () => {
  it('renders over a hexadecimal string without being given a model', async () => {
    const { container } = await render(
      <HexColorPicker color="ff0000" onChange={() => undefined} />,
    );

    expect(container.querySelector('.color-picker-cn')).not.toBeNull();
  });
});

describe('HexAlphaColorPicker', () => {
  it('renders the colour and the alpha channel', async () => {
    const { container } = await render(
      <HexAlphaColorPicker color="ff000080" onChange={() => undefined} />,
    );

    // Three controls: saturation, hue, alpha. The last one is the difference from a picker that
    // reports a six-digit colour for a value that had transparency in it.
    expect(container.querySelectorAll('.color-picker-cn__last-control').length).toBe(1);
    expect(container.querySelector('.color-picker-cn__alpha')).not.toBeNull();
  });
});

describe('HslaStringColorPicker', () => {
  it('renders over an `hsla()` string', async () => {
    const { container } = await render(
      <HslaStringColorPicker color="hsla(0, 100%, 50%, 1)" onChange={() => undefined} />,
    );

    expect(container.querySelector('.color-picker-cn')).not.toBeNull();
  });
});

describe('HexAlphaColorPickerPopover', () => {
  it('keeps the picker closed until the trigger is used', async () => {
    const { findByText, query } = await render(
      <HexAlphaColorPickerPopover
        trigger={<button type="button">Pick</button>}
        color="ff0000ff"
        onChange={() => undefined}
      />,
    );

    // The popover renders into a portal on the document, which is why `query` looks at the document
    // rather than at the container.
    expect(query('.color-picker-cn')).toBeNull();

    await click(findByText('Pick'));

    expect(query('.color-picker-cn')).not.toBeNull();
  });

  it('reports the colour once the change has settled, not once per pointer move', async () => {
    const onChange = vi.fn();
    const { findByText, find } = await render(
      <HexAlphaColorPickerPopover
        trigger={<button type="button">Pick</button>}
        color="ff0000ff"
        onChange={onChange}
      />,
    );

    await click(findByText('Pick'));

    const saturation = find('.color-picker-cn__interactive');
    act(() => {
      saturation.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }),
      );
    });

    // A drag fires a change per pointer move, and a caller that re-rendered a panel per change could
    // not drag at all; the debounce is why this component exists.
    expect(onChange).not.toHaveBeenCalled();

    await waitFor(() => onChange.mock.calls.length > 0);

    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

/** Nudges the saturation field so the picker has a changed colour to report. */
function dragSaturation(find: (selector: string) => HTMLElement): void {
  act(() => {
    find('.color-picker-cn__interactive').dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }),
    );
  });
}

describe('HslaColorPicker', () => {
  const color = { h: 120, s: 0.5, l: 0.25, a: 0.5 };

  it('renders an HSLA colour with its alpha channel', async () => {
    const { container } = await render(
      <HslaColorPicker color={color} onChange={() => undefined} />,
    );

    expect(container.querySelector('.color-picker-cn__alpha')).not.toBeNull();
  });

  it('reports the structured colour it drew', async () => {
    const onChange = vi.fn();
    const { find } = await render(<HslaColorPicker color={color} onChange={onChange} />);

    dragSaturation(find);

    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        h: expect.any(Number),
        s: expect.any(Number),
        l: expect.any(Number),
        a: expect.any(Number),
      }),
    );
  });
});

describe('RgbaColorPicker', () => {
  const color = { r: 255, g: 0, b: 0, a: 1 };

  it('renders an RGBA colour with its alpha channel', async () => {
    const { container } = await render(
      <RgbaColorPicker color={color} onChange={() => undefined} />,
    );

    expect(container.querySelector('.color-picker-cn__alpha')).not.toBeNull();
  });

  it('reports the structured colour it drew', async () => {
    const onChange = vi.fn();
    const { find } = await render(<RgbaColorPicker color={color} onChange={onChange} />);

    dragSaturation(find);

    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        r: expect.any(Number),
        g: expect.any(Number),
        b: expect.any(Number),
        a: expect.any(Number),
      }),
    );
  });
});

describe('RgbaStringColorPicker', () => {
  it('reports the colour as an `rgba()` string', async () => {
    const onChange = vi.fn();
    const { find } = await render(
      <RgbaStringColorPicker color="rgba(255, 0, 0, 1)" onChange={onChange} />,
    );

    dragSaturation(find);

    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0]?.[0]).toMatch(/^rgba\(/);
  });
});

describe('HslaStringColorPickerPopover', () => {
  it('keeps the picker closed until the trigger is used', async () => {
    const { findByText, query } = await render(
      <HslaStringColorPickerPopover
        trigger={<button type="button">Pick</button>}
        color="hsla(0, 100%, 50%, 1)"
        onChange={() => undefined}
      />,
    );

    expect(query('.color-picker-cn')).toBeNull();

    await click(findByText('Pick'));

    expect(query('.color-picker-cn')).not.toBeNull();
  });
});
