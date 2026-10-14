// SPDX-License-Identifier: MIT
// The editable accordion list's rename, remove and order.
// @vitest-environment jsdom

import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  EditableAccordionList,
  type EditableAccordionListItem,
} from '@/components/navigation/EditableAccordionList';
import { act, click, render, type } from '@/util/testing/render';

const editingItems: EditableAccordionListItem[] = [
  { key: 'k1', name: 'First', editing: true, expanded: false },
  { key: 'k2', name: 'Second', editing: true, expanded: false },
];

/**
 * The list as a caller holds it, so a test can drive a rename to completion: an edit that ends is
 * only visible after the new list is rendered back, which a fixed `onChange` spy cannot do.
 */
function ListHarness({
  initialItems,
  isItemNameValid = () => true,
  getFilteredItemName,
  getItemContent = () => <p>Content</p>,
  onChange,
}: {
  readonly initialItems: EditableAccordionListItem[];
  readonly isItemNameValid?: ((name: string) => boolean) | undefined;
  readonly getFilteredItemName?: ((name: string) => string) | undefined;
  readonly getItemContent?: ((item: EditableAccordionListItem) => React.ReactNode) | undefined;
  readonly onChange?: ((items: EditableAccordionListItem[]) => void) | undefined;
}) {
  const [items, setItems] = useState(initialItems);

  return (
    <EditableAccordionList
      items={items}
      onChange={(next) => {
        onChange?.(next);
        setItems(next);
      }}
      isItemNameValid={isItemNameValid}
      errors={[]}
      getItemContent={getItemContent}
      appendItemTitle="Add"
      // The component's prop is optional without `undefined`, so it is set only when there is one
      // rather than handed the harness's `undefined`.
      {...(getFilteredItemName === undefined ? {} : { getFilteredItemName })}
    />
  );
}

describe('EditableAccordionList', () => {
  it('renders an input for a row being edited and an accordion for one that is not', async () => {
    const { findAll, container } = await render(
      <EditableAccordionList
        items={[
          { key: 'k1', name: 'Editing', editing: true, expanded: false },
          { key: 'k2', name: 'Static', editing: false, expanded: false },
        ]}
        onChange={() => undefined}
        isItemNameValid={() => true}
        errors={[]}
        getItemContent={() => <p>Content</p>}
        appendItemTitle="Add"
      />,
    );

    expect(findAll<HTMLInputElement>('input')).toHaveLength(1);
    expect(container.querySelector('button[aria-expanded]')).not.toBeNull();
  });

  it('reports a filtered edit rather than keeping it', async () => {
    const onChange = vi.fn();
    const { find } = await render(
      <EditableAccordionList
        items={editingItems}
        onChange={onChange}
        isItemNameValid={() => true}
        errors={[]}
        getItemContent={() => <p>Content</p>}
        appendItemTitle="Add"
        getFilteredItemName={(name) => name.toUpperCase()}
      />,
    );

    await type(find<HTMLInputElement>('input'), 'abc');

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ key: 'k1', name: 'ABC' }),
      expect.objectContaining({ key: 'k2' }),
    ]);
  });

  it('reports the value as typed when no filter is given', async () => {
    const onChange = vi.fn();
    const { find } = await render(
      <EditableAccordionList
        items={editingItems}
        onChange={onChange}
        isItemNameValid={() => true}
        errors={[]}
        getItemContent={() => <p>Content</p>}
        appendItemTitle="Add"
      />,
    );

    await type(find<HTMLInputElement>('input'), 'plain');

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ key: 'k1', name: 'plain' }),
      expect.objectContaining({ key: 'k2' }),
    ]);
  });

  it('ends the edit on Enter when the name is valid', async () => {
    const { find, findByText, query } = await render(
      <ListHarness initialItems={[{ key: 'k1', name: 'Old', editing: true, expanded: false }]} />,
    );

    await type(find<HTMLInputElement>('input'), 'New name');

    act(() => {
      find<HTMLInputElement>('input').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
    });

    expect(query('input')).toBeNull();
    expect(findByText('New name')).toBeDefined();
  });

  it('stays editing when the caller rejects the name', async () => {
    const { find, query } = await render(
      <ListHarness
        initialItems={[{ key: 'k1', name: 'Old', editing: true, expanded: false }]}
        isItemNameValid={() => false}
      />,
    );

    await type(find<HTMLInputElement>('input'), 'Rejected');

    act(() => {
      find<HTMLInputElement>('input').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
    });

    expect(query('input')).not.toBeNull();
  });

  it('refuses a name another row already holds', async () => {
    const { find, query } = await render(
      <ListHarness
        initialItems={[
          { key: 'k1', name: 'Same', editing: true, expanded: false },
          { key: 'k2', name: 'Same', editing: false, expanded: false },
        ]}
      />,
    );

    act(() => {
      find<HTMLInputElement>('input').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
    });

    expect(query('input')).not.toBeNull();
  });

  it('ignores a key that is not Enter', async () => {
    const onChange = vi.fn();
    const { find } = await render(
      <EditableAccordionList
        items={editingItems}
        onChange={onChange}
        isItemNameValid={() => true}
        errors={[]}
        getItemContent={() => <p>Content</p>}
        appendItemTitle="Add"
      />,
    );

    find<HTMLInputElement>('input').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'a', bubbles: true }),
    );

    expect(onChange).not.toHaveBeenCalled();
  });

  it('ends the edit when the input loses focus with a valid name', async () => {
    const { find, query } = await render(
      <ListHarness initialItems={[{ key: 'k1', name: 'Old', editing: true, expanded: false }]} />,
    );

    const input = find<HTMLInputElement>('input');

    await type(input, 'Blurred name');
    act(() => {
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });

    expect(query('input')).toBeNull();
  });

  it('starts editing a row that was not being edited', async () => {
    const onChange = vi.fn();
    const { findAll } = await render(
      <EditableAccordionList
        items={[{ key: 'k1', name: 'Static', editing: false, expanded: false }]}
        onChange={onChange}
        isItemNameValid={() => true}
        errors={[]}
        getItemContent={() => <p>Content</p>}
        appendItemTitle="Add"
      />,
    );

    const modifyButton = findAll<HTMLButtonElement>('button').find(
      (button) => button.getAttribute('title') === 'Modify title',
    );

    if (modifyButton === undefined) {
      throw new Error('the modify control was not rendered.');
    }

    await click(modifyButton);

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ key: 'k1', editing: true })]);
  });

  it('reports a row removed, without removing it itself', async () => {
    const onChange = vi.fn();
    const { findAll } = await render(
      <EditableAccordionList
        items={editingItems}
        onChange={onChange}
        isItemNameValid={() => true}
        errors={[]}
        getItemContent={() => <p>Content</p>}
        appendItemTitle="Add"
      />,
    );

    const removeButton = findAll<HTMLButtonElement>('button').find(
      (button) => button.getAttribute('title') === 'Remove record',
    );

    if (removeButton === undefined) {
      throw new Error('the remove control was not rendered.');
    }

    await click(removeButton);

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ key: 'k2' })]);
  });

  it('reveals the row content when its accordion is expanded', async () => {
    const { container, findByText } = await render(
      <ListHarness
        initialItems={[{ key: 'k1', name: 'Static', editing: false, expanded: false }]}
        getItemContent={() => <p>Row body</p>}
      />,
    );

    const trigger = container.querySelector('button[aria-expanded]');

    if (trigger === null) {
      throw new Error('the accordion trigger was not rendered.');
    }

    await click(trigger);

    expect(findByText('Row body')).toBeDefined();
  });

  it('lists the errors it is given', async () => {
    const { findByText } = await render(
      <EditableAccordionList
        items={[]}
        onChange={() => undefined}
        isItemNameValid={() => true}
        errors={['First problem', 'Second problem']}
        getItemContent={() => <p>Content</p>}
        appendItemTitle="Add"
      />,
    );

    expect(findByText('First problem')).toBeDefined();
    expect(findByText('Second problem')).toBeDefined();
  });

  it('reports a new row appended, carrying a fresh key', async () => {
    const onChange = vi.fn();
    const { findByText } = await render(
      <EditableAccordionList
        items={editingItems}
        onChange={onChange}
        isItemNameValid={() => true}
        errors={[]}
        getItemContent={() => <p>Content</p>}
        appendItemTitle="Add"
      />,
    );

    const addButton = findByText('Add').closest('button');

    if (addButton === null) {
      throw new Error('the add control was not rendered.');
    }

    await click(addButton);

    expect(onChange).toHaveBeenCalledTimes(1);

    const nextItems = onChange.mock.calls[0]?.[0];

    expect(nextItems).toHaveLength(3);
    expect(nextItems[2]).toMatchObject({ name: '', editing: true, expanded: false });
  });

  it('shows the empty message rather than an empty box when there is nothing to list', async () => {
    const { findByText } = await render(
      <EditableAccordionList
        items={[]}
        onChange={() => undefined}
        isItemNameValid={() => true}
        errors={[]}
        getItemContent={() => <p>Content</p>}
        appendItemTitle="Add"
      />,
    );

    expect(findByText('Empty List')).toBeDefined();
  });
});
