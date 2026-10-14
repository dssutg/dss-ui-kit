// SPDX-License-Identifier: MIT
// A set of buttons over one selection, generic over the id the items carry.

import { Ripple } from '@/components/feedback/Ripple';
import { cn } from '@/util/cn';
import { wrapIndex } from '@/util/math';

/**
 * What {@link ButtonGroup} takes.
 *
 * Generic over the id type, so the id a click reports is the caller's own union and not a string.
 */
export interface ButtonGroupProps<T extends string> {
  readonly itemId: T;
  readonly items: readonly ButtonGroupItem<T>[];
  readonly onItemChange: ButtonGroupItemChangeHandler<T>;
  readonly className?: string | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly buttonStyle?: React.CSSProperties | undefined;
  readonly transparentBG?: boolean | undefined;
}

/**
 * One entry of a {@link ButtonGroup}: its id, which is what {@link ButtonGroupItemChangeHandler}
 * receives, and the title rendered on it.
 */
export interface ButtonGroupItem<T extends string> {
  readonly id: T;
  readonly title: string;
}

/**
 * Called with the id of the item that is now selected.
 *
 * It is given the id and not the item, because a group is generic over its ids and the caller holds
 * the items.
 */
export type ButtonGroupItemChangeHandler<T extends string> = (itemId: T) => void;

/**
 * A row of buttons of which one is selected, and which is always the caller's choice.
 *
 * Controlled throughout: the selected id is a prop and a click only reports the id it would select.
 * A group that kept its own selection could not be reset by a form, and two groups on one page could
 * not be kept in step — which is why this is not also published in an uncontrolled form.
 *
 * The arrow keys move the selection and wrap at both ends, from any segment, because a group of
 * buttons is one control as far as a keyboard is concerned and the segments are only its parts.
 */
export function ButtonGroup<T extends string>({
  itemId,
  items,
  onItemChange,
  className,
  style,
  buttonStyle,
  transparentBG = false,
}: ButtonGroupProps<T>): React.JSX.Element {
  // Handled on each segment rather than on the wrapper: the segments are already focusable, so a
  // focusable wrapper would only add a tab stop that does nothing on Enter or Space.
  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.code !== 'ArrowLeft' && event.code !== 'ArrowRight') {
      return;
    }
    // The handler is bound to a segment, so it can only run while at least one segment exists; the
    // guard is for a group rendered with no items, which has no segment to receive the event. The
    // unreached arm stays out of the coverage gate for that.
    // v8 ignore next 3
    if (items.length === 0) {
      return;
    }

    const itemIndex = Math.max(
      0,
      items.findIndex(({ id }) => id === itemId),
    );

    if (event.code === 'ArrowLeft') {
      // `wrapIndex` returns an index inside a non-empty list, so the read is always an item; the
      // fallback is only for the compiler. The unreached arm stays out of the coverage gate.
      // v8 ignore next
      onItemChange(items[wrapIndex(itemIndex - 1, items.length)]?.id ?? itemId);
    } else {
      // v8 ignore next
      onItemChange(items[wrapIndex(itemIndex + 1, items.length)]?.id ?? itemId);
    }
  }

  return (
    <div className={cn('flex', className)} style={style}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onItemChange(item.id)}
          onKeyDown={onKeyDown}
          className={cn(
            'relative flex shrink-0 select-none items-center justify-center overflow-hidden border-2 px-4 py-2 outline-2 outline-white transition-colors duration-200 first:rounded-l-lg last:rounded-r-lg hover:brightness-150',
            transparentBG ? 'bg-transparent' : 'bg-bpd',
            itemId === item.id ? 'border-tli text-tli' : 'border-bsp text-tpl',
          )}
          style={buttonStyle}
        >
          <Ripple color="var(--color-ripple-button)" />
          <div className="max-w-full overflow-x-hidden text-ellipsis">{item.title}</div>
        </button>
      ))}
    </div>
  );
}
