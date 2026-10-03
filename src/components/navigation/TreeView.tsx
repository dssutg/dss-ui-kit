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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconButton } from '@/components/buttons/IconButton';
import { Icon, type IconName } from '@/components/display/Icon';
import { Checkbox } from '@/components/inputs/Checkbox';
import { SearchInput } from '@/components/inputs/SearchInput';
import { VirtualizedList } from '@/components/inputs/VirtualizedList';
import { AutoSizer } from '@/components/layout/AutoSizer';
import { clamp } from '@/lib/math';
import { useGranularEffect } from '@/lib/use_granular_effect';

/**
 * One item in a {@link TreeView}.
 *
 * The tree holds a flat list of these with `level` and `expanded` set on every row, which is what
 * makes a tree of ten thousand rows renderable: the component flattens the caller's nested `children`
 * and collapses it back before reporting a change.
 */
export interface TreeViewItem {
  id: string;
  labelPrefix?: React.ReactNode | undefined;
  label: string;
  labelSuffix?: React.ReactNode | undefined;
  loading?: boolean | undefined;
  icon?: IconName | undefined;
  children?: TreeViewItem[] | undefined;
  expanded?: boolean | undefined;
  checked?: boolean | undefined;
  level?: number | undefined;
  onDragOver?: (e: DragEvent) => void;
  onDrop?: (e: DragEvent) => void;
}

/**
 * A virtualized tree of items with selection, expansion, type-ahead and drag and drop.
 *
 * It keeps the tree the caller's: `setTree` receives the whole tree back with one item changed, and
 * nothing is held internally except what is derived — the flat visible list, the type-ahead buffer,
 * and the search text when `hasSearch` is on. Rows are fixed height, which is what the virtualization
 * arithmetic needs and why `itemHeight` is a prop.
 */
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
  readonly hasSearch?: boolean | undefined;
  readonly levelPaddingPixels?: number | undefined;
  readonly itemHeight?: number | undefined;
  readonly className?: string | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly itemClassName?: string | undefined;
  readonly itemStyle?: React.CSSProperties | undefined;
  readonly itemLabelStyle?: React.CSSProperties | undefined;
  readonly itemIconStyle?: React.CSSProperties | undefined;
  readonly onItemExpansionChange?: (itemId: string, expanded: boolean) => void;
  readonly overScanCount?: number | undefined;
  readonly onDragOver?: (e: DragEvent) => void;
  readonly onKeyDown?: (e: KeyboardEvent) => void;
  readonly onCopy?: (e: ClipboardEvent) => void;
  readonly onCut?: (e: ClipboardEvent) => void;
  readonly onPaste?: (e: ClipboardEvent) => void;
}) {
  const [typeAheadBuffer, setTypeAheadBuffer] = useState<string>('');

  const [searchText, setSearchText] = useState<string>('');

  const itemIdToElementMap = useRef<Record<string, HTMLDivElement | null>>({});

  const typeAheadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const listRef = useRef<HTMLDivElement>(null);

  const visibleItemFlatList = useMemo(() => {
    if (hasSearch && searchText !== '') {
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

    element?.scrollIntoView({ behavior: 'instant', block: 'nearest' });
  }, [selectedItemId]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      onKeyDown?.(e);

      if (isEventFromAnotherInput(e)) {
        // Don't intervene with another input's events
        return;
      }

      if (visibleItemFlatList.length === 0) {
        return;
      }

      const currentIndex = visibleItemFlatList.findIndex((item) => item.id === selectedItemId);
      const currentItem = visibleItemFlatList[currentIndex];

      // Reset typeahead timer after a delay
      const resetTypeAhead = () => {
        if (typeAheadTimeoutRef.current !== null) {
          clearTimeout(typeAheadTimeoutRef.current);
        }
        typeAheadTimeoutRef.current = setTimeout(() => setTypeAheadBuffer(''), 500);
      };

      const selectItemAtIndex = (index: number) => {
        const item = visibleItemFlatList[index];

        if (item !== undefined) {
          onSelectedItemIdChange(item.id);
        }
      };

      const moveSelectionUp = () => {
        e.preventDefault();

        selectItemAtIndex(clamp(currentIndex - 1, 0, visibleItemFlatList.length - 1));
      };

      const moveSelectionDown = () => {
        e.preventDefault();

        selectItemAtIndex(clamp(currentIndex + 1, 0, visibleItemFlatList.length - 1));
      };

      // Collapse if possible; if already collapsed, move to parent
      const collapseOrSelectParent = () => {
        if (selectedItemId === null) {
          return;
        }

        if (
          currentItem !== undefined &&
          currentItem.children !== undefined &&
          currentItem.expanded
        ) {
          // Try collapsing current item if expanded
          setTree(updateTreeToCollapseItem(tree, selectedItemId));
          onItemExpansionChange?.(selectedItemId, false);

          return;
        }

        // If already collapsed, select parent
        const parent = findParentItem(tree, selectedItemId);

        if (parent !== null) {
          onSelectedItemIdChange(parent.id);
        }
      };

      const expandSelectedItem = () => {
        if (selectedItemId === null) {
          return;
        }

        // Expand if possible
        setTree(updateTreeToExpandItem(tree, selectedItemId));
        onItemExpansionChange?.(selectedItemId, true);
      };

      // Typeahead: if a character is an alphanumeric letter, accumulate it and search
      const searchByTypeAhead = (key: string) => {
        if (!isTypeAheadCharacter(key)) {
          return;
        }

        const newTypeAhead = `${typeAheadBuffer}${key.toLowerCase()}`;

        setTypeAheadBuffer(newTypeAhead);

        const trySelectNextFoundItem = (aheadFlatList: TreeViewItem[]) => {
          // Look for the first item starting with the typeahead buffer
          const found = aheadFlatList.find((item) =>
            item.label.trim().toLowerCase().startsWith(newTypeAhead),
          );

          const success = found !== undefined;

          if (success) {
            onSelectedItemIdChange(found.id);
          }

          return success;
        };

        if (currentIndex === -1) {
          trySelectNextFoundItem(visibleItemFlatList);
        } else {
          const success = trySelectNextFoundItem(visibleItemFlatList.slice(currentIndex + 1));

          if (!success) {
            trySelectNextFoundItem(visibleItemFlatList);
          }
        }

        resetTypeAhead();
      };

      resetTypeAhead();

      switch (e.key) {
        case 'ArrowUp': {
          moveSelectionUp();

          break;
        }

        case 'ArrowDown': {
          moveSelectionDown();

          break;
        }

        case 'ArrowLeft': {
          e.preventDefault();
          collapseOrSelectParent();

          break;
        }

        case 'ArrowRight': {
          e.preventDefault();
          expandSelectedItem();

          break;
        }

        default: {
          searchByTypeAhead(e.key);

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

  // Shared by the double click and the expansion button, so the tree update is written once.
  const toggleExpansion = useCallback(
    (item: TreeViewItem) => {
      setTree(updateTreeToToggleItemExpansion(tree, item.id));
      onItemExpansionChange?.(item.id, !item.expanded);
    },
    [tree, setTree, onItemExpansionChange],
  );

  const handleItemDoubleClick = useCallback(
    (item: TreeViewItem, event: React.MouseEvent<HTMLDivElement>) => {
      event.stopPropagation();
      event.preventDefault();

      toggleExpansion(item);
    },
    [toggleExpansion],
  );

  // The arrow keys and typeahead belong to the tree as a whole and are handled
  // by the root. Activation is per item, so it is handled here and kept from
  // bubbling: `handleKeyDown` treats any single character as typeahead.
  const handleTreeItemKeyDown = (item: TreeViewItem, e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    onSelectedItemIdChange(item.id);
  };

  const getTreeItemRowClassName = (item: TreeViewItem) => {
    const loading = item.loading ?? false;

    return `
      flex p-1 select-none
      ${!loading && selectedItemId === item.id ? 'bg-bse' : ''}
      ${loading ? 'brightness-75 animate-pulse pointer-events-none' : 'cursor-pointer'}
      ${itemClassName}
    `;
  };

  // An item without children gets a spacer instead of the button, so that every label starts at
  // the same offset.
  const renderExpansionToggle = (item: TreeViewItem) => {
    if (item.children === undefined) {
      return <div className="size-4 mr-2 shrink-0" />;
    }

    return (
      <IconButton
        icon="triangleDown"
        iconClassName={`
          fill-tpd size-4
          ${!item.expanded ? '-rotate-90' : ''}
        `}
        className="mr-2 shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          toggleExpansion(item);
        }}
        onDblClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
      />
    );
  };

  const renderItemIcon = (item: TreeViewItem) => {
    if (item.icon === undefined) {
      return null;
    }

    return (
      <Icon
        name={item.icon}
        style={{
          marginLeft: '0.5rem',
          width: '1.75rem',
          height: '1.75rem',
          flexShrink: 0,
          ...itemIconStyle,
        }}
      />
    );
  };

  const renderItemLabel = (item: TreeViewItem) => {
    return (
      <div className="truncate" style={itemLabelStyle}>
        {item.checked !== undefined ? (
          <Checkbox
            checked={item.checked}
            onChange={(checked) => {
              setTree(updateTreeToSetItemCheck(tree, item.id, checked));
            }}
            label={item.label}
          />
        ) : (
          item.label
        )}
      </div>
    );
  };

  return (
    // `role="tree"` with a single `tabIndex={0}` is the composite-widget pattern: the tree takes
    // focus once and the arrow keys move between items inside it, which is what `handleKeyDown`
    // implements against `selectedItemId`.
    <div
      tabIndex={0}
      role="tree"
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
            inputStyle={{ width: '100%' }}
          />
        </div>
      )}
      <div className="flex flex-col flex-grow">
        <AutoSizer style={{ width: '100%', flexGrow: 1 }}>
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

                  return (
                    <div key={item.id} style={style}>
                      <div
                        ref={(element) => {
                          itemIdToElementMap.current[item.id] = element;
                        }}
                        role="treeitem"
                        // Roving tabindex: the selected item is the one in the tab order, so Tab
                        // enters the tree once and the arrow keys move within it.
                        tabIndex={selectedItemId === item.id ? 0 : -1}
                        aria-level={item.level ?? 0}
                        aria-selected={selectedItemId === item.id}
                        aria-expanded={item.children !== undefined ? item.expanded : undefined}
                        onClick={() => {
                          onSelectedItemIdChange(item.id);
                        }}
                        onDblClick={(e) => {
                          handleItemDoubleClick(item, e);
                        }}
                        onKeyDown={(e) => {
                          handleTreeItemKeyDown(item, e);
                        }}
                        onDragOver={item.onDragOver}
                        onDrop={item.onDrop}
                        className={getTreeItemRowClassName(item)}
                        style={{
                          paddingLeft: (item.level ?? 0) * levelPaddingPixels,
                          ...itemStyle,
                        }}
                      >
                        {renderExpansionToggle(item)}
                        {renderItemIcon(item)}
                        {item.labelPrefix}
                        {renderItemLabel(item)}
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

function isEventFromAnotherInput(e: KeyboardEvent) {
  const targetTagName = (e.target as HTMLElement | undefined)?.tagName;

  return targetTagName === 'INPUT' || targetTagName === 'TEXTAREA';
}

function isTypeAheadCharacter(key: string) {
  return key.length === 1 && /\S/.test(key);
}

function getVisibleItemFlatList(items: TreeViewItem[], level = 0, parentLoading = false) {
  let results: TreeViewItem[] = [];

  for (const item of items) {
    const itemLoading = (item.loading ?? false) || parentLoading;

    results.push({
      ...item,
      level,
      loading: itemLoading,
    });

    if (item.children !== undefined && item.expanded) {
      results = [...results, ...getVisibleItemFlatList(item.children, level + 1, itemLoading)];
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
      filtered = [...filtered, { ...item, expanded: true, children: filteredChildren }];
    }
  }

  return filtered;
}

function updateTreeToSetItemCheck(items: TreeViewItem[], itemId: string, checked: boolean) {
  function update(items: TreeViewItem[]): TreeViewItem[] {
    return items.map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          checked,
          children: item.children !== undefined ? updateAll(item.children, checked) : undefined,
        };
      }

      return item.children !== undefined ? { ...item, children: update(item.children) } : item;
    });
  }

  function updateAll(items: TreeViewItem[], checked: boolean): TreeViewItem[] {
    return items.map((item) => {
      return {
        ...item,
        checked,
        children: item.children !== undefined ? updateAll(item.children, checked) : undefined,
      };
    });
  }

  return update(items);
}

function updateTreeToToggleItemExpansion(items: TreeViewItem[], itemId: string) {
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
  function find(items: TreeViewItem[], parent: TreeViewItem | null): TreeViewItem | null {
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

/**
 * The status a coloured dot next to an item reports.
 *
 * `unknown` is a real state and not a default: it is what an item whose status has not been read yet
 * shows, so "not yet known" and "no problem" do not look the same.
 */
export type ColorIndicator = 'unknown' | 'bad' | 'normal' | 'good';

/**
 * The token each {@link ColorIndicator} is drawn with, so a dot and a status badge agree.
 *
 * The values are CSS custom properties rather than literals, which is what lets an indicator be
 * correct in every theme without a second map per theme.
 */
export const colorIndicatorColorMap: Record<ColorIndicator, string> = {
  bad: 'var(--color-bda)',
  normal: 'var(--color-bno)',
  good: 'var(--color-bok)',
  unknown: 'var(--color-tpd)',
};
