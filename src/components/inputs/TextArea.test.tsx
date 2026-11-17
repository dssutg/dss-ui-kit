// SPDX-License-Identifier: MIT
/**
 * The multiline field's contract follows the library's controlled-component rule: it renders the
 * value it was handed and reports the text it would move to, for both the text and the DOM event.
 */
// @vitest-environment jsdom

import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TextArea } from '@/components/inputs/TextArea';
import { act, render, type } from '@/util/testing/render';

describe('TextArea', () => {
  it('renders the value it was handed and reports the text typed into it', async () => {
    const onChange = vi.fn();
    const onChangeText = vi.fn();
    const { find } = await render(
      <TextArea value="draft" onChange={onChange} onChangeText={onChangeText} />,
    );

    const field = find<HTMLTextAreaElement>('textarea');

    expect(field.value).toBe('draft');

    await type(field, 'draft note');

    expect(onChangeText).toHaveBeenCalledWith('draft note');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('reports the text alone when no change handler was given', async () => {
    // `onChangeText` is the report a caller normally wants; the DOM event is the one it can add.
    const onChangeText = vi.fn();
    const { find } = await render(<TextArea value="" onChangeText={onChangeText} />);

    await type(find<HTMLTextAreaElement>('textarea'), 'hello');

    expect(onChangeText).toHaveBeenCalledWith('hello');
  });

  it('is a plain field with the styling and geometry the caller names', async () => {
    const { find } = await render(<TextArea rows={6} />);

    const field = find<HTMLTextAreaElement>('textarea');

    expect(field.rows).toBe(6);
    expect(field.className).toContain('resize-y');
    expect(field.style.color).toBe('var(--color-tpl)');
  });

  it('takes the resize directions the browser spells', async () => {
    const { find, update } = await render(<TextArea resize="none" />);

    expect(find<HTMLTextAreaElement>('textarea').className).toContain('resize-none');

    await update(<TextArea resize="both" />);

    expect(find<HTMLTextAreaElement>('textarea').className).toContain('resize');
  });

  it('disables the real field when told to', async () => {
    const { find } = await render(<TextArea value="draft" disabled={true} />);

    const field = find<HTMLTextAreaElement>('textarea');

    expect(field.disabled).toBe(true);
    expect(field.className).toContain('pointer-events-none');
  });

  it('names its placeholder through the custom property the class reads', async () => {
    // The placeholder colour is a `--name` the stylesheet resolves at runtime, so the class and the
    // inline style have to arrive together.
    const { find } = await render(<TextArea placeholder="Notes" textColor="var(--color-tpd)" />);

    const field = find<HTMLTextAreaElement>('textarea');

    expect(field.getAttribute('placeholder')).toBe('Notes');
    expect(field.style.color).toBe('var(--color-tpd)');
    expect(field.style.getPropertyValue('--placeholder-color')).toBe('var(--color-placeholder)');
  });

  it('forwards data-* attributes onto the field', async () => {
    const { find } = await render(
      <TextArea data-testid="notes" data-purpose="form" spellCheck={true} />,
    );

    const field = find<HTMLTextAreaElement>('textarea');

    expect(field.getAttribute('data-testid')).toBe('notes');
    expect(field.getAttribute('data-purpose')).toBe('form');
    expect(field.getAttribute('spellcheck')).toBe('true');
  });

  it('hands the field element to the ref the caller passed', async () => {
    const textAreaRef = createRef<HTMLTextAreaElement>();
    const { find } = await render(<TextArea textAreaRef={textAreaRef} />);

    expect(textAreaRef.current).toBe(find<HTMLTextAreaElement>('textarea'));
  });

  it('reports focus, blur and keys to the handlers it was given', async () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    const onKeyDown = vi.fn();
    const onKeyUp = vi.fn();
    const { find } = await render(
      <TextArea onFocus={onFocus} onBlur={onBlur} onKeyDown={onKeyDown} onKeyUp={onKeyUp} />,
    );

    const field = find<HTMLTextAreaElement>('textarea');

    act(() => {
      // The focus pair is delegated by the compat layer as focusin and focusout, so those are the
      // events a real focus change produces and the ones the handlers hear.
      field.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      field.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      field.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true }));
    });

    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onKeyUp).toHaveBeenCalledTimes(1);
  });
});
