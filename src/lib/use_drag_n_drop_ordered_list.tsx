import { type TargetedEvent, useState } from 'react';

interface State<ListItemDataType> {
  draggedFrom: number | null;
  draggedTo: number | null;
  isDragging: boolean;
  updatedOrder: ListItemDataType[];
}

export function useDragNDropOrderedList<ListItemDataType>(
  items: ListItemDataType[],
  onChange?: (updatedItems: ListItemDataType[]) => void,
) {
  const [dragAndDrop, setDragAndDrop] = useState<State<ListItemDataType>>({
    draggedFrom: null,
    draggedTo: null,
    isDragging: false,
    updatedOrder: [],
  });

  const onDragStart = (event: TargetedEvent<HTMLElement, DragEvent>) => {
    const initialPosition = Number(event.currentTarget.dataset['position']);

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

    const draggedTo = Number(event.currentTarget.dataset['position']);
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
