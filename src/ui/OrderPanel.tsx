import { useCallback } from 'react';
import { moveArrayElementLeftOrRightCircularly } from '@/lib/array';
import { useDragNDropOrderedList } from '@/lib/use_drag_n_drop_ordered_list';
import { useLocale } from '@/locale';
import { Button, IconButton } from './button';
import type { IconName } from './icon';
import { useIsMobileScreen } from './use_is_mobile_screen';

export function OrderPanel<T extends number>({
  title = '',
  items,
  visibilityMap,
  itemIndexFormatter,
  onChange,
  onVisibilityChange,
  onResetDefaultOrder,
  onRemoveItem,
  noOrderControls = false,
  style,
}: {
  readonly title?: string | undefined;
  readonly items: T[];
  readonly visibilityMap?: boolean[] | undefined;
  readonly itemIndexFormatter?: (item: T, index: number) => React.ReactNode;
  readonly onChange?: (items: T[]) => void;
  readonly onVisibilityChange?: (visibilityMap: boolean[]) => void;
  readonly onResetDefaultOrder?: () => void;
  readonly onRemoveItem?: (item: T, itemIndex: number) => void;
  readonly noOrderControls?: boolean | undefined;
  readonly style?: React.CSSProperties | undefined;
}) {
  const { t } = useLocale();

  const isMobileScreen = useIsMobileScreen();

  const { getListItemProps, isBeforeStart, isAfterStart } = useDragNDropOrderedList<T>(
    items,
    onChange,
  );

  const toggleItemVisibility = useCallback(
    (item: T) => {
      const newVisibilityMap = [...(visibilityMap ?? [])];
      newVisibilityMap[item] = !newVisibilityMap[item];
      onVisibilityChange?.(newVisibilityMap);
    },
    [visibilityMap, onVisibilityChange],
  );

  return (
    <div className="flex flex-col gap-4" style={style}>
      <div className="flex gap-2 border-b-2 border-b-bsp pb-2 pt-0">
        {onResetDefaultOrder !== undefined && (
          <IconButton
            icon="alphabet"
            className="rounded-full p-1"
            bgClassName="hover:bg-bse"
            iconClassName="fill-tda size-5"
            rippleColor="var(--color-ripple-icon-button)"
            onClick={onResetDefaultOrder}
            title={t('ConfigurableOrderPanel.resetOrderToDefaults')}
          />
        )}
        {visibilityMap !== undefined && (
          <IconButton
            icon="upload"
            className="rounded-full p-1"
            bgClassName="hover:bg-bse"
            iconClassName="fill-tpd size-5"
            rippleColor="var(--color-ripple-icon-button)"
            onClick={() => {
              const newItems: T[] = [];
              // First push visible items.
              for (const item of items) {
                if (visibilityMap[item]) {
                  newItems.push(item);
                }
              }
              // Then invisible items.
              for (const item of items) {
                if (!visibilityMap[item]) {
                  newItems.push(item);
                }
              }
              onChange?.(newItems);
            }}
            title={t('ConfigurableOrderPanel.moveVisibleItemsToTop')}
          />
        )}
        <h2 className="mx-auto my-0 px-0 font-normal text-tpl">{title}</h2>
      </div>
      <ul className="m-0 flex max-h-80 list-none flex-col overflow-y-scroll p-0">
        {items.map((item, index) => (
          // No click handler on the row. It had one that toggled visibility, which the eye button
          // inside already does, and the same element is the drag handle — so a drag ended with a
          // click and toggled the item the user was only trying to move. Visibility is the eye
          // button's job now, and it is reachable by keyboard because it is a button.
          <li
            key={item}
            className={`
              m-0 box-border flex select-none items-center gap-2 bg-bpd p-1 text-tpl hover:brightness-150
              border-b-2 border-t-2 border-b-[transparent]
              ${!noOrderControls && 'cursor-move'}
              ${!noOrderControls && isBeforeStart(index) ? 'border-t-bsp' : 'border-t-[transparent]'}
              ${!noOrderControls && isAfterStart(index) ? 'border-b-bsp' : 'border-t-[transparent]'}
            `}
            {...(noOrderControls ? {} : getListItemProps(index))}
          >
            <div className="flex gap-2">
              {!noOrderControls && (
                <>
                  <OrderPanelControlButton
                    icon="arrowUp"
                    title={t('ConfigurableOrderPanel.moveUp')}
                    onClick={() =>
                      onChange?.(moveArrayElementLeftOrRightCircularly(items, index, true))
                    }
                  />
                  <OrderPanelControlButton
                    icon="arrowDown"
                    title={t('ConfigurableOrderPanel.moveDown')}
                    onClick={() =>
                      onChange?.(moveArrayElementLeftOrRightCircularly(items, index, false))
                    }
                  />
                </>
              )}
              {visibilityMap !== undefined && (
                <OrderPanelControlButton
                  icon={visibilityMap[item] ? 'eye' : 'eyeSlash'}
                  title={
                    visibilityMap[item]
                      ? t('ConfigurableOrderPanel.hide')
                      : t('ConfigurableOrderPanel.show')
                  }
                  onClick={() => toggleItemVisibility(item)}
                />
              )}
            </div>
            <p
              className={`
                m-0 overflow-x-hidden text-ellipsis p-0
                ${visibilityMap === undefined || visibilityMap[item] ? 'text-tpl' : 'text-tpd'}
              `}
            >
              {itemIndexFormatter !== undefined ? itemIndexFormatter(item, index) : item}
            </p>
            {onRemoveItem !== undefined && (
              <OrderPanelControlButton
                icon="times"
                title={t('ConfigurableOrderPanel.remove')}
                onClick={() => onRemoveItem(item, index)}
                style={{ marginLeft: 'auto' }}
              />
            )}
          </li>
        ))}
      </ul>
      {visibilityMap !== undefined && (
        <div className="flex flex-wrap gap-4">
          <Button
            icon="eyeSlash"
            title={t('ConfigurableOrderPanel.hideAll')}
            onClick={() => onVisibilityChange?.((visibilityMap ?? []).map(() => false))}
            style={{ width: isMobileScreen ? '100%' : 'auto' }}
          />
          <Button
            icon="eye"
            title={t('ConfigurableOrderPanel.showAll')}
            onClick={() => onVisibilityChange?.((visibilityMap ?? []).map(() => true))}
            style={{ width: isMobileScreen ? '100%' : 'auto' }}
          />
        </div>
      )}
    </div>
  );
}

function OrderPanelControlButton({
  icon,
  title,
  onClick,
  style,
}: {
  readonly icon: IconName;
  readonly title: string;
  readonly onClick: React.MouseEventHandler<HTMLButtonElement>;
  readonly style?: React.CSSProperties | undefined;
}) {
  return (
    <IconButton
      icon={icon}
      iconClassName="size-6 fill-tpd p-1"
      className="rounded-full"
      bgClassName="hover:bg-bse"
      style={style}
      title={title}
      rippleColor="var(--color-ripple-icon-button)"
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
    />
  );
}
