/**
 * `useDragNDropOrderedList` reorders a list by dragging: nothing is reordered while the drag is in
 * progress, a preview is computed on each hover, and only the drop commits it through `onChange`. A
 * row's place is read back out of the DOM, from its `data-position`. The suite drives real drag
 * events through rendered rows and holds the states the caller builds classes on: which row is the
 * drop target, and whether that row sits before the one the drag started at. A row whose position
 * has slid past the end of the list — the stale row the document can still hold after items were
 * removed — cannot move anything.
 */
// @vitest-environment jsdom

import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { render } from '@/util/testing/render';
import { useDragNDropOrderedList } from './';

/**
 * A `DragEvent`-shaped event: jsdom implements no `DragEvent`, and the start of a drag reads
 * `dataTransfer` off it. An event without a transfer stands in for the browser's own optional
 * access.
 */
class StubDragEvent extends MouseEvent {
  readonly dataTransfer: DataTransfer | null;

  constructor(type: string, init: DragEventInit = {}) {
    super(type, init);
    this.dataTransfer = init.dataTransfer ?? null;
  }
}

/** The data the hook puts on the transfer at the start of a drag, recorded for the assertion. */
const setDataSpy = vi.fn<(type: string, data: string) => void>();

function dataTransferSpy(): DataTransfer {
  return {
    setData: (type: string, data: string) => {
      setDataSpy(type, data);
    },
  } as unknown as DataTransfer;
}

/**
 * A probe rendering the list as rows, one extra row carrying a position past the end of the items —
 * `getListItemProps` is what a caller spreads on its rows, and the stale row is spread with an
 * out-of-range index. The rows carry the three states the caller classifies on, and a summary line
 * with the drag in progress and the row it started from.
 */
function ListProbe({
  items,
  onChange,
}: {
  readonly items: string[];
  readonly onChange?: (updatedItems: string[]) => void;
}) {
  const list = useDragNDropOrderedList(items, onChange);

  return (
    <ul data-testid="list">
      {items.map((item, index) => (
        <li
          key={item}
          data-after={String(list.isAfterStart(index))}
          data-before={String(list.isBeforeStart(index))}
          data-drag-target={String(list.isDragTarget(index))}
          {...list.getListItemProps(index)}
        >
          {item}
        </li>
      ))}
      <li data-testid="stale-row" {...list.getListItemProps(items.length + 2)}>
        stale row
      </li>
      <li data-testid="status">
        {`dragging:${list.isDragging} from:${
          list.draggedFrom === null ? 'none' : String(list.draggedFrom)
        }`}
      </li>
    </ul>
  );
}

/** Dispatches a drag lifecycle event on a row, inside an act, so the state lands before assertions. */
function sendDragEvent(
  row: HTMLElement,
  type: 'dragstart' | 'dragover' | 'dragleave' | 'drop',
  dataTransfer?: DataTransfer,
): StubDragEvent {
  const event =
    dataTransfer === undefined
      ? new StubDragEvent(type, { bubbles: true, cancelable: true })
      : new StubDragEvent(type, { bubbles: true, cancelable: true, dataTransfer });

  act(() => {
    row.dispatchEvent(event);
  });

  return event;
}

describe('useDragNDropOrderedList', () => {
  afterEach(() => {
    setDataSpy.mockClear();
  });

  test('commits a reordered list on the drop, and nothing before it', async () => {
    const onChange = vi.fn<(updatedItems: string[]) => void>();

    const view = await render(<ListProbe items={['a', 'b', 'c']} onChange={onChange} />);

    const row = (position: number) => view.find(`li[data-position="${position}"]`);
    const transfer = dataTransferSpy();

    sendDragEvent(row(0), 'dragstart', transfer);

    expect(view.find('[data-testid="status"]').textContent).toBe('dragging:true from:0');
    expect(setDataSpy).toHaveBeenCalledWith('text/html', '');

    const over = sendDragEvent(row(2), 'dragover');

    // 'a' is being dragged onto 'c': the target is the hovered row, and it sits after where the drag
    // began.
    expect(over.defaultPrevented).toBe(true);
    expect(row(2).getAttribute('data-drag-target')).toBe('true');
    expect(row(2).getAttribute('data-after')).toBe('true');
    expect(row(0).getAttribute('data-drag-target')).toBe('false');

    expect(onChange).not.toHaveBeenCalled();

    sendDragEvent(row(2), 'drop');

    expect(onChange).toHaveBeenCalledWith(['b', 'c', 'a']);
    expect(view.find('[data-testid="status"]').textContent).toBe('dragging:false from:none');
  });

  test('marks the drop target as sitting before the row the drag started at', async () => {
    const view = await render(<ListProbe items={['a', 'b', 'c']} />);

    const row = (position: number) => view.find(`li[data-position="${position}"]`);

    sendDragEvent(row(1), 'dragstart');
    sendDragEvent(row(0), 'dragover');

    // Dragging 'b' up onto 'a': the target row sits before where the drag began, which is how a
    // caller knows the item below the hovered row has to shift down.
    expect(row(0).getAttribute('data-drag-target')).toBe('true');
    expect(row(0).getAttribute('data-before')).toBe('true');
    expect(row(0).getAttribute('data-after')).toBe('false');
  });

  test('clears the drop target when the drag leaves the row, and keeps the preview', async () => {
    const onChange = vi.fn<(updatedItems: string[]) => void>();

    const view = await render(<ListProbe items={['a', 'b', 'c']} onChange={onChange} />);

    const row = (position: number) => view.find(`li[data-position="${position}"]`);

    sendDragEvent(row(2), 'dragstart');
    sendDragEvent(row(0), 'dragover');

    expect(row(0).getAttribute('data-drag-target')).toBe('true');

    sendDragEvent(row(0), 'dragleave');

    expect(row(0).getAttribute('data-drag-target')).toBe('false');
    expect(view.find('[data-testid="status"]').textContent).toBe('dragging:true from:2');

    // The leaving row's position is the place: dragging 'c' up to the top and dropping there
    // commits the preview the hovers built.
    sendDragEvent(row(0), 'drop');

    expect(onChange).toHaveBeenCalledWith(['c', 'a', 'b']);
  });

  test('claims a hover while nothing is being dragged, but sets no target', async () => {
    const view = await render(<ListProbe items={['a', 'b', 'c']} />);

    const row = (position: number) => view.find(`li[data-position="${position}"]`);

    const over = sendDragEvent(row(1), 'dragover');

    // Nothing is being dragged, so there is no item to move and no target to report, even though
    // the hover is claimed to keep the drop working.
    expect(over.defaultPrevented).toBe(true);
    expect(row(1).getAttribute('data-drag-target')).toBe('false');
    expect(view.find('[data-testid="status"]').textContent).toBe('dragging:false from:none');
  });

  test('does not reorder for a row whose position is past the end of the list', async () => {
    const onChange = vi.fn<(updatedItems: string[]) => void>();

    const view = await render(<ListProbe items={['a', 'b', 'c']} onChange={onChange} />);

    const staleRow = view.find('[data-testid="stale-row"]');
    const transfer = dataTransferSpy();

    sendDragEvent(staleRow, 'dragstart', transfer);
    sendDragEvent(staleRow, 'dragover');
    sendDragEvent(staleRow, 'drop');

    // A stale row has no item to move, so the drop commits the list unchanged.
    expect(onChange).toHaveBeenCalledWith(['a', 'b', 'c']);
    expect(view.find('[data-testid="status"]').textContent).toBe('dragging:false from:none');
  });

  test('keeps the drop target over repeated hovers, and drops with no onChange callback', async () => {
    const view = await render(<ListProbe items={['a', 'b', 'c']} />);

    const row = (position: number) => view.find(`li[data-position="${position}"]`);

    sendDragEvent(row(0), 'dragstart', dataTransferSpy());
    sendDragEvent(row(1), 'dragover');
    sendDragEvent(row(1), 'dragover');
    sendDragEvent(row(1), 'drop');

    expect(view.find('[data-testid="status"]').textContent).toBe('dragging:false from:none');
  });

  test('renders the props a draggable row needs', async () => {
    const view = await render(<ListProbe items={['a', 'b', 'c']} />);

    const row = view.find('li[data-position="0"]');

    expect(row.getAttribute('draggable')).toBe('true');
    expect(row.getAttribute('data-position')).toBe('0');
  });
});
