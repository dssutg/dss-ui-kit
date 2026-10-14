// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrderPanel } from '@/components/navigation/OrderPanel';
import { act, click, render } from '@/util/testing/render';

function dispatchDrag(target: Element, type: string): void {
  act(() => {
    target.dispatchEvent(new Event(type, { bubbles: true }));
  });
}

/** The first button whose tooltip is `title`, or a failure naming the control. */
function requireButtonByTitle(title: string): HTMLButtonElement {
  const button = [...document.body.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.getAttribute('title') === title,
  );

  if (button === undefined) {
    throw new Error(`the "${title}" control was not rendered.`);
  }

  return button;
}

/** The button wrapping an element with this text, or a failure naming the control. */
function requireButtonByText(text: string): HTMLButtonElement {
  const element = [...document.body.querySelectorAll<HTMLElement>('*')].find(
    (candidate) => candidate.textContent?.trim() === text,
  );

  const button = element?.closest('button');

  if (button === undefined || button === null) {
    throw new Error(`the "${text}" control was not rendered.`);
  }

  return button;
}

/** The row at `index`, or a failure, which keeps the drag helpers free of a possibly-absent read. */
function requireRow(rows: NodeListOf<HTMLLIElement>, index: number): HTMLLIElement {
  const row = rows[index];

  if (row === undefined) {
    throw new Error(`no row was rendered at index ${index}.`);
  }

  return row;
}

describe('OrderPanel', () => {
  afterEach(() => {
    window.innerWidth = 1024;
  });

  it('reports the order the caller asked for and holds none of its own', async () => {
    const onChange = vi.fn();
    const { container } = await render(
      <OrderPanel title="Order" items={[1, 2, 3]} onChange={onChange} />,
    );

    expect(container.querySelectorAll('li')).toHaveLength(3);

    await click(requireButtonByTitle('Move up'));

    // Moving the first item up wraps it to the end.
    expect(onChange).toHaveBeenCalledWith([2, 3, 1]);
  });

  it('moves an item down when the down control is used', async () => {
    const onChange = vi.fn();
    await render(<OrderPanel items={[1, 2, 3]} onChange={onChange} />);

    await click(requireButtonByTitle('Move down'));

    expect(onChange).toHaveBeenCalledWith([2, 1, 3]);
  });

  it('renders items through the formatter when one is given', async () => {
    const { findByText } = await render(
      <OrderPanel
        items={[1, 2]}
        itemIndexFormatter={(item, index) => `${index}:${item}`}
        onChange={() => undefined}
      />,
    );

    expect(findByText('0:1')).toBeDefined();
    expect(findByText('1:2')).toBeDefined();
  });

  it('renders the item itself when no formatter is given', async () => {
    const { findByText } = await render(<OrderPanel items={[7]} onChange={() => undefined} />);

    expect(findByText('7')).toBeDefined();
  });

  it('reports a visibility toggle and shows the hidden state in the label colour', async () => {
    const onVisibilityChange = vi.fn();
    const { container } = await render(
      <OrderPanel
        items={[0, 1]}
        visibilityMap={[false, true]}
        onVisibilityChange={onVisibilityChange}
        onChange={() => undefined}
      />,
    );

    const labels = container.querySelectorAll('p');

    expect(labels[0]?.className).toContain('text-tpd');
    expect(labels[1]?.className).toContain('text-tpl');

    await click(requireButtonByTitle('Show'));

    expect(onVisibilityChange).toHaveBeenCalledWith([true, true]);
  });

  it('reports a visible item toggled back off', async () => {
    const onVisibilityChange = vi.fn();
    await render(
      <OrderPanel
        items={[0, 1]}
        visibilityMap={[true, true]}
        onVisibilityChange={onVisibilityChange}
        onChange={() => undefined}
      />,
    );

    await click(requireButtonByTitle('Hide'));

    expect(onVisibilityChange).toHaveBeenCalledWith([false, true]);
  });

  it('moves the visible items to the top in one action', async () => {
    const onChange = vi.fn();
    await render(
      <OrderPanel
        items={[0, 1, 2]}
        visibilityMap={[true, false, true]}
        onVisibilityChange={() => undefined}
        onChange={onChange}
      />,
    );

    await click(requireButtonByTitle('Move visible items to the top'));

    expect(onChange).toHaveBeenCalledWith([0, 2, 1]);
  });

  it('hides and shows every item from the footer buttons', async () => {
    const onVisibilityChange = vi.fn();
    await render(
      <OrderPanel
        items={[1, 2]}
        visibilityMap={[true, false]}
        onVisibilityChange={onVisibilityChange}
        onChange={() => undefined}
      />,
    );

    await click(requireButtonByText('Hide all'));

    expect(onVisibilityChange).toHaveBeenCalledWith([false, false]);

    await click(requireButtonByText('Show all'));

    expect(onVisibilityChange).toHaveBeenLastCalledWith([true, true]);
  });

  it('reports a reset to the default order', async () => {
    const onResetDefaultOrder = vi.fn();
    await render(
      <OrderPanel
        items={[1, 2]}
        onChange={() => undefined}
        onResetDefaultOrder={onResetDefaultOrder}
      />,
    );

    await click(requireButtonByTitle('Reset to default order'));

    expect(onResetDefaultOrder).toHaveBeenCalledTimes(1);
  });

  it('reports a row removed with its index', async () => {
    const onRemoveItem = vi.fn();
    await render(
      <OrderPanel items={[1, 2]} onChange={() => undefined} onRemoveItem={onRemoveItem} />,
    );

    await click(requireButtonByTitle('Remove'));

    expect(onRemoveItem).toHaveBeenCalledWith(1, 0);
  });

  it('leaves out the order controls when told to', async () => {
    const { container } = await render(
      <OrderPanel items={[1, 2]} noOrderControls={true} onChange={() => undefined} />,
    );

    expect(
      [...document.body.querySelectorAll('button')].some(
        (button) => button.getAttribute('title') === 'Move up',
      ),
    ).toBe(false);

    const firstRow = container.querySelector('li');

    expect(firstRow?.getAttribute('draggable')).toBeNull();
    expect(firstRow?.className).not.toContain('cursor-move');
  });

  it('reorders on a drag and drop', async () => {
    const onChange = vi.fn();
    const { container } = await render(<OrderPanel items={[1, 2, 3]} onChange={onChange} />);

    const rows = container.querySelectorAll('li');

    dispatchDrag(requireRow(rows, 0), 'dragstart');
    dispatchDrag(requireRow(rows, 2), 'dragover');
    dispatchDrag(requireRow(rows, 2), 'drop');

    expect(onChange).toHaveBeenCalledWith([2, 3, 1]);
  });

  it('marks the row a drag would land after', async () => {
    const { container } = await render(<OrderPanel items={[1, 2, 3]} onChange={() => undefined} />);

    const rows = container.querySelectorAll('li');

    dispatchDrag(requireRow(rows, 0), 'dragstart');
    dispatchDrag(requireRow(rows, 2), 'dragover');

    expect(requireRow(container.querySelectorAll('li'), 2).className).toContain('border-b-bsp');
  });

  it('marks the row a drag would land before', async () => {
    const { container } = await render(<OrderPanel items={[1, 2, 3]} onChange={() => undefined} />);

    const rows = container.querySelectorAll('li');

    dispatchDrag(requireRow(rows, 2), 'dragstart');
    dispatchDrag(requireRow(rows, 0), 'dragover');

    expect(requireRow(container.querySelectorAll('li'), 0).className).toContain('border-t-bsp');
  });

  it('commits an unchanged order when a drop arrives before any hover', async () => {
    const onChange = vi.fn();
    const { container } = await render(<OrderPanel items={[1, 2]} onChange={onChange} />);

    const rows = container.querySelectorAll('li');

    dispatchDrag(requireRow(rows, 0), 'dragstart');
    dispatchDrag(requireRow(rows, 0), 'drop');

    expect(onChange).toHaveBeenCalledWith([1, 2]);
  });

  it('ignores a drag over when nothing is being dragged', async () => {
    const onChange = vi.fn();
    const { container } = await render(<OrderPanel items={[1, 2]} onChange={onChange} />);

    const rows = container.querySelectorAll('li');

    dispatchDrag(requireRow(rows, 1), 'dragover');
    dispatchDrag(requireRow(rows, 1), 'drop');

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('runs its footer buttons full width on a narrow screen', async () => {
    window.innerWidth = 500;

    await render(
      <OrderPanel
        items={[1]}
        visibilityMap={[true]}
        onVisibilityChange={() => undefined}
        onChange={() => undefined}
      />,
    );

    expect(requireButtonByText('Hide all').getAttribute('style')).toContain('width: 100%');
    expect(requireButtonByText('Show all').getAttribute('style')).toContain('width: 100%');
  });
});
