// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ColorInput } from '@/components/color-picker/ColorInput';
import { ColorPicker } from '@/components/color-picker/ColorPicker';
import type { ColorModel } from '@/components/color-picker/color_picker_types';
import { HexAlphaColorPicker } from '@/components/color-picker/HexAlphaColorPicker';
import { HexColorPicker } from '@/components/color-picker/HexColorPicker';
import { HslaStringColorPickerPopover } from '@/components/color-picker/HslaStringColorPickerPopover';
import { act, click, render, type, waitFor } from '@/util/testing/render';
import {
  equalColorObjects,
  equalColorString,
  equalHex,
  hexToHsva,
  hslaStringToHsva,
  hslaToHsva,
  hsvaToHex,
  hsvaToRgba,
  rgbaStringToHsva,
  rgbaToHsva,
} from './color_picker_conversion';
import {
  getArrowKeyInteraction,
  getParentWindow,
  getRelativePosition,
  getTouchId,
  isInvalid,
  preventDefaultMove,
} from './color_picker_interaction';

/**
 * The colour picker family, exercised where the interaction is not the point.
 *
 * `color-picker.test.tsx` renders each picker and drives it through the shared helpers — a
 * `mousedown` on the saturation field and the debounce that settles a popover. What is left is the
 * behaviour underneath: the pointer/touch/keyboard state machine that follows a drag across the
 * document, the conversion helpers at their edges, the text field's blur reset, and the shared
 * state's decision to ignore a colour the caller did not actually change.
 *
 * The interaction module is pure functions, so it is driven directly rather than through a picker;
 * the rest is rendered, because the behaviour only exists once a control is mounted.
 */

/** A `Touch` carrying only the fields the source reads plus the interface's required ones. */
class StubTouch implements Touch {
  readonly clientX: number;
  readonly clientY: number;
  readonly force: number;
  readonly identifier: number;
  readonly pageX: number;
  readonly pageY: number;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly rotationAngle: number;
  readonly screenX: number;
  readonly screenY: number;
  readonly target: EventTarget;

  constructor(init: TouchInit) {
    this.clientX = init.clientX ?? 0;
    this.clientY = init.clientY ?? 0;
    this.force = init.force ?? 0;
    this.identifier = init.identifier;
    this.pageX = init.pageX ?? 0;
    this.pageY = init.pageY ?? 0;
    this.radiusX = init.radiusX ?? 0;
    this.radiusY = init.radiusY ?? 0;
    this.rotationAngle = init.rotationAngle ?? 0;
    this.screenX = init.screenX ?? 0;
    this.screenY = init.screenY ?? 0;
    this.target = init.target;
  }
}

/** Builds a `TouchList`-shaped object: `length`, `item(index)` and numeric-indexed touches. */
function stubTouchList(touches: readonly Touch[]): TouchList {
  const byIndex: { [index: number]: Touch } = {};
  for (const [index, touch] of touches.entries()) {
    byIndex[index] = touch;
  }

  return {
    ...byIndex,
    length: touches.length,
    item: (index: number): Touch | null => byIndex[index] ?? null,
    [Symbol.iterator]: (): ArrayIterator<Touch> => touches.values(),
  };
}

/**
 * A `TouchEvent`-shaped event whose touch lists are fake ones built from the initialiser.
 *
 * jsdom implements neither `Touch` nor `TouchEvent`, so the global is replaced with this while the
 * suite runs; `new TouchEvent(...)` then builds one, and a component that reads `touches` or
 * `changedTouches` reads the fake list.
 */
class StubTouchEvent extends Event {
  readonly touches: TouchList;
  readonly targetTouches: TouchList;
  readonly changedTouches: TouchList;

  constructor(type: string, init: TouchEventInit = {}) {
    super(type, init);
    this.touches = stubTouchList(init.touches ?? []);
    this.targetTouches = stubTouchList(init.targetTouches ?? []);
    this.changedTouches = stubTouchList(init.changedTouches ?? []);
  }
}

/** A keyboard event whose deprecated `which`/`keyCode` the source reads. */
function keyboardEvent(
  init: number | { readonly which?: number; readonly keyCode?: number },
): KeyboardEvent {
  const values = typeof init === 'number' ? { which: init } : init;
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true });

  Object.defineProperty(event, 'which', { value: values.which ?? 0 });
  Object.defineProperty(event, 'keyCode', { value: values.keyCode ?? 0 });

  return event;
}

/** A detached element a test can position events against. */
function scratchNode(): HTMLDivElement {
  const node = document.createElement('div');
  document.body.appendChild(node);

  return node;
}

beforeEach(() => {
  vi.stubGlobal('TouchEvent', StubTouchEvent);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('color picker conversion', () => {
  it('compares colour objects by their channels', () => {
    const colour = { r: 1, g: 2, b: 3 };

    expect(equalColorObjects(colour, colour)).toBe(true);
    expect(equalColorObjects({ r: 1, g: 2, b: 3 }, { r: 1, g: 2, b: 3 })).toBe(true);
    expect(equalColorObjects({ r: 1, g: 2, b: 3 }, { r: 1, g: 2, b: 4 })).toBe(false);
  });

  it('compares colour strings ignoring whitespace', () => {
    expect(equalColorString('rgb(1, 2, 3)', 'rgb( 1,2,3 )')).toBe(true);
    expect(equalColorString('rgb(1, 2, 3)', 'rgb(1, 2, 4)')).toBe(false);
  });

  it('compares hexadecimal colours whatever form each is written in', () => {
    expect(equalHex('#fff', '#FFFFFF')).toBe(true);
    expect(equalHex('#FFF', 'ffffff')).toBe(true);
    expect(equalHex('#ff0000', '#ff000080')).toBe(false);
  });

  it('parses the 3, 4, 6 and 8 digit hexadecimal forms', () => {
    expect(hexToHsva('ff0000')).toEqual({ h: 0, s: 100, v: 100, a: 1 });
    expect(hexToHsva('#f00')).toEqual({ h: 0, s: 100, v: 100, a: 1 });
    expect(hexToHsva('#f00f').a).toBeCloseTo(1, 2);
    expect(hexToHsva('#ff000080').a).toBeCloseTo(0.5, 2);
  });

  it('parses an hsla string with a decimal alpha', () => {
    expect(hslaStringToHsva('hsla(120, 50%, 25%, 0.5)')).toEqual({
      h: 120,
      s: 66.66666666666666,
      v: 37.5,
      a: 0.5,
    });
  });

  it('parses the CSS angle units and the unit-less hue', () => {
    expect(hslaStringToHsva('hsl(0.5turn, 50%, 50%)').h).toBe(180);
    expect(hslaStringToHsva('hsl(100grad, 50%, 50%)').h).toBe(90);
    expect(hslaStringToHsva('hsl(3.14rad, 50%, 50%)').h).toBeCloseTo(180, 0);
    expect(hslaStringToHsva('hsl(120deg, 50%, 50%)').h).toBe(120);
    expect(hslaStringToHsva('hsl(120 50% 50%)').h).toBe(120);
  });

  it('parses a missing alpha as opaque and a percentage alpha as a fraction', () => {
    expect(hslaStringToHsva('hsl(0, 0%, 0%)').a).toBe(1);
    expect(hslaStringToHsva('hsla(0, 0%, 0%, 50%)').a).toBe(0.5);
  });

  it('parses an unrecognised hsla string to opaque black', () => {
    expect(hslaStringToHsva('not a colour')).toEqual({ h: 0, s: 0, v: 0, a: 1 });
  });

  it('moves the shading from lightness to value, keeping a grey at zero saturation', () => {
    expect(hslaToHsva({ h: 0, s: 100, l: 50, a: 1 })).toEqual({ h: 0, s: 100, v: 100, a: 1 });
    expect(hslaToHsva({ h: 0, s: 0, l: 50, a: 1 })).toEqual({ h: 0, s: 0, v: 50, a: 1 });
  });

  it('formats an HSVA colour as hex, with alpha only when it carries one', () => {
    expect(hsvaToHex({ h: 0, s: 0, v: 0, a: 1 })).toBe('#000000');
    expect(hsvaToHex({ h: 0, s: 100, v: 100, a: 0.5 })).toBe('#ff000080');
  });

  it('reads a percentage RGB string and a percentage alpha', () => {
    expect(rgbaStringToHsva('rgb(100%, 50%, 0%)')).toEqual({
      h: 30,
      s: 100,
      v: 100,
      a: 1,
    });
    expect(rgbaStringToHsva('rgba(0, 0, 0, 50%)').a).toBe(0.5);
  });

  it('parses an unrecognised rgba string to opaque black', () => {
    expect(rgbaStringToHsva('nonsense')).toEqual({ h: 0, s: 0, v: 0, a: 1 });
  });

  it('derives the hue from whichever channel is largest', () => {
    expect(rgbaToHsva({ r: 255, g: 0, b: 0, a: 1 })).toEqual({ h: 0, s: 100, v: 100, a: 1 });
    expect(rgbaToHsva({ r: 0, g: 255, b: 0, a: 1 }).h).toBe(120);
    expect(rgbaToHsva({ r: 0, g: 0, b: 255, a: 1 }).h).toBe(240);
    expect(rgbaToHsva({ r: 255, g: 0, b: 255, a: 1 }).h).toBe(300);
  });

  it('reports no saturation for a grey or a black', () => {
    expect(rgbaToHsva({ r: 100, g: 100, b: 100, a: 1 })).toEqual({ h: 0, s: 0, v: 39, a: 1 });
    expect(rgbaToHsva({ r: 0, g: 0, b: 0, a: 1 })).toEqual({ h: 0, s: 0, v: 0, a: 1 });
  });

  it('falls back to black channels for a hue that is not a finite number', () => {
    expect(hsvaToRgba({ h: Number.NaN, s: 100, v: 100, a: 1 })).toEqual({
      r: 0,
      g: 0,
      b: 0,
      a: 1,
    });
  });
});

describe('color picker interaction', () => {
  it('finds the owning window, falling back to self with no node', () => {
    const node = scratchNode();

    expect(getParentWindow(node)).toBe(window);
    expect(getParentWindow()).toBe(window);
  });

  it('reads a relative position from a mouse event', () => {
    const node = scratchNode();

    const event = new MouseEvent('mousemove', { clientX: 512, clientY: 384 });

    expect(getRelativePosition(node, event, null)).toEqual({ left: 0.5, top: 0.5 });
  });

  it('reads the position of the touch that started the drag', () => {
    const node = scratchNode();
    const touch = new StubTouch({ identifier: 7, target: node, pageX: 256, pageY: 192 });
    const event = new TouchEvent('touchmove', { touches: [touch] });

    expect(getRelativePosition(node, event, 7)).toEqual({ left: 0.25, top: 0.25 });
  });

  it('falls back to the first touch when the tracked one has lifted', () => {
    const node = scratchNode();
    const touch = new StubTouch({ identifier: 3, target: node, pageX: 1024, pageY: 768 });
    const event = new TouchEvent('touchmove', { touches: [touch] });

    expect(getRelativePosition(node, event, 999)).toEqual({ left: 1, top: 1 });
  });

  it('reports no interaction when a touch move carries no touch', () => {
    const node = scratchNode();
    const event = new TouchEvent('touchmove', { touches: [] });

    expect(getRelativePosition(node, event, null)).toEqual({ left: 0, top: 0 });
  });

  it('identifies the finger a touch interaction belongs to', () => {
    const touch = new StubTouch({ identifier: 42, target: document.body });
    const event = new TouchEvent('touchstart', { changedTouches: [touch] });

    expect(getTouchId(event)).toBe(42);
    expect(getTouchId(new TouchEvent('touchstart', { changedTouches: [] }))).toBeNull();
  });

  it('cancels the default only for a mouse event', () => {
    const mouse = new MouseEvent('mousedown', { cancelable: true });

    preventDefaultMove(mouse);
    expect(mouse.defaultPrevented).toBe(true);

    const touch = new TouchEvent('touchstart', { cancelable: true, touches: [] });

    preventDefaultMove(touch);
    expect(touch.defaultPrevented).toBe(false);
  });

  it('refuses a mouse event while a touch is underway', () => {
    const mouse = new MouseEvent('mousedown');
    const touch = new TouchEvent('touchstart', { touches: [] });

    expect(isInvalid(mouse, true)).toBe(true);
    expect(isInvalid(touch, true)).toBe(false);
    expect(isInvalid(mouse, false)).toBe(false);
  });

  it('moves the handle with the arrow keys and ignores the others', () => {
    expect(getArrowKeyInteraction(keyboardEvent(39))).toEqual({ left: 0.05, top: 0 });
    expect(getArrowKeyInteraction(keyboardEvent(37))).toEqual({ left: -0.05, top: 0 });
    expect(getArrowKeyInteraction(keyboardEvent(40))).toEqual({ left: 0, top: 0.05 });
    expect(getArrowKeyInteraction(keyboardEvent(38))).toEqual({ left: 0, top: -0.05 });
    expect(getArrowKeyInteraction(keyboardEvent(36))).toBeNull();
  });

  it('falls back to keyCode when which is not set', () => {
    expect(getArrowKeyInteraction(keyboardEvent({ which: 0, keyCode: 39 }))).toEqual({
      left: 0.05,
      top: 0,
    });
  });
});

describe('AlphaColorPicker', () => {
  it('reports an alpha when the alpha bar is dragged', async () => {
    const onChange = vi.fn();
    const { find } = await render(<HexAlphaColorPicker color="ff000080" onChange={onChange} />);

    const alpha = find('.color-picker-cn__alpha .color-picker-cn__interactive');

    act(() => {
      alpha.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, clientX: 256, clientY: 10 }),
      );
    });

    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0]?.[0]).toMatch(/^#[0-9a-f]{8}$/i);
  });

  it('moves the alpha with the arrow keys', async () => {
    const onChange = vi.fn();
    const { find } = await render(<HexAlphaColorPicker color="ff000080" onChange={onChange} />);

    act(() => {
      find('.color-picker-cn__alpha .color-picker-cn__interactive').dispatchEvent(
        keyboardEvent(39),
      );
    });

    expect(onChange).toHaveBeenCalled();
  });
});

describe('HexColorPicker', () => {
  it('reports the hexadecimal colour it drew after a drag', async () => {
    const onChange = vi.fn();
    const { find } = await render(<HexColorPicker color="ff0000" onChange={onChange} />);

    act(() => {
      find('.color-picker-cn__saturation .color-picker-cn__interactive').dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }),
      );
    });

    expect(onChange.mock.calls[0]?.[0]).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('ColorInput', () => {
  it('restores the prop colour when an invalid value is blurred', async () => {
    const onBlur = vi.fn();
    const { find } = await render(
      <ColorInput
        color="#ff0000"
        escape={(value: string) => value}
        validate={(value: string) => /^#[0-9a-f]{6}$/i.test(value)}
        onBlur={onBlur}
      />,
    );

    const field = find<HTMLInputElement>('input');

    await type(field, '#ff0000z');
    act(() => {
      field.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });

    expect(field.value).toBe('#ff0000');
    expect(onBlur).toHaveBeenCalled();
  });

  it('keeps a valid value on blur', async () => {
    const onBlur = vi.fn();
    const { find } = await render(
      <ColorInput
        color="#ff0000"
        escape={(value: string) => value}
        validate={(value: string) => /^#[0-9a-f]{6}$/i.test(value)}
        onBlur={onBlur}
      />,
    );

    const field = find<HTMLInputElement>('input');

    await type(field, '#00ff00');
    act(() => {
      field.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });

    expect(field.value).toBe('#00ff00');
    expect(onBlur).toHaveBeenCalled();
  });

  it('formats the value for display and processes it on change', async () => {
    const onChange = vi.fn();
    const { find } = await render(
      <ColorInput
        color="#ff0000"
        escape={(value: string) => value}
        validate={(value: string) => /^#[0-9a-f]{6}$/i.test(value)}
        format={(value: string) => value.toUpperCase()}
        process={(value: string) => value.toLowerCase()}
        onChange={onChange}
      />,
    );

    const field = find<HTMLInputElement>('input');

    expect(field.value).toBe('#FF0000');

    await type(field, '#00FF00');

    expect(onChange).toHaveBeenCalledWith('#00ff00');
  });
});

describe('useColorManipulation', () => {
  it('adopts a colour changed from the outside without reporting it back', async () => {
    const onChange = vi.fn();
    const { update } = await render(<HexColorPicker color="ff0000" onChange={onChange} />);

    await update(<HexColorPicker color="00ff00" onChange={onChange} />);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not report a colour the model maps back to the cached one', async () => {
    const frozenModel: ColorModel<string> = {
      defaultColor: 'frozen',
      toHsva: () => ({ h: 0, s: 100, v: 100, a: 1 }),
      fromHsva: () => 'frozen',
      equal: (first, second) => first === second,
    };
    const onChange = vi.fn();
    const { find } = await render(
      <ColorPicker colorModel={frozenModel} color="frozen" onChange={onChange} />,
    );

    act(() => {
      find('.color-picker-cn__saturation .color-picker-cn__interactive').dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, clientX: 800, clientY: 200 }),
      );
    });

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('color picker controls', () => {
  it('follows a pointer drag across the document', async () => {
    const onChange = vi.fn();
    const { find } = await render(<HexColorPicker color="ff0000" onChange={onChange} />);

    act(() => {
      find('.color-picker-cn__saturation .color-picker-cn__interactive').dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }),
      );
    });
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', { bubbles: true, buttons: 1, clientX: 400, clientY: 300 }),
      );
    });
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', { bubbles: true, buttons: 0, clientX: 5, clientY: 5 }),
      );
    });
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalled();
  });

  it('reports a hue from a drag on the hue bar', async () => {
    const onChange = vi.fn();
    const { find } = await render(<HexColorPicker color="ff0000" onChange={onChange} />);

    act(() => {
      find('.color-picker-cn__hue .color-picker-cn__interactive').dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, clientX: 300, clientY: 100 }),
      );
    });

    expect(onChange).toHaveBeenCalled();
  });

  it('moves the saturation and hue with the arrow keys, ignoring other keys', async () => {
    const onChange = vi.fn();
    const { find } = await render(<HexColorPicker color="ff0000" onChange={onChange} />);

    act(() => {
      find('.color-picker-cn__saturation .color-picker-cn__interactive').dispatchEvent(
        keyboardEvent(37),
      );
    });
    act(() => {
      find('.color-picker-cn__hue .color-picker-cn__interactive').dispatchEvent(keyboardEvent(39));
    });
    act(() => {
      find('.color-picker-cn__saturation .color-picker-cn__interactive').dispatchEvent(
        keyboardEvent(36),
      );
    });

    expect(onChange).toHaveBeenCalled();
  });

  it('follows a touch drag across the document', async () => {
    const onChange = vi.fn();
    const { find } = await render(<HexAlphaColorPicker color="ff000080" onChange={onChange} />);

    const saturation = find('.color-picker-cn__saturation .color-picker-cn__interactive');
    const touch = new StubTouch({ identifier: 1, target: saturation, pageX: 300, pageY: 200 });

    act(() => {
      saturation.dispatchEvent(
        new TouchEvent('touchstart', {
          bubbles: true,
          cancelable: true,
          touches: [touch],
          changedTouches: [touch],
        }),
      );
    });
    act(() => {
      window.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: [touch] }));
    });
    act(() => {
      window.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [touch] }));
    });

    expect(onChange).toHaveBeenCalled();
  });

  it('ignores a mouse event once a touch has started', async () => {
    const onChange = vi.fn();
    const { find } = await render(<HexAlphaColorPicker color="ff000080" onChange={onChange} />);

    const saturation = find('.color-picker-cn__saturation .color-picker-cn__interactive');
    const touch = new StubTouch({ identifier: 1, target: saturation, pageX: 300, pageY: 200 });

    act(() => {
      saturation.dispatchEvent(
        new TouchEvent('touchstart', {
          bubbles: true,
          cancelable: true,
          touches: [touch],
          changedTouches: [touch],
        }),
      );
    });

    const before = onChange.mock.calls.length;

    act(() => {
      saturation.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, clientX: 500, clientY: 500 }),
      );
    });

    expect(onChange.mock.calls.length).toBe(before);
  });

  it('does not follow a drag once the control is unmounted', async () => {
    const onChange = vi.fn();
    const { find, unmount } = await render(<HexColorPicker color="ff0000" onChange={onChange} />);

    const saturation = find('.color-picker-cn__saturation .color-picker-cn__interactive');

    unmount();

    expect(() => {
      saturation.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }),
      );
    }).not.toThrow();

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('HslaStringColorPickerPopover', () => {
  it('reports the colour once the change has settled', async () => {
    const onChange = vi.fn();
    const { findByText, find } = await render(
      <HslaStringColorPickerPopover
        trigger={<button type="button">Pick</button>}
        color="hsla(0, 100%, 50%, 1)"
        onChange={onChange}
      />,
    );

    await click(findByText('Pick'));

    act(() => {
      find('.color-picker-cn__saturation .color-picker-cn__interactive').dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }),
      );
    });

    await waitFor(() => onChange.mock.calls.length > 0);

    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
