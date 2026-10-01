import { useEffect, useState } from 'react';
import { unreachable } from '@/lib/unreachable';
import { builtinCatalogues, getLocaleName, translate, useLocale } from '@/locale';
import { Icon, type IconName } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import { Ripple } from '@/ui/Ripple';
import { SearchInput } from '@/ui/SearchInput';
import { type ColorIndicator, colorIndicatorColorMap, type TreeViewItem } from '@/ui/TreeView';
import { useIsMobileScreen } from '@/ui/use_is_mobile_screen';

/**
 * The label a menu item renders: its literal title, or the message it names.
 *
 * An item with neither renders as nothing rather than as a raw key, because a menu item that displays
 * `SomeApp.menu.overview` has failed in a way that is easy to miss and hard to report.
 */
function resolveItemTitle(
  tRaw: (key: string) => string,
  title: string | undefined,
  titleKey: string | undefined,
): string {
  if (title !== undefined) {
    return title;
  }

  if (titleKey === undefined) {
    return '';
  }

  return tRaw(titleKey);
}

export interface TMenuTreeItem {
  id: string;
  route?: string | undefined;
  title?: string | undefined;
  /**
   * A message key resolved through the active locale, used when `title` is not given.
   *
   * A plain string rather than the library's own key union, because a menu describes the consuming
   * application and its titles live in the consumer's catalogue, not in this library's.
   */
  titleKey?: string | undefined;
  titlePrefix?: React.ReactNode | undefined;
  titleSuffix?: React.ReactNode | undefined;
  afterTitleComponent?: React.ReactNode | undefined;
  icon?: IconName | undefined;
  subitems: TMenuTreeItem[];
  hideListIfEmpty?: boolean | undefined;
  hasRefresh?: boolean | undefined;
  onlyList?: boolean | undefined;
  hidden?: boolean | undefined;
  inactive?: boolean | undefined;
  colorIndicator?: ColorIndicator | undefined;
  onlyMobile?: boolean | undefined;
  onClick?: () => void;
  defaultSubitemsShown?: boolean | undefined;
}

/**
 * Decides whether a menu item counts as on the way to the current one, and is therefore
 * highlighted as a parent of it.
 *
 * The tree knows nothing about how an application is addressed, so it cannot know that one item is
 * an ancestor of another. The default highlights nothing beyond the item that is current; an
 * application whose ids are paths passes a comparison of its own.
 */
export type IsOnPathToCurrentItem = (itemId: string, currentItemId: string) => boolean;

const isNeverOnPath: IsOnPathToCurrentItem = () => false;

export function MenuTree({
  expanded,
  width,
  menuItems,
  currentItemId,
  getMenuItemDepth,
  onItemClick,
  onItemContextMenu,
  onRefreshItem,
  onMenuExpansionChange,
  isOnPathToCurrentItem = isNeverOnPath,
  onNavigate,
  style,
  menuItemClassName,
  menuItemStyle,
  menuItemIconStyle,
  menuItemLabelStyle,
  alwaysFullVersion,
  searchShown = false,
  searchText = '',
  onChangeSearchText,
}: {
  readonly expanded: boolean;
  readonly width: string | number;
  readonly menuItems: TMenuTreeItem[];
  readonly currentItemId: string;
  readonly getMenuItemDepth: (menuItem: TMenuTreeItem) => number;
  readonly onItemClick: MenuTreeItemClickCallback;
  readonly onItemContextMenu?: MenuTreeItemContextMenuCallback | undefined;
  readonly onRefreshItem?: ((menuItem: TMenuTreeItem) => void) | undefined;
  readonly onMenuExpansionChange?: ((expanded: boolean) => void) | undefined;

  /**
   * Called with the destination of an activated menu item.
   *
   * The tree has no router: it reports the item's `route`, or the item id when it has none, and
   * leaves the decision of what that means to the application.
   */
  readonly onNavigate?: ((to: string) => void) | undefined;
  /** See {@link IsOnPathToCurrentItem}. */
  readonly isOnPathToCurrentItem?: IsOnPathToCurrentItem | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly menuItemClassName?: (string | ((menuItem: TMenuTreeItem) => string)) | undefined;
  readonly menuItemStyle?:
    | (React.CSSProperties | ((menuItem: TMenuTreeItem) => React.CSSProperties))
    | undefined;
  readonly menuItemIconStyle?: React.CSSProperties | undefined;
  readonly menuItemLabelStyle?: React.CSSProperties | undefined;
  readonly alwaysFullVersion?: boolean | undefined;
  readonly searchShown?: boolean | undefined;
  readonly searchText?: string | undefined;
  readonly onChangeSearchText?: ((searchText: string) => void) | undefined;
}) {
  const { tRaw } = useLocale();

  return (
    <div
      className={`
        flex flex-col bg-bpd shrink-0 overflow-hidden
        ${expanded ? 'w-full sm:w-[var(--menu-tree-width)]' : ''}
      `}
      style={
        {
          '--menu-tree-width': width,
          ...style,
        } as React.CSSProperties
      }
    >
      {searchShown && expanded && (
        <div className="flex m-2 shrink-0">
          <SearchInput value={searchText} onChangeText={onChangeSearchText} />
        </div>
      )}
      <div
        className={`
          overflow-y-scroll flex-grow
          ${expanded ? 'overflow-x-scroll' : 'overflow-x-hidden'}
        `}
      >
        {menuItems.map((item) => (
          <MenuTreeItem
            key={resolveItemTitle(tRaw, item.title, item.titleKey)}
            item={item}
            currentItemId={currentItemId}
            expanded={expanded}
            getMenuItemDepth={getMenuItemDepth}
            onClick={onItemClick}
            onContextMenu={onItemContextMenu}
            onRefresh={onRefreshItem}
            onMenuExpansionChange={onMenuExpansionChange}
            onNavigate={onNavigate}
            isOnPathToCurrentItem={isOnPathToCurrentItem}
            menuItemClassName={menuItemClassName}
            menuItemStyle={menuItemStyle}
            menuItemIconStyle={menuItemIconStyle}
            menuItemLabelStyle={menuItemLabelStyle}
            alwaysFullVersion={alwaysFullVersion}
          />
        ))}
      </div>
    </div>
  );
}

type TreeLevelBlockType =
  // '\___' (used for the last item)
  | 'branchEndConnector'
  // '|---' (used for items that have siblings)
  | 'branchConnector'
  // '    ' (used for the last item's indentation, no actual element)
  | 'spacePadding'
  // '|   ' (used for items that have siblings)
  | 'verticalConnector';

const branchEndConnector: TreeLevelBlockType = 'branchEndConnector';
const branchConnector: TreeLevelBlockType = 'branchConnector';

export type MenuTreeItemClickHandlerResult = 'default' | 'deny';

export type MenuTreeItemClickCallback = ({
  menuItem,
  subitemsShown,
  event,
}: {
  readonly menuItem: TMenuTreeItem;
  readonly subitemsShown: boolean;
  /** A keyboard event when the item was activated with Enter or Space, a mouse event otherwise. */
  readonly event: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>;
}) => MenuTreeItemClickHandlerResult;

export type MenuTreeItemContextMenuCallback = ({
  menuItem,
  subitemsShown,
  event,
}: {
  readonly menuItem: TMenuTreeItem;
  readonly subitemsShown: boolean;
  readonly event: React.MouseEvent<HTMLDivElement>;
}) => void;

function MenuTreeItem({
  item,
  currentItemId,
  expanded,
  getMenuItemDepth,
  onClick,
  onContextMenu,
  onRefresh,
  onMenuExpansionChange,
  isOnPathToCurrentItem = isNeverOnPath,
  onNavigate,
  menuItemClassName,
  menuItemStyle,
  menuItemIconStyle,
  menuItemLabelStyle,
  alwaysFullVersion = false,
  last = false,
  treeLevelBlockTypes = [],
}: {
  readonly item: TMenuTreeItem;
  readonly currentItemId: string;
  readonly expanded: boolean;
  readonly getMenuItemDepth: (item: TMenuTreeItem) => number;
  readonly onClick: MenuTreeItemClickCallback;
  readonly onContextMenu?: MenuTreeItemContextMenuCallback | undefined;
  readonly onRefresh?: ((item: TMenuTreeItem) => void) | undefined;
  readonly onMenuExpansionChange?: ((expanded: boolean) => void) | undefined;

  /**
   * Called with the destination of an activated menu item.
   *
   * The tree has no router: it reports the item's `route`, or the item id when it has none, and
   * leaves the decision of what that means to the application.
   */
  readonly onNavigate?: ((to: string) => void) | undefined;
  /** See {@link IsOnPathToCurrentItem}. */
  readonly isOnPathToCurrentItem?: IsOnPathToCurrentItem | undefined;
  readonly menuItemClassName?: (string | ((menuItem: TMenuTreeItem) => string)) | undefined;
  readonly menuItemStyle?:
    | (React.CSSProperties | ((menuItem: TMenuTreeItem) => React.CSSProperties))
    | undefined;
  readonly menuItemIconStyle?: React.CSSProperties | undefined;
  readonly menuItemLabelStyle?: React.CSSProperties | undefined;
  readonly alwaysFullVersion?: boolean | undefined;
  readonly last?: boolean | undefined;
  readonly treeLevelBlockTypes?: readonly TreeLevelBlockType[] | undefined;
}) {
  const { t, tRaw } = useLocale();

  const isMobileScreen = useIsMobileScreen();

  const shouldSaveSpace = isMobileScreen && !alwaysFullVersion;

  const {
    id,
    route,
    subitems,
    onlyList,
    hidden,
    onlyMobile,
    inactive,
    hideListIfEmpty,
    colorIndicator,
    icon,
    title,
    titleKey,
    titlePrefix,
    titleSuffix,
    afterTitleComponent,
    hasRefresh,
    defaultSubitemsShown,
  } = item;

  const actualDefaultSubitemsShown = defaultSubitemsShown ?? false;

  const [subitemsShown, setSubitemsShown] = useState(actualDefaultSubitemsShown);

  useEffect(() => {
    setSubitemsShown(actualDefaultSubitemsShown);
  }, [actualDefaultSubitemsShown]);

  const level = getMenuItemDepth(item);

  const hasSubitems = subitems.length > 0;
  const isList = hasSubitems || onlyList;
  const isHidden =
    hidden || (onlyMobile && !isMobileScreen) || (hideListIfEmpty && isList && !hasSubitems);

  const isEmptyList =
    isList &&
    (!hasSubitems ||
      subitems.every(
        (subitem) =>
          Boolean(subitem.onlyList) &&
          Boolean(subitem.hideListIfEmpty) &&
          subitem.subitems.length === 0,
      ));

  const selected =
    id === currentItemId ||
    (isOnPathToCurrentItem(id, currentItemId) && (!subitemsShown || !expanded || isEmptyList));

  function handleClick(
    event: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>,
  ) {
    if (inactive) {
      return;
    }

    const result = onClick({
      menuItem: item,
      subitemsShown,
      event,
    });

    if (result !== 'default') {
      return;
    }

    // Fire individual onClick only when the item passed the common onClick
    item.onClick?.();

    if (isList) {
      if (!shouldSaveSpace || (shouldSaveSpace && expanded)) {
        setSubitemsShown((shown) => !shown);
      }

      onMenuExpansionChange?.(true);

      return;
    }

    onNavigate?.(route ?? id);
    if (shouldSaveSpace && expanded) {
      onMenuExpansionChange?.(false);
    }
  }

  function handleContextMenu(event: React.MouseEvent<HTMLDivElement>) {
    if (inactive) {
      return;
    }

    onContextMenu?.({
      menuItem: item,
      subitemsShown,
      event,
    });
  }

  if (isHidden) {
    return null;
  }

  let listCollapseStatusIcon = <div className="ml-2 size-4 shrink-0" />;

  if (isList) {
    listCollapseStatusIcon = (
      <Icon
        name="triangleDown"
        style={{
          fill: 'var(--color-tpd)',
          width: '1rem',
          height: '1rem',
          flexShrink: 0,
          marginLeft: level > 0 ? '0.75rem' : '0.5rem',
          ...(!subitemsShown && { transform: 'rotate(-90deg)' }),
        }}
      />
    );
  }

  function getStyle(): React.CSSProperties {
    if (!menuItemStyle) {
      return {};
    }

    if (typeof menuItemStyle === 'object') {
      return menuItemStyle;
    }

    return menuItemStyle(item);
  }

  const levelXFactor = 36;

  return (
    <>
      <div
        role="menuitem"
        tabIndex={0}
        className={`
          relative flex select-none items-center overflow-hidden text-left
          ${inactive ? 'text-tpd' : 'text-tpl hover:bg-bse cursor-pointer'}
          ${expanded ? 'h-10 w-full pr-1' : 'aspect-square rounded-full p-2'}
          ${selected && 'bg-bse'}
          ${menuItemClassName}
        `}
        style={{
          paddingLeft: level * levelXFactor,
          ...getStyle(),
        }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') {
            return;
          }

          event.preventDefault();
          handleClick(event);
        }}
      >
        {!inactive && <Ripple color="var(--color-ripple-button)" />}
        <div className="absolute left-0 top-0 h-full">
          {level > 0 &&
            [...treeLevelBlockTypes, last ? branchEndConnector : branchConnector].map(
              (type, index) => {
                const fullWidth = !isList;

                let left = 0;
                if (index !== level) {
                  left = (index + 1) * levelXFactor;
                } else {
                  left = (index + 0) * levelXFactor;
                }

                const style: React.CSSProperties = {
                  left,
                };

                switch (type) {
                  case 'branchEndConnector': {
                    return (
                      <div
                        key={index}
                        className={`
                        border-b-tpd border-l-tpd absolute top-0 h-3/6 border-b-2 border-l-2
                        ${fullWidth ? 'w-7' : 'w-2'}
                      `}
                        style={style}
                      />
                    );
                  }

                  case 'branchConnector': {
                    return (
                      <div key={index} className="absolute top-0 h-full" style={style}>
                        <div
                          className={`
                          border-b-tpd border-l-tpd h-3/6 border-b-2 border-l-2
                          ${fullWidth ? 'w-7' : 'w-2'}
                        `}
                        />
                        <div className="border-l-tpd h-3/6 border-l-2" />
                      </div>
                    );
                  }

                  case 'spacePadding': {
                    return null;
                  }

                  case 'verticalConnector': {
                    return (
                      <div
                        key={index}
                        className="border-l-tpd absolute top-0 h-full border-l-2"
                        style={style}
                      />
                    );
                  }

                  // Every connector type above is handled, and this says so: a new one is a type
                  // error here rather than an item that draws no indentation at all.
                  default:
                    return unreachable(type);
                }
              },
            )}
        </div>
        {expanded && listCollapseStatusIcon}
        {icon !== undefined && (
          <Icon
            name={icon}
            style={{
              marginLeft: '0.5rem',
              width: '1.75rem',
              height: '1.75rem',
              flexShrink: 0,
              fill:
                !expanded && colorIndicator !== undefined
                  ? colorIndicatorColorMap[colorIndicator]
                  : 'var(--color-tpl)',
              ...menuItemIconStyle,
            }}
          />
        )}
        {expanded && (
          <div className="mx-2" style={menuItemLabelStyle}>
            {titlePrefix}
            {resolveItemTitle(tRaw, title, titleKey)}
            {titleSuffix}
          </div>
        )}
        {expanded && afterTitleComponent}
        {expanded &&
          (hasRefresh ? (
            <IconButton
              icon="refresh"
              iconClassName="fill-tpd size-3"
              className="ml-auto shrink-0 rounded-full p-1"
              rippleColor="var(--color-ripple-icon-button)"
              title={t('MenuTree.MenuTreeItem.refreshMenuItem')}
              onClick={(e) => {
                e.stopPropagation();
                onRefresh?.(item);
              }}
            />
          ) : (
            <div className="ml-auto size-3 shrink-0" />
          ))}
        {expanded &&
          (colorIndicator !== undefined ? (
            <div
              className="ml-0.25 h-3/6 w-2 shrink-0 border-r-4"
              style={{
                borderRightColor: colorIndicatorColorMap[colorIndicator],
              }}
            />
          ) : (
            <div className="ml-0.25 h-3/6 w-2 shrink-0" />
          ))}
      </div>
      {expanded && subitemsShown && subitems.length !== 0 && (
        <div className="flex flex-col">
          {subitems.map((subitem, index) => (
            <MenuTreeItem
              key={subitem.id}
              item={subitem}
              last={index === subitems.length - 1}
              currentItemId={currentItemId}
              expanded
              getMenuItemDepth={getMenuItemDepth}
              onClick={onClick}
              onContextMenu={onContextMenu}
              onRefresh={onRefresh}
              onMenuExpansionChange={onMenuExpansionChange}
              onNavigate={onNavigate}
              isOnPathToCurrentItem={isOnPathToCurrentItem}
              menuItemClassName={menuItemClassName}
              menuItemStyle={menuItemStyle}
              menuItemIconStyle={menuItemIconStyle}
              menuItemLabelStyle={menuItemLabelStyle}
              alwaysFullVersion={alwaysFullVersion}
              treeLevelBlockTypes={[
                ...treeLevelBlockTypes,
                index === subitems.length - 1 ? 'spacePadding' : 'verticalConnector',
              ]}
            />
          ))}
        </div>
      )}
    </>
  );
}

export function buildMenuItemFullTitleByItsId(
  menuItems: readonly TMenuTreeItem[] | TreeViewItem[],
  id: string,
  path: readonly string[] = [],
): string[] | null {
  for (const item of menuItems) {
    if ((item as TMenuTreeItem).subitems !== undefined) {
      const menuTreeItem = item as TMenuTreeItem;

      const title = resolveItemTitle(
        (key) => translate(builtinCatalogues, getLocaleName(), key),
        menuTreeItem.title,
        menuTreeItem.titleKey,
      );

      if (menuTreeItem.id === id) {
        return [...path, title];
      }

      if (menuTreeItem.subitems.length === 0) {
        continue;
      }

      const found = buildMenuItemFullTitleByItsId(menuTreeItem.subitems, id, [...path, title]);
      if (found) {
        return found;
      }
    } else {
      const treeViewItem = item as TreeViewItem;

      const title = treeViewItem.label;

      if (treeViewItem.id === id) {
        return [...path, title];
      }

      if (treeViewItem.children === undefined || treeViewItem.children.length === 0) {
        continue;
      }

      const found = buildMenuItemFullTitleByItsId(treeViewItem.children, id, [...path, title]);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

export function findMenuItemById<T extends { id: string; subitems: T[] }>(
  menuItems: T[],
  menuItemId: string,
): T | null {
  for (const item of menuItems) {
    if (item.id === menuItemId) {
      return item;
    }
    const foundItem = findMenuItemById(item.subitems, menuItemId);
    if (foundItem !== null) {
      return foundItem;
    }
  }
  return null;
}
