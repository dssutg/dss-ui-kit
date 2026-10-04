import { type TargetedEvent, useState } from 'react';

interface State<ListItemDataType> {
  draggedFrom: number | null;
  draggedTo: number | null;
  isDragging: boolean;
  updatedOrder: ListItemDataType[];
}

/** The props to spread on one list item so the hook can follow it while it is dragged. */
export interface DraggableListItemProps {
  readonly 'data-position': number;
  readonly draggable: boolean;
  onDragStart: (event: TargetedEvent<HTMLElement, DragEvent>) => void;
  onDragOver: (event: TargetedEvent<HTMLElement, DragEvent>) => void;
  onDragLeave: () => void;
  onDrop: () => void;
}

/** What {@link useDragNDropOrderedList} reports while a drag is in progress. */
export interface DragNDropOrderedList {
  readonly getListItemProps: (listItemIndex: number) => DraggableListItemProps;
  onDragStart: (event: TargetedEvent<HTMLElement, DragEvent>) => void;
  onDragOver: (event: TargetedEvent<HTMLElement, DragEvent>) => void;
  onDragLeave: () => void;
  onDrop: () => void;
  readonly isDragging: boolean;
  readonly draggedFrom: number | null;
  readonly isDragTarget: (itemIndex: number) => boolean;
  readonly isBeforeStart: (itemIndex: number) => boolean;
  readonly isAfterStart: (itemIndex: number) => boolean;
}

/**
 * The index a list item was rendered at, read off its `data-position`.
 *
 * `dataset` is an index signature, and the two rules that govern it disagree:
 * `noPropertyAccessFromIndexSignature` wants bracket access, `useLiteralKeys` wants a dot for a key
 * the type knows. The claim here is provable because `getListItemProps` writes the attribute itself.
 */
function getItemPosition(element: HTMLElement): number {
  return Number((element.dataset as { position: string }).position);
}

/**
 * Reorders a list by dragging, holding the in-progress order until the drop.
 *
 * The list is the caller's and is reported whole, in the new order, from `onChange`. Nothing is
 * reordered while the drag is in progress: the hook reports a preview order it keeps to itself, and
 * only the drop commits it, because a list that reflows under the pointer is impossible to drop
 * accurately.
 *
 * Each row must be rendered with the props `getListItemProps` returns and be marked `draggable`; the
 * hook finds a row by reading its position back out of the DOM rather than by tracking rows in React
 * state.
 */
export function useDragNDropOrderedList<ListItemDataType>(
  items: ListItemDataType[],
  onChange?: (updatedItems: ListItemDataType[]) => void,
): DragNDropOrderedList {
  const [dragAndDrop, setDragAndDrop] = useState<State<ListItemDataType>>({
    draggedFrom: null,
    draggedTo: null,
    isDragging: false,
    updatedOrder: [],
  });

  const onDragStart = (event: TargetedEvent<HTMLElement, DragEvent>) => {
    const initialPosition = getItemPosition(event.currentTarget);

    setDragAndDrop({
      ...dragAndDrop,
      draggedFrom: initialPosition,
      isDragging: true,
    });

    // DnD won't work on Firefox without it
    event.dataTransfer?.setData('text/html', '');
  };

  const onDragOver = (event: TargetedEvent<HTMLElement, DragEvent>) => {
    event.preventDefault();

    let updatedOrder: ListItemDataType[] = [...items];

    const { draggedFrom } = dragAndDrop;

    // Nothing is being dragged, so there is no item to move and no order to compute.
    if (draggedFrom === null) {
      return;
    }

    const draggedTo = getItemPosition(event.currentTarget);
    const itemDragged = updatedOrder[draggedFrom];
    const remainingItems = updatedOrder.filter(
      (_: ListItemDataType, index: number) => index !== draggedFrom,
    );

    if (itemDragged !== undefined) {
      updatedOrder = [
        ...remainingItems.slice(0, draggedTo),
        itemDragged,
        ...remainingItems.slice(draggedTo),
      ];
    }

    if (draggedTo !== dragAndDrop.draggedTo) {
      setDragAndDrop({ ...dragAndDrop, updatedOrder, draggedTo });
    }
  };

  const onDragLeave = () => {
    setDragAndDrop({ ...dragAndDrop, draggedTo: null });
  };

  const onDrop = () => {
    onChange?.(dragAndDrop.updatedOrder);
    setDragAndDrop({
      ...dragAndDrop,
      draggedFrom: null,
      draggedTo: null,
      isDragging: false,
    });
  };

  function isDragTarget(itemIndex: number) {
    return dragAndDrop.draggedTo === Number(itemIndex);
  }

  function isBeforeStart(itemIndex: number) {
    const { draggedFrom } = dragAndDrop;

    return isDragTarget(itemIndex) && draggedFrom !== null && draggedFrom > itemIndex;
  }

  function isAfterStart(itemIndex: number) {
    const { draggedFrom } = dragAndDrop;

    return isDragTarget(itemIndex) && draggedFrom !== null && draggedFrom < itemIndex;
  }

  return {
    getListItemProps: (listItemIndex: number) => ({
      'data-position': listItemIndex,
      draggable: true,
      onDragStart,
      onDragOver,
      onDragLeave,
      onDrop,
    }),
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    isDragging: dragAndDrop.isDragging,
    draggedFrom: dragAndDrop.draggedFrom,
    isDragTarget,
    isBeforeStart,
    isAfterStart,
  };
}
