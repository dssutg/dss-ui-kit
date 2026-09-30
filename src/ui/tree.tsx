// This is a TreeView UI component with supporting these features:
//
//   - Keyboard Navigation:
//     - ArrowUp/ArrowDown moves selection.
//     - ArrowRight expands the selected item if it has children.
//     - ArrowLeft will collapse the selected item (or move to its
//       parent if already collapsed).
//     - Typeahead support aggregates key presses and automatically
//       navigates to the first matching item.
//
//   - Click & Double Click:
//     - Clicking a tree item selects it.
//     - Double clicking toggles expansion.
//     - An explicit arrow icon is rendered for items with children;
//       clicking this icon toggles the item.
//
//   - Search:
//     - if flag to enable search is set, a search input is shown that
//       filters the tree items. When filtering, matching items along with
//       their ancestors (expanded) are shown.
//
//   - Auto Scrolling:
//     - When a item is selected, the component scrolls that element
//       into view.
//
//   - Virtualization:
//     - Tree is first flattened then rendered as a virtualized list
//       for performance reasons.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AutoSizer } from "@/lib/autosizer";
import { clamp } from "@/lib/math";
import { useGranularEffect } from "@/lib/use_granular_effect";
import { builtinCatalogues, getLocaleName, translate, useLocale } from "@/locale";
import { IconButton } from "./button";
import { Checkbox } from "./checkbox";
import { Icon, type IconName } from "./icon";
import { SearchInput } from "./input";
import { VirtualizedList } from "./list";
import { Ripple } from "./ripple";
import { useIsMobileScreen } from "./use_is_mobile_screen";

export interface TreeViewItem {
	id: string;
	labelPrefix?: React.ReactNode;
	label: string;
	labelSuffix?: React.ReactNode;
	loading?: boolean;
	icon?: IconName;
	children?: TreeViewItem[];
	expanded?: boolean;
	checked?: boolean;
	level?: number;
	onDragOver?: (e: DragEvent) => void;
	onDrop?: (e: DragEvent) => void;
}

export function TreeView({
	tree,
	setTree,
	selectedItemId,
	onSelectedItemIdChange,
	hasSearch = false,
	levelPaddingPixels = 20,
	itemHeight = 40,
	className,
	itemClassName,
	style,
	itemStyle,
	itemLabelStyle,
	itemIconStyle,
	onItemExpansionChange,
	overScanCount,
	onDragOver,
	onKeyDown,
	onCopy,
	onCut,
	onPaste,
}: {
	readonly tree: TreeViewItem[];
	readonly setTree: (tree: TreeViewItem[]) => void;
	readonly selectedItemId: string | null;
	readonly onSelectedItemIdChange: (itemId: string | null) => void;
	readonly hasSearch?: boolean;
	readonly levelPaddingPixels?: number;
	readonly itemHeight?: number;
	readonly className?: string;
	readonly style?: React.CSSProperties;
	readonly itemClassName?: string;
	readonly itemStyle?: React.CSSProperties;
	readonly itemLabelStyle?: React.CSSProperties;
	readonly itemIconStyle?: React.CSSProperties;
	readonly onItemExpansionChange?: (itemId: string, expanded: boolean) => void;
	readonly overScanCount?: number;
	readonly onDragOver?: (e: DragEvent) => void;
	readonly onKeyDown?: (e: KeyboardEvent) => void;
	readonly onCopy?: (e: ClipboardEvent) => void;
	readonly onCut?: (e: ClipboardEvent) => void;
	readonly onPaste?: (e: ClipboardEvent) => void;
}) {
	const [typeAheadBuffer, setTypeAheadBuffer] = useState<string>("");

	const [searchText, setSearchText] = useState<string>("");

	const itemIdToElementMap = useRef<Record<string, HTMLDivElement | null>>({});

	const typeAheadTimeoutRef = useRef<number | null>(null);

	const listRef = useRef<HTMLDivElement>(null);

	const visibleItemFlatList = useMemo(() => {
		if (hasSearch && searchText !== "") {
			return getVisibleItemFlatList(filterTree(tree, searchText));
		}
		return getVisibleItemFlatList(tree);
	}, [tree, hasSearch, searchText]);

	useGranularEffect(
		() => {
			itemIdToElementMap.current = {};
		},
		[tree],
		[],
	);

	useEffect(() => {
		return () => {
			if (typeAheadTimeoutRef.current !== null) {
				clearTimeout(typeAheadTimeoutRef.current);
			}
		};
	}, []);

	useEffect(() => {
		if (selectedItemId === null) {
			return;
		}

		const element = itemIdToElementMap.current[selectedItemId];

		element?.scrollIntoView({ behavior: "instant", block: "nearest" });
	}, [selectedItemId]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			onKeyDown?.(e);

			// Reset typeahead timer after a delay
			function resetTypeAhead() {
				if (typeAheadTimeoutRef.current !== null) {
					clearTimeout(typeAheadTimeoutRef.current);
				}
				typeAheadTimeoutRef.current = setTimeout(
					() => setTypeAheadBuffer(""),
					500,
				);
			}

			const targetTagName = (e.target as HTMLElement | undefined)?.tagName;

			if (targetTagName === "INPUT" || targetTagName === "TEXTAREA") {
				// Don't intervene with another input's events
				return;
			}

			if (visibleItemFlatList.length === 0) {
				return;
			}

			const currentIndex = visibleItemFlatList.findIndex(
				(item) => item.id === selectedItemId,
			);
			const currentItem = visibleItemFlatList[currentIndex];

			resetTypeAhead();

			switch (e.key) {
				case "ArrowUp": {
					e.preventDefault();

					const next = clamp(currentIndex - 1, 0, visibleItemFlatList.length);

					onSelectedItemIdChange(visibleItemFlatList[next]!.id);

					break;
				}

				case "ArrowDown": {
					e.preventDefault();

					const next = clamp(currentIndex + 1, 0, visibleItemFlatList.length);

					onSelectedItemIdChange(visibleItemFlatList[next]!.id);

					break;
				}

				case "ArrowLeft": {
					e.preventDefault();

					// Collapse if possible; if already collapsed, move to parent
					if (selectedItemId !== null) {
						if (
							currentItem !== undefined &&
							currentItem.children !== undefined &&
							currentItem.expanded
						) {
							// Try collapsing current item if expanded
							setTree(updateTreeToCollapseItem(tree, selectedItemId));
							onItemExpansionChange?.(selectedItemId, false);
						} else {
							// If already collapsed, select parent
							const parent = findParentItem(tree, selectedItemId);

							if (parent !== null) {
								onSelectedItemIdChange(parent.id);
							}
						}
					}

					break;
				}

				case "ArrowRight": {
					e.preventDefault();

					if (selectedItemId !== null) {
						// Expand if possible
						setTree(updateTreeToExpandItem(tree, selectedItemId));
						onItemExpansionChange?.(selectedItemId, true);
					}

					break;
				}

				default: {
					// Typeahead: if a character is an alphanumeric letter, accumulate it and search
					if (e.key.length === 1 && /\S/.test(e.key)) {
						const newTypeAhead = `${typeAheadBuffer}${e.key.toLowerCase()}`;

						setTypeAheadBuffer(newTypeAhead);

						function trySelectNextFoundItem(aheadFlatList: TreeViewItem[]) {
							// Look for the first item starting with the typeahead buffer
							const found = aheadFlatList.find((item) =>
								item.label.trim().toLowerCase().startsWith(newTypeAhead),
							);

							const success = found !== undefined;

							if (success) {
								onSelectedItemIdChange(found.id);
							}

							return success;
						}

						if (currentIndex === -1) {
							trySelectNextFoundItem(visibleItemFlatList);
						} else {
							const success = trySelectNextFoundItem(
								visibleItemFlatList.slice(currentIndex + 1),
							);

							if (!success) {
								trySelectNextFoundItem(visibleItemFlatList);
							}
						}

						resetTypeAhead();
					}

					break;
				}
			}
		},
		[
			visibleItemFlatList,
			tree,
			setTree,
			typeAheadBuffer,
			selectedItemId,
			onSelectedItemIdChange,
			onItemExpansionChange,
			onKeyDown,
		],
	);

	return (
		<div
			tabIndex={0}
			className={`flex flex-col flex-grow gap-2 overflow-hidden ${className}`}
			style={style}
			onKeyDown={handleKeyDown}
			onDragOver={onDragOver}
			onCopy={onCopy}
			onCut={onCut}
			onPaste={onPaste}
		>
			{hasSearch && (
				<div className="shrink-0">
					<SearchInput
						value={searchText}
						onChangeText={setSearchText}
						inputStyle={{ width: "100%" }}
					/>
				</div>
			)}
			<div className="flex flex-col flex-grow">
				<AutoSizer style={{ width: "100%", flexGrow: 1 }}>
					{({ height }) =>
						visibleItemFlatList.length !== 0 && (
							<VirtualizedList
								containerRef={listRef}
								itemCount={visibleItemFlatList.length}
								itemSize={itemHeight}
								width="100%"
								height={height}
								overScanCount={overScanCount ?? Math.floor(height / 2)}
								rowRenderer={({ index, style }) => {
									const item = visibleItemFlatList[index];

									if (item === undefined) {
										return null;
									}

									const loading = item.loading ?? false;

									return (
										<div key={item.id} style={style}>
											<div
												ref={(element) => {
													itemIdToElementMap.current[item.id] = element;
												}}
												onClick={() => {
													onSelectedItemIdChange(item.id);
												}}
												onDblClick={(e) => {
													e.stopPropagation();
													e.preventDefault();
													setTree(
														updateTreeToToggleItemExpansion(tree, item.id),
													);
													onItemExpansionChange?.(item.id, !item.expanded);
												}}
												onDragOver={item.onDragOver}
												onDrop={item.onDrop}
												className={`
                          flex p-1 select-none
                          ${!loading && selectedItemId === item.id ? "bg-bse" : ""}
                          ${
														loading
															? "brightness-75 animate-pulse pointer-events-none"
															: "cursor-pointer"
													}
                          ${itemClassName}
                        `}
												style={{
													paddingLeft: (item.level ?? 0) * levelPaddingPixels,
													...itemStyle,
												}}
											>
												{item.children !== undefined ? (
													<IconButton
														icon="triangleDown"
														iconClassName={`
                              fill-tpd size-4
                              ${!item.expanded ? "-rotate-90" : ""}
                            `}
														className="mr-2 shrink-0"
														onClick={(e) => {
															e.stopPropagation();
															setTree(
																updateTreeToToggleItemExpansion(tree, item.id),
															);
															onItemExpansionChange?.(item.id, !item.expanded);
														}}
														onDblClick={(e) => {
															e.stopPropagation();
															e.preventDefault();
														}}
													/>
												) : (
													<div className="size-4 mr-2 shrink-0" />
												)}
												{item.icon !== undefined && (
													<Icon
														name={item.icon}
														style={{
															marginLeft: "0.5rem",
															width: "1.75rem",
															height: "1.75rem",
															flexShrink: 0,
															...itemIconStyle,
														}}
													/>
												)}
												{item.labelPrefix}
												<div className="truncate" style={itemLabelStyle}>
													{item.checked !== undefined ? (
														<Checkbox
															checked={item.checked}
															onChange={(checked) => {
																setTree(
																	updateTreeToSetItemCheck(
																		tree,
																		item.id,
																		checked,
																	),
																);
															}}
															label={item.label}
														/>
													) : (
														item.label
													)}
												</div>
												{item.labelSuffix}
											</div>
										</div>
									);
								}}
							/>
						)
					}
				</AutoSizer>
			</div>
		</div>
	);
}

function getVisibleItemFlatList(
	items: TreeViewItem[],
	level = 0,
	parentLoading = false,
) {
	let results: TreeViewItem[] = [];

	for (const item of items) {
		const itemLoading = (item.loading ?? false) || parentLoading;

		results.push({
			...item,
			level,
			loading: itemLoading,
		});

		if (item.children !== undefined && item.expanded) {
			results = [
				...results,
				...getVisibleItemFlatList(item.children, level + 1, itemLoading),
			];
		}
	}

	return results;
}

function filterTree(items: TreeViewItem[], term: string) {
	const lowerTerm = term.toLowerCase();

	let filtered: TreeViewItem[] = [];

	for (const item of items) {
		if (item.label.toLowerCase().includes(lowerTerm)) {
			filtered = [...filtered, item];

			continue;
		}

		if (item.children === undefined) {
			continue;
		}

		const filteredChildren = filterTree(item.children, term);

		if (filteredChildren.length > 0) {
			filtered = [
				...filtered,
				{ ...item, expanded: true, children: filteredChildren },
			];
		}
	}

	return filtered;
}

function updateTreeToSetItemCheck(
	items: TreeViewItem[],
	itemId: string,
	checked: boolean,
) {
	function update(items: TreeViewItem[]): TreeViewItem[] {
		return items.map((item) => {
			if (item.id === itemId) {
				return {
					...item,
					checked,
					children:
						item.children !== undefined
							? updateAll(item.children, checked)
							: undefined,
				};
			}

			return item.children !== undefined
				? { ...item, children: update(item.children) }
				: item;
		});
	}

	function updateAll(items: TreeViewItem[], checked: boolean): TreeViewItem[] {
		return items.map((item) => {
			return {
				...item,
				checked,
				children:
					item.children !== undefined
						? updateAll(item.children, checked)
						: undefined,
			};
		});
	}

	return update(items);
}

function updateTreeToToggleItemExpansion(
	items: TreeViewItem[],
	itemId: string,
) {
	function update(items: TreeViewItem[]): TreeViewItem[] {
		return items.map((item) => {
			if (item.id === itemId) {
				if (item.children === undefined) {
					return item;
				}
				return { ...item, expanded: !item.expanded };
			}

			if (item.children === undefined) {
				return item;
			}
			return { ...item, children: update(item.children) };
		});
	}

	return update(items);
}

function updateTreeToCollapseItem(items: TreeViewItem[], itemId: string) {
	function update(items: TreeViewItem[]): TreeViewItem[] {
		return items.map((item) => {
			if (item.id === itemId) {
				return { ...item, expanded: false };
			}

			if (item.children !== undefined) {
				return { ...item, children: update(item.children) };
			}

			return item;
		});
	}

	return update(items);
}

function updateTreeToExpandItem(items: TreeViewItem[], itemId: string) {
	function update(items: TreeViewItem[]): TreeViewItem[] {
		return items.map((item) => {
			if (item.id === itemId && item.children !== undefined && !item.expanded) {
				return { ...item, expanded: true };
			}

			if (item.children !== undefined) {
				return { ...item, children: update(item.children) };
			}

			return item;
		});
	}

	return update(items);
}

function findParentItem(tree: TreeViewItem[], itemId: string) {
	function find(
		items: TreeViewItem[],
		parent: TreeViewItem | null,
	): TreeViewItem | null {
		for (const item of items) {
			if (item.id === itemId) {
				return parent;
			}

			if (item.children === undefined) {
				continue;
			}

			const resultParent = find(item.children, item);

			if (resultParent !== null) {
				return resultParent;
			}
		}

		return null;
	}

	return find(tree, null);
}

export type ColorIndicator = "unknown" | "bad" | "normal" | "good";

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
		return "";
	}

	return tRaw(titleKey);
}

export const colorIndicatorColorMap: Record<ColorIndicator, string> = {
	bad: "var(--color-bda)",
	normal: "var(--color-bno)",
	good: "var(--color-bok)",
	unknown: "var(--color-tpd)",
};

export interface TMenuTreeItem {
	id: string;
	route?: string;
	title?: string;
	/**
	 * A message key resolved through the active locale, used when `title` is not given.
	 *
	 * A plain string rather than the library's own key union, because a menu describes the consuming
	 * application and its titles live in the consumer's catalogue, not in this library's.
	 */
	titleKey?: string;
	titlePrefix?: React.ReactNode;
	titleSuffix?: React.ReactNode;
	afterTitleComponent?: React.ReactNode;
	icon?: IconName;
	subitems: TMenuTreeItem[];
	hideListIfEmpty?: boolean;
	hasRefresh?: boolean;
	onlyList?: boolean;
	hidden?: boolean;
	inactive?: boolean;
	colorIndicator?: ColorIndicator;
	onlyMobile?: boolean;
	onClick?: () => void;
	defaultSubitemsShown?: boolean;
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
	searchText = "",
	onChangeSearchText,
}: {
	readonly expanded: boolean;
	readonly width: string | number;
	readonly menuItems: TMenuTreeItem[];
	readonly currentItemId: string;
	readonly getMenuItemDepth: (menuItem: TMenuTreeItem) => number;
	readonly onItemClick: MenuTreeItemClickCallback;
	readonly onItemContextMenu?: MenuTreeItemContextMenuCallback;
	readonly onRefreshItem?: (menuItem: TMenuTreeItem) => void;
	readonly onMenuExpansionChange?: (expanded: boolean) => void;

	/**
	 * Called with the destination of an activated menu item.
	 *
	 * The tree has no router: it reports the item's `route`, or the item id when it has none, and
	 * leaves the decision of what that means to the application.
	 */
	readonly onNavigate?: (to: string) => void;
	/** See {@link IsOnPathToCurrentItem}. */
	readonly isOnPathToCurrentItem?: IsOnPathToCurrentItem;
	readonly style?: React.CSSProperties;
	readonly menuItemClassName?: string | ((menuItem: TMenuTreeItem) => string);
	readonly menuItemStyle?:
		| React.CSSProperties
		| ((menuItem: TMenuTreeItem) => React.CSSProperties);
	readonly menuItemIconStyle?: React.CSSProperties;
	readonly menuItemLabelStyle?: React.CSSProperties;
	readonly alwaysFullVersion?: boolean;
	readonly searchShown?: boolean;
	readonly searchText?: string;
	readonly onChangeSearchText?: (searchText: string) => void;
}) {
	const { tRaw } = useLocale();

	return (
		<div
			className={`
        flex flex-col bg-bpd shrink-0 overflow-hidden
        ${expanded ? "w-full sm:w-[var(--menu-tree-width)]" : ""}
      `}
			style={
				{
					"--menu-tree-width": width,
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
          ${expanded ? "overflow-x-scroll" : "overflow-x-hidden"}
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
	| "branchEndConnector"
	// '|---' (used for items that have siblings)
	| "branchConnector"
	// '    ' (used for the last item's indentation, no actual element)
	| "spacePadding"
	// '|   ' (used for items that have siblings)
	| "verticalConnector";

const branchEndConnector: TreeLevelBlockType = "branchEndConnector";
const branchConnector: TreeLevelBlockType = "branchConnector";

export type MenuTreeItemClickHandlerResult = "default" | "deny";

export type MenuTreeItemClickCallback = ({
	menuItem,
	subitemsShown,
	event,
}: {
	readonly menuItem: TMenuTreeItem;
	readonly subitemsShown: boolean;
	readonly event: React.MouseEvent<HTMLDivElement>;
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
	readonly onContextMenu?: MenuTreeItemContextMenuCallback;
	readonly onRefresh?: (item: TMenuTreeItem) => void;
	readonly onMenuExpansionChange?: (expanded: boolean) => void;

	/**
	 * Called with the destination of an activated menu item.
	 *
	 * The tree has no router: it reports the item's `route`, or the item id when it has none, and
	 * leaves the decision of what that means to the application.
	 */
	readonly onNavigate?: (to: string) => void;
	/** See {@link IsOnPathToCurrentItem}. */
	readonly isOnPathToCurrentItem?: IsOnPathToCurrentItem;
	readonly menuItemClassName?: string | ((menuItem: TMenuTreeItem) => string);
	readonly menuItemStyle?:
		| React.CSSProperties
		| ((menuItem: TMenuTreeItem) => React.CSSProperties);
	readonly menuItemIconStyle?: React.CSSProperties;
	readonly menuItemLabelStyle?: React.CSSProperties;
	readonly alwaysFullVersion?: boolean;
	readonly last?: boolean;
	readonly treeLevelBlockTypes?: readonly TreeLevelBlockType[];
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

	const [subitemsShown, setSubitemsShown] = useState(
		actualDefaultSubitemsShown,
	);

	useEffect(() => {
		setSubitemsShown(actualDefaultSubitemsShown);
	}, [actualDefaultSubitemsShown]);

	const level = getMenuItemDepth(item);

	const hasSubitems = subitems.length > 0;
	const isList = hasSubitems || onlyList;
	const isHidden =
		hidden ||
		(onlyMobile && !isMobileScreen) ||
		(hideListIfEmpty && isList && !hasSubitems);

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
		(isOnPathToCurrentItem(id, currentItemId) &&
			(!subitemsShown || !expanded || isEmptyList));

	function handleClick(event: React.MouseEvent<HTMLDivElement>) {
		if (inactive) {
			return;
		}

		const result = onClick({
			menuItem: item,
			subitemsShown,
			event,
		});

		if (result !== "default") {
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
					fill: "var(--color-tpd)",
					width: "1rem",
					height: "1rem",
					flexShrink: 0,
					marginLeft: level > 0 ? "0.75rem" : "0.5rem",
					...(!subitemsShown && { transform: "rotate(-90deg)" }),
				}}
			/>
		);
	}

	function getStyle(): React.CSSProperties {
		if (!menuItemStyle) {
			return {};
		}

		if (typeof menuItemStyle === "object") {
			return menuItemStyle;
		}

		return menuItemStyle(item);
	}

	const levelXFactor = 36;

	return (
		<>
			<div
				tabIndex={0}
				className={`
          relative flex select-none items-center overflow-hidden text-left
          ${inactive ? "text-tpd" : "text-tpl hover:bg-bse cursor-pointer"}
          ${expanded ? "h-10 w-full pr-1" : "aspect-square rounded-full p-2"}
          ${selected && "bg-bse"}
          ${menuItemClassName}
        `}
				style={{
					paddingLeft: level * levelXFactor,
					...getStyle(),
				}}
				onClick={handleClick}
				onContextMenu={handleContextMenu}
			>
				{!inactive && <Ripple color="var(--color-ripple-button)" />}
				<div className="absolute left-0 top-0 h-full">
					{level > 0 &&
						[
							...treeLevelBlockTypes,
							last ? branchEndConnector : branchConnector,
						].map((type, index) => {
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
								case "branchEndConnector": {
									return (
										<div
											key={index}
											className={`
                        border-b-tpd border-l-tpd absolute top-0 h-3/6 border-b-2 border-l-2
                        ${fullWidth ? "w-7" : "w-2"}
                      `}
											style={style}
										/>
									);
								}

								case "branchConnector": {
									return (
										<div
											key={index}
											className="absolute top-0 h-full"
											style={style}
										>
											<div
												className={`
                          border-b-tpd border-l-tpd h-3/6 border-b-2 border-l-2
                          ${fullWidth ? "w-7" : "w-2"}
                        `}
											/>
											<div className="border-l-tpd h-3/6 border-l-2" />
										</div>
									);
								}

								case "spacePadding": {
									return null;
								}

								case "verticalConnector": {
									return (
										<div
											key={index}
											className="border-l-tpd absolute top-0 h-full border-l-2"
											style={style}
										/>
									);
								}
							}
						})}
				</div>
				{expanded && listCollapseStatusIcon}
				{icon !== undefined && (
					<Icon
						name={icon}
						style={{
							marginLeft: "0.5rem",
							width: "1.75rem",
							height: "1.75rem",
							flexShrink: 0,
							fill:
								!expanded && colorIndicator !== undefined
									? colorIndicatorColorMap[colorIndicator]
									: "var(--color-tpl)",
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
							title={t("MenuTree.MenuTreeItem.refreshMenuItem")}
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
								index === subitems.length - 1
									? "spacePadding"
									: "verticalConnector",
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

			const title =
				resolveItemTitle(
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

			const found = buildMenuItemFullTitleByItsId(menuTreeItem.subitems, id, [
				...path,
				title,
			]);
			if (found) {
				return found;
			}
		} else {
			const treeViewItem = item as TreeViewItem;

			const title = treeViewItem.label;

			if (treeViewItem.id === id) {
				return [...path, title];
			}

			if (
				treeViewItem.children === undefined ||
				treeViewItem.children.length === 0
			) {
				continue;
			}

			const found = buildMenuItemFullTitleByItsId(treeViewItem.children, id, [
				...path,
				title,
			]);
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
