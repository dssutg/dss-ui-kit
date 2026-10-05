import { useEffect, useState } from 'react';
import { IconButton } from '@/components/buttons/IconButton';
import { Icon, type IconName } from '@/components/display/Icon';
import { Ripple } from '@/components/feedback/Ripple';
import { SearchInput } from '@/components/inputs/SearchInput';
import { builtinCatalogues, getLocaleName, translate, useLocale } from '@/locale';
import { cn } from '@/util/cn';
import { useIsMobileScreen } from '@/util/hooks/use_is_mobile_screen';
import { unreachable } from '@/util/unreachable';
import { type ColorIndicator, colorIndicatorColorMap, type TreeViewItem } from './TreeView';

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

/**
 * One entry in a {@link MenuTree}, and the same shape for every level of it.
 *
 * The tree draws items and reports clicks; it does not decide what any of them means. That is why a
 * title is either a literal `title` or a `titleKey` in the consumer's catalogue rather than a message
 * of this library, why `route` is reported through `onNavigate` instead of navigated to, and why
 * visibility, ordering and which entries exist are all the caller's data.
 */
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

/**
 * A collapsible tree of menu items, with search, colour indicators and a mobile layout.
 *
 * It renders what it is given and reports activation; there is no routing, no filtering rule and no
 * knowledge of what an item points at. An item is drawn as a list when it has subitems or asks to be
 * one, hidden when `hidden` is set or when it is mobile-only on a screen that is not mobile, and its
 * parent is highlighted when `isOnPathToCurrentItem` says so — a comparison the caller supplies,
 * because only the caller knows how its items are addressed.
 */
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
  className,
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
  readonly className?: string | undefined;
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
}): React.JSX.Element {
  const { tRaw } = useLocale();

  return (
    <div
      className={cn(
        'flex flex-col bg-bpd shrink-0 overflow-hidden',
        expanded && 'w-full sm:w-[var(--menu-tree-width)]',
        className,
      )}
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
        className={cn(
          'overflow-y-scroll flex-grow',
          expanded ? 'overflow-x-scroll' : 'overflow-x-hidden',
        )}
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

/** How far one level of a menu tree indents its item, in pixels. */
const levelXFactor = 36;

/**
 * The horizontal offset of one block of a menu item's indentation.
 *
 * The block at the item's own level sits at that level's offset; the blocks above it sit one factor
 * further right, which is what puts a corner one column in from the left edge.
 */
function treeLevelBlockOffset(index: number, level: number): number {
  return index === level ? index * levelXFactor : (index + 1) * levelXFactor;
}

/**
 * The blocks that draw a menu item's indentation: one per level above it, ending in the corner that
 * joins the item to the branch it hangs from.
 *
 * An item at the top level has no branch above it, and draws none.
 */
function renderTreeLevelBlocks(
  treeLevelBlockTypes: readonly TreeLevelBlockType[],
  last: boolean,
  level: number,
  isList: boolean,
): React.ReactNode {
  if (level <= 0) {
    return null;
  }

  const blockTypes = [...treeLevelBlockTypes, last ? branchEndConnector : branchConnector];
  const fullWidth = !isList;

  return blockTypes.map((type, index) =>
    renderTreeLevelBlock(type, index, treeLevelBlockOffset(index, level), fullWidth),
  );
}

/**
 * One block of a menu item's indentation: the corner that joins the item to its branch, the branch
 * itself, the line that carries that branch down through the levels above, or padding that leaves a
 * gap and draws nothing.
 */
function renderTreeLevelBlock(
  type: TreeLevelBlockType,
  index: number,
  left: number,
  fullWidth: boolean,
): React.ReactNode {
  const style: React.CSSProperties = { left };

  switch (type) {
    case 'branchEndConnector': {
      return (
        <div
          key={index}
          className={cn(
            'border-b-tpd border-l-tpd absolute top-0 h-3/6 border-b-2 border-l-2',
            fullWidth ? 'w-7' : 'w-2',
          )}
          style={style}
        />
      );
    }

    case 'branchConnector': {
      return (
        <div key={index} className="absolute top-0 h-full" style={style}>
          <div
            className={cn(
              'border-b-tpd border-l-tpd h-3/6 border-b-2 border-l-2',
              fullWidth ? 'w-7' : 'w-2',
            )}
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
        <div key={index} className="border-l-tpd absolute top-0 h-full border-l-2" style={style} />
      );
    }

    // Every connector type above is handled, and this says so: a new one is a type
    // error here rather than an item that draws no indentation at all.
    default:
      return unreachable(type);
  }
}

/**
 * What a click on a menu item asks the tree to do with it.
 *
 * `deny` stops the tree's own handling — used when the caller has already navigated, or is going to.
 */
export type MenuTreeItemClickHandlerResult = 'default' | 'deny';

/**
 * Called when a menu item is activated, with the item and whether its subitems are now shown.
 *
 * Returning `'deny'` leaves the item's subitems as they were, so a click that navigates away does not
 * also leave a menu open behind it.
 */
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

/**
 * Called on a right-click of a menu item, for a caller's own context menu.
 *
 * The tree shows no menu of its own; it reports the event so the application can.
 */
export type MenuTreeItemContextMenuCallback = ({
  menuItem,
  subitemsShown,
  event,
}: {
  readonly menuItem: TMenuTreeItem;
  readonly subitemsShown: boolean;
  readonly event: React.MouseEvent<HTMLDivElement>;
}) => void;

/**
 * Whether a menu item draws a list: it has subitems of its own, or it asks to be drawn as a list
 * even with none.
 */
function menuTreeItemIsList(item: TMenuTreeItem): boolean {
  return item.subitems.length > 0 || item.onlyList === true;
}

/**
 * Whether a menu item is not drawn at all: it is hidden, it is mobile-only and the screen is not a
 * mobile one, or it is a list that would show the operator nothing.
 */
function menuTreeItemIsHidden(
  item: TMenuTreeItem,
  isList: boolean,
  isMobileScreen: boolean,
): boolean {
  return (
    item.hidden === true ||
    (item.onlyMobile === true && !isMobileScreen) ||
    (item.hideListIfEmpty === true && isList && item.subitems.length === 0)
  );
}

/**
 * Whether the list a menu item draws shows the operator nothing: it has no subitems of its own, or
 * every one of them is a list that is empty and hides itself.
 */
function menuTreeItemListIsEmpty(item: TMenuTreeItem, isList: boolean): boolean {
  const subitems = item.subitems;

  return isList && (subitems.length === 0 || subitems.every(menuTreeSubitemIsEmptyList));
}

/** Whether a subitem is a list that is empty and hides itself rather than drawing a dead row. */
function menuTreeSubitemIsEmptyList(subitem: TMenuTreeItem): boolean {
  return (
    Boolean(subitem.onlyList) && Boolean(subitem.hideListIfEmpty) && subitem.subitems.length === 0
  );
}

/** How much of a menu item is on screen, which decides whether it highlights itself. */
interface MenuTreeItemVisibility {
  readonly subitemsShown: boolean;
  readonly expanded: boolean;
  readonly isEmptyList: boolean;
}

/**
 * Whether a menu item is drawn as the current one.
 *
 * An item that is only on the path to the current one counts while its own subitems are not
 * showing: the parent of a selected item is what an operator navigates back from, and it stops
 * being highlighted as soon as it is open. A list with nothing in it is always highlighted, because
 * there is nothing to open.
 */
function menuTreeItemIsSelected(
  id: string,
  currentItemId: string,
  isOnPathToCurrentItem: IsOnPathToCurrentItem,
  { subitemsShown, expanded, isEmptyList }: MenuTreeItemVisibility,
): boolean {
  return (
    id === currentItemId ||
    (isOnPathToCurrentItem(id, currentItemId) && (!subitemsShown || !expanded || isEmptyList))
  );
}

/**
 * The collapse marker of a menu item: the triangle that says whether its list is open, or an
 * invisible spacer that keeps a leaf item's label where a list item's would be.
 */
function renderCollapseStatusIcon(
  isList: boolean,
  level: number,
  subitemsShown: boolean,
): React.ReactNode {
  if (!isList) {
    return <div className="ml-2 size-4 shrink-0" />;
  }

  return (
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

/**
 * The leading icon of a menu item, which carries the item's status while the menu is collapsed down
 * to icons and is otherwise the item's own icon.
 */
function renderMenuTreeItemIcon(
  icon: IconName | undefined,
  expanded: boolean,
  colorIndicator: ColorIndicator | undefined,
  menuItemIconStyle: React.CSSProperties | undefined,
): React.ReactNode {
  if (icon === undefined) {
    return null;
  }

  return (
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
  );
}

/**
 * The status stripe at the end of a menu item's label: a coloured border when the item reports a
 * status, and an empty stripe of the same size when it does not, so that labels stay aligned.
 */
function renderMenuTreeItemColorIndicator(
  expanded: boolean,
  colorIndicator: ColorIndicator | undefined,
): React.ReactNode {
  if (!expanded) {
    return null;
  }

  if (colorIndicator === undefined) {
    return <div className="ml-0.25 h-3/6 w-2 shrink-0" />;
  }

  return (
    <div
      className="ml-0.25 h-3/6 w-2 shrink-0 border-r-4"
      style={{ borderRightColor: colorIndicatorColorMap[colorIndicator] }}
    />
  );
}

/** Whether a key activates a menu item the way a click does. */
function isActivationKey(key: string): boolean {
  return key === 'Enter' || key === ' ';
}

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
    inactive,
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

  const isList = menuTreeItemIsList(item);
  const isHidden = menuTreeItemIsHidden(item, isList, isMobileScreen);
  const isEmptyList = menuTreeItemListIsEmpty(item, isList);

  const selected = menuTreeItemIsSelected(id, currentItemId, isOnPathToCurrentItem, {
    subitemsShown,
    expanded,
    isEmptyList,
  });

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

    activate(route ?? id);
  }

  /**
   * Whether a list may reveal its subitems: always where the full menu is drawn, and on a narrow
   * screen only while the menu is open.
   */
  function mayToggleSubitems(): boolean {
    return !shouldSaveSpace || (shouldSaveSpace && expanded);
  }

  /**
   * What a click that nothing denied does: a list reveals or hides its subitems and reports that
   * the menu has to be open; anything else navigates, and reports that the menu has to close when
   * it is open on a narrow screen.
   */
  function activate(destination: string) {
    if (isList) {
      if (mayToggleSubitems()) {
        setSubitemsShown((shown) => !shown);
      }

      onMenuExpansionChange?.(true);

      return;
    }

    onNavigate?.(destination);

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

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!isActivationKey(event.key)) {
      return;
    }

    event.preventDefault();

    handleClick(event);
  }

  if (isHidden) {
    return null;
  }

  const listCollapseStatusIcon = renderCollapseStatusIcon(isList, level, subitemsShown);

  function getStyle(): React.CSSProperties {
    if (!menuItemStyle) {
      return {};
    }

    if (typeof menuItemStyle === 'object') {
      return menuItemStyle;
    }

    return menuItemStyle(item);
  }

  // The per-item form of `menuItemClassName` is resolved here rather than interpolated, so the caller's
  // function decides one item's classes instead of being stringified into every one of them.
  function getClassName(): string | undefined {
    if (menuItemClassName === undefined) {
      return undefined;
    }

    if (typeof menuItemClassName === 'function') {
      return menuItemClassName(item);
    }

    return menuItemClassName;
  }

  /** The item's label: its own title between whatever the caller puts before and after it. */
  function renderLabel() {
    if (!expanded) {
      return null;
    }

    return (
      <div className="mx-2" style={menuItemLabelStyle}>
        {titlePrefix}
        {resolveItemTitle(tRaw, title, titleKey)}
        {titleSuffix}
      </div>
    );
  }

  /**
   * The button that refreshes the item, or an invisible spacer of the same size so that the labels
   * of items with and without one stay aligned.
   */
  function renderRefreshButton() {
    if (!expanded) {
      return null;
    }

    if (!hasRefresh) {
      return <div className="ml-auto size-3 shrink-0" />;
    }

    return (
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
    );
  }

  /** The item's subitems, drawn below it while its list is open. */
  function renderSubitems() {
    if (!expanded || !subitemsShown || subitems.length === 0) {
      return null;
    }

    return (
      <div className="flex flex-col">
        {subitems.map((subitem, index) => renderSubitem(subitem, index))}
      </div>
    );
  }

  /** One subitem, carrying the levels above it down to itself. */
  function renderSubitem(subitem: TMenuTreeItem, index: number) {
    const isLast = index === subitems.length - 1;

    return (
      <MenuTreeItem
        key={subitem.id}
        item={subitem}
        last={isLast}
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
          isLast ? 'spacePadding' : 'verticalConnector',
        ]}
      />
    );
  }

  return (
    <>
      <div
        role="menuitem"
        tabIndex={0}
        className={cn(
          'relative flex select-none items-center overflow-hidden text-left',
          inactive ? 'text-tpd' : 'text-tpl hover:bg-bse cursor-pointer',
          expanded ? 'h-10 w-full pr-1' : 'aspect-square rounded-full p-2',
          selected && 'bg-bse',
          getClassName(),
        )}
        style={{
          paddingLeft: level * levelXFactor,
          ...getStyle(),
        }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
      >
        {!inactive && <Ripple color="var(--color-ripple-button)" />}
        <div className="absolute left-0 top-0 h-full">
          {renderTreeLevelBlocks(treeLevelBlockTypes, last, level, isList)}
        </div>
        {expanded && listCollapseStatusIcon}
        {renderMenuTreeItemIcon(icon, expanded, colorIndicator, menuItemIconStyle)}
        {renderLabel()}
        {expanded && afterTitleComponent}
        {renderRefreshButton()}
        {renderMenuTreeItemColorIndicator(expanded, colorIndicator)}
      </div>
      {renderSubitems()}
    </>
  );
}

/**
 * Whether a node of either kind is a menu item, told by the children it carries: a menu item always
 * has a `subitems` array, a tree view item only ever has `children`.
 */
function isMenuTreeItem(item: TMenuTreeItem | TreeViewItem): item is TMenuTreeItem {
  return (item as TMenuTreeItem).subitems !== undefined;
}

/**
 * A menu item's title as this library resolves it: its literal title, or the message it names
 * through the library's own catalogue — the only catalogue a title keyed for a consuming
 * application's own menu can be resolved against.
 */
function menuTreeItemTitle(menuTreeItem: TMenuTreeItem): string {
  return resolveItemTitle(translateInDocumentLocale, menuTreeItem.title, menuTreeItem.titleKey);
}

/**
 * Resolves a message key outside React, against the library's catalogues and the document's locale.
 *
 * The walk below is exported so a caller can find the path to a menu item by id; when it runs there
 * is no provider to read a catalogue from, so this is the resolution that is available.
 */
function translateInDocumentLocale(key: string): string {
  return translate(builtinCatalogues(), getLocaleName(), key);
}

/**
 * The titles of the items above a menu item and of the item itself, or null when the menu has no
 * such item at or below this one.
 */
function menuTreeItemTitleByItsId(
  menuTreeItem: TMenuTreeItem,
  id: string,
  path: readonly string[],
): string[] | null {
  const title = menuTreeItemTitle(menuTreeItem);

  if (menuTreeItem.id === id) {
    return [...path, title];
  }

  if (menuTreeItem.subitems.length === 0) {
    return null;
  }

  return buildMenuItemFullTitleByItsId(menuTreeItem.subitems, id, [...path, title]);
}

/**
 * The titles of the items above a tree view item and of the item itself, or null when the tree has
 * no such item at or below this one.
 */
function treeViewItemTitleByItsId(
  treeViewItem: TreeViewItem,
  id: string,
  path: readonly string[],
): string[] | null {
  const title = treeViewItem.label;

  if (treeViewItem.id === id) {
    return [...path, title];
  }

  if (treeViewItem.children === undefined || treeViewItem.children.length === 0) {
    return null;
  }

  return buildMenuItemFullTitleByItsId(treeViewItem.children, id, [...path, title]);
}

/**
 * The titles of the items above the one with this id, and of the item itself, or null when neither
 * kind of tree holds it.
 *
 * A menu item names its titles by message key and a tree view item carries its label as it is, so
 * the two are walked separately and share nothing but the path they are found along.
 */
export function buildMenuItemFullTitleByItsId(
  menuItems: readonly TMenuTreeItem[] | TreeViewItem[],
  id: string,
  path: readonly string[] = [],
): string[] | null {
  for (const item of menuItems) {
    const found = isMenuTreeItem(item)
      ? menuTreeItemTitleByItsId(item, id, path)
      : treeViewItemTitleByItsId(item, id, path);

    if (found) {
      return found;
    }
  }

  return null;
}

/**
 * The item with this id, anywhere in the tree, or `null`.
 *
 * Depth-first, and generic over the item type so a caller's own item shape — with fields this library
 * has never heard of — is searched as it stands. Useful after a click, when the caller has an id and
 * needs the item back.
 */
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
