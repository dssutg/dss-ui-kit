// @vitest-environment jsdom

import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildMenuItemFullTitleByItsId,
  findMenuItemById,
  type IsOnPathToCurrentItem,
  MenuTree,
  type MenuTreeItemClickCallback,
  type TMenuTreeItem,
} from '@/components/navigation/MenuTree';
import { TreeView, type TreeViewItem } from '@/components/navigation/TreeView';
import { act, click, flush, render, type } from '@/util/testing/render';

type TreeViewComponentProps = React.ComponentProps<typeof TreeView>;
type MenuTreeComponentProps = React.ComponentProps<typeof MenuTree>;

const originalInnerWidth = window.innerWidth;

afterEach(() => {
  window.innerWidth = originalInnerWidth;
  document.documentElement.setAttribute('lang', 'en');
});

/** How many elements in the document match `selector`, which is how an absence is asserted. */
function count(selector: string): number {
  return document.body.querySelectorAll(selector).length;
}

/** The element at `index`, failing loudly rather than returning an optional a test then reads. */
function at<T>(items: readonly T[], index: number): T {
  const value = items[index];

  if (value === undefined) {
    throw new Error(`no element at index ${index}.`);
  }

  return value;
}

/** A dblclick Preact's synthetic system sees, dispatched the way a real one is. */
function doubleClick(element: Element): void {
  act(() => {
    element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
  });
}

/** Dispatches an event the tree's own handlers listen for. */
function fire(element: Element, type: string): void {
  act(() => {
    element.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
  });
}

/** Dispatches a keydown, which is how the tree's navigation is driven. */
function keyDown(element: Element, key: string): void {
  act(() => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });
}

/** Dispatches a mouse event the item handlers listen for. */
function fireMouse(element: Element, type: string): void {
  act(() => {
    element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
  });
}

type TreeViewHarnessProps = {
  readonly initialTree: TreeViewItem[];
  readonly initialSelectedItemId?: string | null;
} & Omit<TreeViewComponentProps, 'tree' | 'setTree' | 'selectedItemId' | 'onSelectedItemIdChange'>;

/**
 * The tree as a caller holds it: it keeps the tree and hands it back, so an expansion the component
 * reports is one this harness re-renders, which is what an assertion on the next tree needs.
 */
function TreeViewHarness({
  initialTree,
  initialSelectedItemId = null,
  ...rest
}: TreeViewHarnessProps) {
  const [tree, setTree] = useState(initialTree);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(initialSelectedItemId);

  return (
    <TreeView
      tree={tree}
      setTree={setTree}
      selectedItemId={selectedItemId}
      onSelectedItemIdChange={setSelectedItemId}
      {...rest}
    />
  );
}

const expandableTree: TreeViewItem[] = [
  {
    id: 'group',
    label: 'Group',
    icon: 'alphabet',
    expanded: true,
    children: [
      { id: 'leaf', label: 'Leaf' },
      { id: 'lemon', label: 'Lemon' },
    ],
  },
  { id: 'solo', label: 'Solo' },
];

function firstTreeItem(): HTMLElement {
  return at(Array.from(document.body.querySelectorAll<HTMLElement>('[role="treeitem"]')), 0);
}

describe('TreeView rendering', () => {
  it('renders every visible row and applies the styling props it was given', async () => {
    const { findAll, find } = await render(
      <TreeViewHarness
        initialTree={[
          {
            id: 'group',
            label: 'Group',
            labelPrefix: <span>Pre</span>,
            labelSuffix: <span>Post</span>,
            expanded: true,
            icon: 'alphabet',
            children: [{ id: 'leaf', label: 'Leaf' }],
          },
        ]}
        levelPaddingPixels={12}
        itemHeight={30}
        itemClassName="my-item"
        className="my-tree"
        style={{ width: '10px' }}
        itemStyle={{ color: 'red' }}
        itemLabelStyle={{ fontWeight: 'bold' }}
        itemIconStyle={{ opacity: '0.5' }}
      />,
    );

    const rows = findAll<HTMLElement>('[role="treeitem"]');

    expect(rows).toHaveLength(2);
    expect(find('div.my-tree').className).toContain('my-tree');
    expect(find('div.my-item').className).toContain('my-item');
    expect(at(rows, 1).style.paddingLeft).toBe('12px');
    expect(document.body.textContent).toContain('Pre');
    expect(document.body.textContent).toContain('Post');
  });

  it('shows a row as loading, which follows its ancestors and disables the pointer', async () => {
    const { findAll } = await render(
      <TreeViewHarness
        initialTree={[
          {
            id: 'parent',
            label: 'Loading parent',
            loading: true,
            expanded: true,
            children: [{ id: 'child', label: 'Child', loading: false }],
          },
        ]}
      />,
    );

    const rows = findAll<HTMLElement>('[role="treeitem"]');

    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(at(rows, 0).className).toContain('animate-pulse');
    expect(at(rows, 1).className).toContain('animate-pulse');
  });

  it('reports the selection rather than moving it', async () => {
    const { findAll } = await render(<TreeViewHarness initialTree={expandableTree} />);

    const rows = findAll<HTMLElement>('[role="treeitem"]');

    await click(at(rows, 0));

    expect(at(rows, 0).getAttribute('aria-selected')).toBe('true');
    expect(at(rows, 0).getAttribute('tabindex')).toBe('0');
  });

  it('gives a row without children a spacer rather than an expansion control', async () => {
    const { findAll } = await render(
      <TreeViewHarness
        initialTree={[
          {
            id: 'group',
            label: 'Group',
            expanded: true,
            children: [{ id: 'leaf', label: 'Leaf' }],
          },
        ]}
      />,
    );

    // One expansion button, on the parent only; the leaf carries no button of its own.
    expect(findAll('button')).toHaveLength(1);
  });

  it('renders a row that has no icon and one that has none, with the caller classes merged', async () => {
    const { findAll } = await render(
      <TreeViewHarness
        initialTree={[
          { id: 'plain', label: 'No icon', icon: undefined },
          { id: 'checked', label: 'Checked', checked: false },
        ]}
      />,
    );

    expect(findAll<HTMLElement>('[role="treeitem"]')).toHaveLength(2);
  });

  it('applies a custom scan count and a zero level without changing what is visible', async () => {
    const { findAll } = await render(
      <TreeViewHarness initialTree={expandableTree} overScanCount={2} itemHeight={40} />,
    );

    expect(findAll<HTMLElement>('[role="treeitem"]')).toHaveLength(4);
  });
});

describe('TreeView keyboard navigation', () => {
  it('moves the selection down and up and clamps at both ends', async () => {
    const onKeyDown = vi.fn();
    const { findAll, find } = await render(
      <TreeViewHarness initialTree={expandableTree} onKeyDown={onKeyDown} />,
    );

    const root = find('[role="tree"]');

    keyDown(root, 'ArrowDown');
    expect(firstTreeItem().getAttribute('aria-selected')).toBe('true');

    // At the top already, so ArrowUp stays on the first row.
    keyDown(root, 'ArrowUp');
    expect(firstTreeItem().getAttribute('aria-selected')).toBe('true');

    keyDown(root, 'ArrowDown');
    keyDown(root, 'ArrowDown');
    keyDown(root, 'ArrowDown');
    keyDown(root, 'ArrowDown');
    // Past the last row, the clamp keeps the selection on it.
    expect(at(findAll<HTMLElement>('[role="treeitem"]'), 3).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(onKeyDown).toHaveBeenCalledTimes(6);
  });

  it('expands with ArrowRight and collapses with ArrowLeft', async () => {
    const onItemExpansionChange = vi.fn();
    const { findAll, find } = await render(
      <TreeViewHarness
        initialTree={[
          { id: 'plain', label: 'Plain' },
          {
            id: 'group',
            label: 'Group',
            expanded: false,
            children: [{ id: 'leaf', label: 'Leaf' }],
          },
          { id: 'branch', label: 'Branch', children: [{ id: 'twig', label: 'Twig' }] },
        ]}
        initialSelectedItemId="group"
        onItemExpansionChange={onItemExpansionChange}
      />,
    );

    const root = find('[role="tree"]');

    keyDown(root, 'ArrowRight');
    expect(findAll<HTMLElement>('[role="treeitem"]')).toHaveLength(4);
    expect(onItemExpansionChange).toHaveBeenCalledWith('group', true);

    keyDown(root, 'ArrowLeft');
    expect(findAll<HTMLElement>('[role="treeitem"]')).toHaveLength(3);
    expect(onItemExpansionChange).toHaveBeenLastCalledWith('group', false);
  });

  it('selects the parent when the selected collapsed row has no children to collapse', async () => {
    const { findAll, find } = await render(
      <TreeViewHarness initialTree={expandableTree} initialSelectedItemId="leaf" />,
    );

    keyDown(find('[role="tree"]'), 'ArrowLeft');

    expect(at(findAll<HTMLElement>('[role="treeitem"]'), 0).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('leaves the selection unchanged on ArrowLeft for a top-level row with no parent', async () => {
    const { findAll, find } = await render(
      <TreeViewHarness initialTree={expandableTree} initialSelectedItemId="solo" />,
    );

    keyDown(find('[role="tree"]'), 'ArrowLeft');

    expect(at(findAll<HTMLElement>('[role="treeitem"]'), 3).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('ignores ArrowRight and ArrowLeft when nothing is selected', async () => {
    const { find } = await render(<TreeViewHarness initialTree={expandableTree} />);

    keyDown(find('[role="tree"]'), 'ArrowRight');
    keyDown(find('[role="tree"]'), 'ArrowLeft');

    expect(count('[aria-selected="true"]')).toBe(0);
  });

  it('ignores the arrow keys when the tree has nothing to move through', async () => {
    const { find } = await render(<TreeViewHarness initialTree={[]} />);

    keyDown(find('[role="tree"]'), 'ArrowDown');

    expect(document.body.querySelectorAll('[role="treeitem"]')).toHaveLength(0);
  });

  it('leaves a keypress from another input alone', async () => {
    const onKeyDown = vi.fn();
    const { find } = await render(
      <TreeViewHarness initialTree={expandableTree} hasSearch={true} onKeyDown={onKeyDown} />,
    );

    keyDown(find('[role="combobox"]'), 'a');

    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it('leaves a keypress from a textarea alone', async () => {
    const { find } = await render(<TreeViewHarness initialTree={expandableTree} />);

    const root = find('[role="tree"]');
    const textarea = document.createElement('textarea');

    root.appendChild(textarea);
    keyDown(textarea, 'a');
    textarea.remove();

    expect(root).toBeDefined();
  });

  it('selects an item on Enter and on Space, and ignores other keys', async () => {
    const { findAll } = await render(<TreeViewHarness initialTree={expandableTree} />);

    const row = at(findAll<HTMLElement>('[role="treeitem"]'), 1);

    keyDown(row, 'a');
    expect(count('[aria-selected="true"]')).toBe(0);

    keyDown(row, 'Enter');
    expect(row.getAttribute('aria-selected')).toBe('true');

    keyDown(at(findAll<HTMLElement>('[role="treeitem"]'), 2), ' ');
    expect(at(findAll<HTMLElement>('[role="treeitem"]'), 2).getAttribute('aria-selected')).toBe(
      'true',
    );
  });
});

describe('TreeView typeahead', () => {
  it('selects the first item whose label starts with the accumulated letters', async () => {
    const { findAll, find } = await render(<TreeViewHarness initialTree={expandableTree} />);

    const root = find('[role="tree"]');

    // Nothing selected: the whole list is searched.
    keyDown(root, 'l');
    expect(at(findAll<HTMLElement>('[role="treeitem"]'), 1).getAttribute('aria-selected')).toBe(
      'true',
    );

    // A second letter accumulates onto the buffer and narrows the match.
    keyDown(root, 'e');
    expect(at(findAll<HTMLElement>('[role="treeitem"]'), 2).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('searches past the current item rather than from the top', async () => {
    const { findAll, find } = await render(
      <TreeViewHarness initialTree={expandableTree} initialSelectedItemId="leaf" />,
    );

    keyDown(find('[role="tree"]'), 'l');

    // `lemon` follows `leaf`, so it is picked without wrapping to the earlier match.
    expect(at(findAll<HTMLElement>('[role="treeitem"]'), 2).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('wraps back to the top when nothing after the selection matches', async () => {
    const { find } = await render(
      <TreeViewHarness initialTree={expandableTree} initialSelectedItemId="lemon" />,
    );

    keyDown(find('[role="tree"]'), 'g');

    expect(firstTreeItem().getAttribute('aria-selected')).toBe('true');
  });

  it('keeps the selection when no item matches, and ignores keys that are not typeahead', async () => {
    const { findAll, find } = await render(
      <TreeViewHarness initialTree={expandableTree} initialSelectedItemId="leaf" />,
    );

    const root = find('[role="tree"]');

    keyDown(root, 'z');
    expect(at(findAll<HTMLElement>('[role="treeitem"]'), 1).getAttribute('aria-selected')).toBe(
      'true',
    );

    keyDown(root, 'Control');
    expect(at(findAll<HTMLElement>('[role="treeitem"]'), 1).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('clears its pending typeahead on unmount', async () => {
    const { find, unmount } = await render(<TreeViewHarness initialTree={expandableTree} />);

    keyDown(find('[role="tree"]'), 'l');
    keyDown(find('[role="tree"]'), 'e');

    unmount();
  });

  it('drops the accumulated letters after the reset delay', async () => {
    const { findAll, find } = await render(<TreeViewHarness initialTree={expandableTree} />);

    const root = find('[role="tree"]');

    keyDown(root, 'l');
    expect(at(findAll<HTMLElement>('[role="treeitem"]'), 1).getAttribute('aria-selected')).toBe(
      'true',
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    // With the buffer reset, `s` selects `solo` on its own rather than searching for `ls`.
    keyDown(root, 's');
    expect(at(findAll<HTMLElement>('[role="treeitem"]'), 3).getAttribute('aria-selected')).toBe(
      'true',
    );
  });
});

describe('TreeView expansion', () => {
  it('reports a double-clicked row as expanded or collapsed', async () => {
    const onItemExpansionChange = vi.fn();
    const { findAll } = await render(
      <TreeViewHarness
        initialTree={[
          { id: 'plain', label: 'Plain' },
          {
            id: 'group',
            label: 'Group',
            expanded: false,
            children: [{ id: 'leaf', label: 'Leaf' }],
          },
          { id: 'branch', label: 'Branch', children: [{ id: 'twig', label: 'Twig' }] },
        ]}
        onItemExpansionChange={onItemExpansionChange}
      />,
    );

    await doubleClick(at(findAll<HTMLElement>('[role="treeitem"]'), 1));

    expect(onItemExpansionChange).toHaveBeenCalledWith('group', true);
    expect(findAll<HTMLElement>('[role="treeitem"]')).toHaveLength(4);
  });

  it('leaves a leaf unchanged when it is double-clicked', async () => {
    const onItemExpansionChange = vi.fn();
    const { findAll } = await render(
      <TreeViewHarness
        initialTree={[
          { id: 'plain', label: 'Plain' },
          { id: 'group', label: 'Group', children: [{ id: 'leaf', label: 'Leaf' }] },
        ]}
        onItemExpansionChange={onItemExpansionChange}
      />,
    );

    await doubleClick(at(findAll<HTMLElement>('[role="treeitem"]'), 0));

    expect(onItemExpansionChange).toHaveBeenCalledWith('plain', true);
  });

  it('toggles a row from its own expansion control without selecting it', async () => {
    const onItemExpansionChange = vi.fn();
    const { findAll } = await render(
      <TreeViewHarness
        initialTree={[
          {
            id: 'group',
            label: 'Group',
            expanded: false,
            children: [{ id: 'leaf', label: 'Leaf' }],
          },
        ]}
        onItemExpansionChange={onItemExpansionChange}
      />,
    );

    const toggle = at(findAll<HTMLButtonElement>('button'), 0);

    await click(toggle);

    expect(onItemExpansionChange).toHaveBeenCalledWith('group', true);

    doubleClick(toggle);
  });
});

describe('TreeView search', () => {
  const searchTree: TreeViewItem[] = [
    {
      id: 'alpha',
      label: 'Alpha',
      children: [
        { id: 'alpine', label: 'Alpine' },
        { id: 'beta', label: 'Beta' },
      ],
    },
    { id: 'gamma', label: 'Gamma', children: [{ id: 'delta', label: 'Delta' }] },
    { id: 'zeta', label: 'Zeta' },
  ];

  it('shows the matches and the expanded ancestors on the way to them', async () => {
    const { findAll, find } = await render(
      <TreeViewHarness initialTree={searchTree} hasSearch={true} />,
    );

    await type(find<HTMLInputElement>('[role="combobox"]'), 'beta');

    const rows = findAll<HTMLElement>('[role="treeitem"]');

    expect(rows).toHaveLength(2);
    expect(document.body.textContent).toContain('Beta');
    expect(document.body.textContent).not.toContain('Delta');
  });

  it('keeps a matched ancestor as it was rather than expanding it', async () => {
    const { findAll, find } = await render(
      <TreeViewHarness initialTree={searchTree} hasSearch={true} />,
    );

    await type(find<HTMLInputElement>('[role="combobox"]'), 'alp');

    const rows = findAll<HTMLElement>('[role="treeitem"]');

    expect(rows).toHaveLength(1);
    expect(document.body.textContent).toContain('Alpha');
    expect(document.body.textContent).not.toContain('Alpine');
  });

  it('renders no list at all when the term matches nothing', async () => {
    const { findAll, find, query } = await render(
      <TreeViewHarness initialTree={searchTree} hasSearch={true} />,
    );

    await type(find<HTMLInputElement>('[role="combobox"]'), 'nothing');

    expect(query('[role="treeitem"]')).toBeNull();

    await type(find<HTMLInputElement>('[role="combobox"]'), '');
    await flush();

    expect(findAll<HTMLElement>('[role="treeitem"]')).toHaveLength(3);
  });
});

describe('TreeView checkbox, drag and drop, and clipboard', () => {
  it('reports a checked item with its children checked too', async () => {
    const setTree = vi.fn();
    const tree: TreeViewItem[] = [
      {
        id: 'parent',
        label: 'Parent',
        checked: false,
        children: [{ id: 'child', label: 'Child' }],
      },
    ];

    const { find } = await render(
      <TreeView
        tree={tree}
        setTree={setTree}
        selectedItemId={null}
        onSelectedItemIdChange={() => undefined}
      />,
    );

    await click(find<HTMLInputElement>('input[type="checkbox"]'));

    expect(setTree).toHaveBeenCalledWith([
      {
        id: 'parent',
        label: 'Parent',
        checked: true,
        children: [{ id: 'child', label: 'Child', checked: true }],
      },
    ]);
  });

  it('checks a nested item and walks past siblings that do not match', async () => {
    const setTree = vi.fn();
    const tree: TreeViewItem[] = [
      { id: 'plain', label: 'Plain' },
      { id: 'branch', label: 'Branch', children: [{ id: 'twig', label: 'Twig' }] },
      {
        id: 'target',
        label: 'Target',
        checked: false,
        children: [{ id: 'kid', label: 'Kid', children: [{ id: 'grand', label: 'Grand' }] }],
      },
    ];

    const { find } = await render(
      <TreeView
        tree={tree}
        setTree={setTree}
        selectedItemId={null}
        onSelectedItemIdChange={() => undefined}
      />,
    );

    await click(find<HTMLInputElement>('input[type="checkbox"]'));

    expect(setTree).toHaveBeenCalledWith([
      { id: 'plain', label: 'Plain' },
      { id: 'branch', label: 'Branch', children: [{ id: 'twig', label: 'Twig' }] },
      {
        id: 'target',
        label: 'Target',
        checked: true,
        children: [
          {
            id: 'kid',
            label: 'Kid',
            checked: true,
            children: [{ id: 'grand', label: 'Grand', checked: true }],
          },
        ],
      },
    ]);
  });

  it('checks a leaf item among siblings without walking into them', async () => {
    const setTree = vi.fn();
    const tree: TreeViewItem[] = [
      { id: 'plain', label: 'Plain' },
      { id: 'target', label: 'Target', checked: false },
    ];

    const { find } = await render(
      <TreeView
        tree={tree}
        setTree={setTree}
        selectedItemId={null}
        onSelectedItemIdChange={() => undefined}
      />,
    );

    await click(find<HTMLInputElement>('input[type="checkbox"]'));

    expect(setTree).toHaveBeenCalledWith([
      { id: 'plain', label: 'Plain' },
      { id: 'target', label: 'Target', checked: true },
    ]);
  });

  it('forwards dragover and drop to the item that declares them', async () => {
    const onDragOver = vi.fn();
    const onDrop = vi.fn();
    const { findAll } = await render(
      <TreeViewHarness initialTree={[{ id: 'leaf', label: 'Leaf', onDragOver, onDrop }]} />,
    );

    const row = at(findAll<HTMLElement>('[role="treeitem"]'), 0);

    fire(row, 'dragover');
    fire(row, 'drop');

    expect(onDragOver).toHaveBeenCalledTimes(1);
    expect(onDrop).toHaveBeenCalledTimes(1);
  });

  it('forwards the clipboard and drag handlers it was given for the tree as a whole', async () => {
    const onDragOver = vi.fn();
    const onCopy = vi.fn();
    const onCut = vi.fn();
    const onPaste = vi.fn();
    const { find } = await render(
      <TreeViewHarness
        initialTree={[{ id: 'leaf', label: 'Leaf' }]}
        onDragOver={onDragOver}
        onCopy={onCopy}
        onCut={onCut}
        onPaste={onPaste}
      />,
    );

    const root = find('[role="tree"]');

    fire(root, 'dragover');
    fire(root, 'copy');
    fire(root, 'cut');
    fire(root, 'paste');

    expect(onDragOver).toHaveBeenCalledTimes(1);
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onCut).toHaveBeenCalledTimes(1);
    expect(onPaste).toHaveBeenCalledTimes(1);
  });

  it('scrolls the selected row into view when a selection exists', async () => {
    const scrollIntoView = vi.fn();
    window.Element.prototype.scrollIntoView = scrollIntoView;

    const { findAll } = await render(<TreeViewHarness initialTree={expandableTree} />);

    await click(at(findAll<HTMLElement>('[role="treeitem"]'), 1));

    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('does not scroll when the selected id names no rendered row', async () => {
    const scrollIntoView = vi.fn();
    window.Element.prototype.scrollIntoView = scrollIntoView;

    await render(<TreeViewHarness initialTree={expandableTree} initialSelectedItemId="missing" />);

    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});

describe('MenuTree rendering', () => {
  function renderMenu(
    overrides: Partial<MenuTreeComponentProps> = {},
    expanded = true,
  ): Promise<Awaited<ReturnType<typeof render>>> {
    return render(
      <MenuTree
        expanded={expanded}
        width={200}
        menuItems={[{ id: 'overview', title: 'Overview', subitems: [] }]}
        currentItemId="none"
        getMenuItemDepth={(item) => item.id.split('/').length - 1}
        onItemClick={() => 'default'}
        {...overrides}
      />,
    );
  }

  it('draws one entry per item and names itself with the width it was given', async () => {
    const { findAll, findByText, find } = await renderMenu();

    expect(findByText('Overview')).toBeDefined();
    expect(findAll<HTMLElement>('[role="menuitem"]')).toHaveLength(1);
    expect(find<HTMLElement>('[role="menuitem"]').style.paddingLeft).toBe('0px');
  });

  it('renders the search field only while the menu is open and a search is asked for', async () => {
    const { query } = await renderMenu({ searchShown: true, onChangeSearchText: () => undefined });

    expect(query('[role="combobox"]')).not.toBeNull();
  });

  it('hides the search field when the menu is collapsed', async () => {
    const { query } = await renderMenu(
      { searchShown: true, onChangeSearchText: () => undefined },
      false,
    );

    expect(query('[role="combobox"]')).toBeNull();
  });

  it('resolves a title from the locale when the item names a message key', async () => {
    const { findByText } = await renderMenu({
      menuItems: [{ id: 'keyed', titleKey: 'SearchInput.search', subitems: [] }],
    });

    expect(findByText('Search')).toBeDefined();
  });

  it('draws every level of indentation for a nested item', async () => {
    const menuItems: TMenuTreeItem[] = [
      {
        id: 'settings',
        title: 'Settings',
        defaultSubitemsShown: true,
        subitems: [
          {
            id: 'settings/advanced',
            title: 'Advanced',
            defaultSubitemsShown: true,
            subitems: [{ id: 'settings/advanced/x', title: 'X', subitems: [] }],
          },
          { id: 'settings/general', title: 'General', subitems: [] },
          {
            id: 'settings/server',
            title: 'Server',
            defaultSubitemsShown: true,
            subitems: [{ id: 'settings/server/s1', title: 'S1', subitems: [] }],
          },
        ],
      },
    ];

    const { findAll, findByText } = await renderMenu({ menuItems });

    expect(findByText('X')).toBeDefined();
    expect(findByText('S1')).toBeDefined();
    // The deeper rows carry the block elements the connector draws.
    expect(findAll('[role="menuitem"]').length).toBe(6);
  });

  it('hides an item that is hidden, mobile-only on a desktop, or an empty list that hides itself', async () => {
    const { query } = await renderMenu({
      menuItems: [
        { id: 'hidden', title: 'Hidden', subitems: [], hidden: true },
        { id: 'mobile', title: 'Mobile', subitems: [], onlyMobile: true },
        {
          id: 'empty',
          title: 'Empty',
          subitems: [],
          onlyList: true,
          hideListIfEmpty: true,
        },
      ],
    });

    expect(query('[role="menuitem"]')).toBeNull();
  });

  it('shows a mobile-only item on a narrow screen', async () => {
    window.innerWidth = 400;

    const { findByText } = await renderMenu({
      menuItems: [{ id: 'mobile', title: 'Mobile', subitems: [], onlyMobile: true }],
    });

    expect(findByText('Mobile')).toBeDefined();
  });

  it('draws an item that only asks to be a list even with no subitems', async () => {
    const { findByText } = await renderMenu({
      menuItems: [{ id: 'list', title: 'List', subitems: [], onlyList: true }],
    });

    expect(findByText('List')).toBeDefined();
  });

  it('hides a list whose only subitem is another empty list that hides itself', async () => {
    const { findByText, findAll } = await renderMenu({
      menuItems: [
        {
          id: 'parent',
          title: 'Parent',
          onlyList: true,
          defaultSubitemsShown: true,
          subitems: [
            {
              id: 'child',
              title: 'Child',
              subitems: [],
              onlyList: true,
              hideListIfEmpty: true,
            },
          ],
        },
      ],
    });

    expect(findByText('Parent')).toBeDefined();
    // The empty child is hidden rather than drawn as a dead row.
    expect(findAll<HTMLElement>('[role="menuitem"]')).toHaveLength(1);
  });

  it('draws the icon, colour indicator, refresh control and surrounding fragments', async () => {
    const onRefresh = vi.fn();
    const { findByText, findAll } = await renderMenu({
      menuItems: [
        {
          id: 'full',
          title: 'Full',
          subitems: [],
          icon: 'alphabet',
          colorIndicator: 'good',
          hasRefresh: true,
          titlePrefix: <span>Pre</span>,
          titleSuffix: <span>Post</span>,
          afterTitleComponent: <span>After</span>,
        },
      ],
      onRefreshItem: onRefresh,
    });

    expect(findByText('Pre')).toBeDefined();
    expect(findByText('Post')).toBeDefined();
    expect(findByText('After')).toBeDefined();

    const refreshButton = findAll<HTMLButtonElement>('button').find(
      (button) => button.getAttribute('aria-label') === 'Refresh',
    );

    if (refreshButton === undefined) {
      throw new Error('the refresh control was not rendered.');
    }

    await click(refreshButton);

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('draws an empty status stripe when the item reports no colour', async () => {
    const { findAll } = await renderMenu({
      menuItems: [{ id: 'plain', title: 'Plain', subitems: [], colorIndicator: undefined }],
    });

    const row = at(findAll<HTMLElement>('[role="menuitem"]'), 0);

    expect(row.querySelectorAll('div').length).toBeGreaterThan(0);
  });

  it('draws the item with its status colour while the menu is collapsed', async () => {
    const { findAll } = await renderMenu(
      {
        menuItems: [
          { id: 'full', title: 'Full', subitems: [], icon: 'alphabet', colorIndicator: 'bad' },
        ],
      },
      false,
    );

    const row = at(findAll<HTMLElement>('[role="menuitem"]'), 0);

    // Collapsed, the label is gone but the icon carries the status colour.
    expect(row.textContent?.trim()).toBe('');
  });

  it('takes the per-item class and style as functions of the item', async () => {
    const { findAll } = await renderMenu({
      menuItems: [
        { id: 'a', title: 'A', subitems: [] },
        { id: 'b', title: 'B', subitems: [] },
      ],
      menuItemClassName: (item) => `item-${item.id}`,
      menuItemStyle: (item) => ({ color: item.id === 'a' ? 'red' : 'blue' }),
    });

    const rows = findAll<HTMLElement>('[role="menuitem"]');

    expect(at(rows, 0).className).toContain('item-a');
    expect(at(rows, 1).className).toContain('item-b');
    expect(at(rows, 0).style.color).toBe('red');
    expect(at(rows, 1).style.color).toBe('blue');
  });

  it('takes the per-item class and style as literals', async () => {
    const { findAll } = await renderMenu({
      menuItems: [{ id: 'c', title: 'C', subitems: [] }],
      menuItemClassName: 'literal-class',
      menuItemStyle: { color: 'green' },
    });

    const row = at(findAll<HTMLElement>('[role="menuitem"]'), 0);

    expect(row.className).toContain('literal-class');
    expect(row.style.color).toBe('green');
  });
});

describe('MenuTree interaction', () => {
  function renderMenu(
    overrides: Partial<MenuTreeComponentProps> = {},
    expanded = true,
  ): Promise<Awaited<ReturnType<typeof render>>> {
    return render(
      <MenuTree
        expanded={expanded}
        width={200}
        menuItems={[{ id: 'overview', title: 'Overview', subitems: [] }]}
        currentItemId="none"
        getMenuItemDepth={(item) => item.id.split('/').length - 1}
        onItemClick={() => 'default'}
        {...overrides}
      />,
    );
  }

  it('reports a click with its subitem state and honours a denial', async () => {
    const onItemClick = vi.fn().mockReturnValue('deny');
    const onNavigate = vi.fn();
    const { findAll } = await renderMenu({ onItemClick, onNavigate });

    await click(at(findAll<HTMLElement>('[role="menuitem"]'), 0));

    expect(at(onItemClick.mock.calls, 0)[0]).toMatchObject({ subitemsShown: false });
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('navigates a leaf to its route, or to its id when it has none', async () => {
    const onNavigate = vi.fn();
    const { findAll } = await renderMenu({
      onNavigate,
      menuItems: [
        { id: 'routed', route: '/routed', title: 'Routed', subitems: [] },
        { id: 'plain', title: 'Plain', subitems: [] },
      ],
    });

    const rows = findAll<HTMLElement>('[role="menuitem"]');

    await click(at(rows, 0));
    expect(onNavigate).toHaveBeenLastCalledWith('/routed');

    await click(at(rows, 1));
    expect(onNavigate).toHaveBeenLastCalledWith('plain');
  });

  it('fires the item own onClick once the common click allows it', async () => {
    const onClick = vi.fn();
    const { findAll } = await renderMenu({
      menuItems: [{ id: 'item', title: 'Item', subitems: [], onClick }],
    });

    await click(at(findAll<HTMLElement>('[role="menuitem"]'), 0));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('reveals and hides the subitems of a list and asks for the menu to open', async () => {
    const onMenuExpansionChange = vi.fn();
    const { findAll, findByText } = await renderMenu({
      onMenuExpansionChange,
      menuItems: [
        {
          id: 'group',
          title: 'Group',
          subitems: [{ id: 'group/child', title: 'Child', subitems: [] }],
        },
      ],
    });

    await click(at(findAll<HTMLElement>('[role="menuitem"]'), 0));

    expect(onMenuExpansionChange).toHaveBeenCalledWith(true);
    expect(findByText('Child')).toBeDefined();
  });

  it('does nothing for a click on an inactive item', async () => {
    const onItemClick = vi.fn();
    const { findAll } = await renderMenu({
      onItemClick,
      menuItems: [{ id: 'inactive', title: 'Inactive', subitems: [], inactive: true }],
    });

    await click(at(findAll<HTMLElement>('[role="menuitem"]'), 0));

    expect(onItemClick).not.toHaveBeenCalled();
  });

  it('reports a right-click through the context-menu callback', async () => {
    const onItemContextMenu = vi.fn();
    const { findAll } = await renderMenu({
      onItemContextMenu,
      menuItems: [{ id: 'item', title: 'Item', subitems: [] }],
    });

    fireMouse(at(findAll<HTMLElement>('[role="menuitem"]'), 0), 'contextmenu');

    expect(onItemContextMenu).toHaveBeenCalledTimes(1);
  });

  it('does not report a context menu on an inactive item', async () => {
    const onItemContextMenu = vi.fn();
    const { findAll } = await renderMenu({
      onItemContextMenu,
      menuItems: [{ id: 'inactive', title: 'Inactive', subitems: [], inactive: true }],
    });

    fireMouse(at(findAll<HTMLElement>('[role="menuitem"]'), 0), 'contextmenu');

    expect(onItemContextMenu).not.toHaveBeenCalled();
  });

  it('activates a menu item from Enter and Space and ignores other keys', async () => {
    const onNavigate = vi.fn();
    const { findAll } = await renderMenu({
      onNavigate,
      menuItems: [{ id: 'item', title: 'Item', subitems: [] }],
    });

    const row = at(findAll<HTMLElement>('[role="menuitem"]'), 0);

    keyDown(row, 'a');
    expect(onNavigate).not.toHaveBeenCalled();

    keyDown(row, 'Enter');
    expect(onNavigate).toHaveBeenLastCalledWith('item');

    keyDown(row, ' ');
    expect(onNavigate).toHaveBeenCalledTimes(2);
  });

  it('closes an open menu on a narrow screen after navigating', async () => {
    window.innerWidth = 400;

    const onMenuExpansionChange = vi.fn();
    const { findAll } = await renderMenu(
      {
        onMenuExpansionChange,
        menuItems: [{ id: 'item', title: 'Item', subitems: [], route: '/item' }],
      },
      true,
    );

    await click(at(findAll<HTMLElement>('[role="menuitem"]'), 0));

    expect(onMenuExpansionChange).toHaveBeenCalledWith(false);
  });

  it('does not toggle a list on a narrow screen while the menu is closed', async () => {
    window.innerWidth = 400;

    const onMenuExpansionChange = vi.fn();
    const { findAll } = await renderMenu(
      {
        onMenuExpansionChange,
        menuItems: [
          {
            id: 'group',
            title: 'Group',
            subitems: [{ id: 'group/child', title: 'Child', subitems: [] }],
          },
        ],
      },
      false,
    );

    await click(at(findAll<HTMLElement>('[role="menuitem"]'), 0));

    expect(onMenuExpansionChange).toHaveBeenCalledWith(true);
    expect(document.body.textContent).not.toContain('Child');
  });

  it('keeps the full version on a narrow screen when asked to', async () => {
    window.innerWidth = 400;

    const onMenuExpansionChange = vi.fn();
    const { findAll } = await renderMenu({
      onMenuExpansionChange,
      alwaysFullVersion: true,
      menuItems: [{ id: 'item', title: 'Item', subitems: [] }],
    });

    await click(at(findAll<HTMLElement>('[role="menuitem"]'), 0));

    expect(onMenuExpansionChange).not.toHaveBeenCalled();
  });
});

describe('MenuTree helpers', () => {
  it('builds the path of titles to an item in either kind of tree', () => {
    const menuItems: TMenuTreeItem[] = [
      {
        id: 'parent',
        title: 'Parent',
        subitems: [{ id: 'child', titleKey: 'SearchInput.search', subitems: [] }],
      },
    ];

    document.documentElement.setAttribute('lang', 'en');

    expect(buildMenuItemFullTitleByItsId(menuItems, 'child')).toEqual(['Parent', 'Search']);
    expect(buildMenuItemFullTitleByItsId(menuItems, 'missing')).toBeNull();

    const untitled: TMenuTreeItem[] = [{ id: 'untitled', subitems: [] }];

    expect(buildMenuItemFullTitleByItsId(untitled, 'untitled')).toEqual(['']);

    const treeViewItems: TreeViewItem[] = [
      { id: 'a', label: 'A', children: [{ id: 'b', label: 'B' }] },
      { id: 'c', label: 'C' },
    ];

    expect(buildMenuItemFullTitleByItsId(treeViewItems, 'b')).toEqual(['A', 'B']);
    expect(buildMenuItemFullTitleByItsId(treeViewItems, 'missing')).toBeNull();
  });

  it('starts the path it reports from the prefix it was given', () => {
    const menuItems: TMenuTreeItem[] = [{ id: 'only', title: 'Only', subitems: [] }];

    expect(buildMenuItemFullTitleByItsId(menuItems, 'only', ['Root'])).toEqual(['Root', 'Only']);
  });

  it('finds an item by id at the top level, nested, and reports null when absent', () => {
    const items: { id: string; subitems: { id: string; subitems: [] }[] }[] = [
      { id: 'a', subitems: [{ id: 'b', subitems: [] }] },
      { id: 'c', subitems: [] },
    ];

    expect(findMenuItemById(items, 'a')?.id).toBe('a');
    expect(findMenuItemById(items, 'b')?.id).toBe('b');
    expect(findMenuItemById(items, 'missing')).toBeNull();
  });
});

describe('MenuTree selection', () => {
  function renderMenu(
    overrides: Partial<MenuTreeComponentProps> = {},
    expanded = true,
  ): Promise<Awaited<ReturnType<typeof render>>> {
    return render(
      <MenuTree
        expanded={expanded}
        width={200}
        menuItems={[{ id: 'overview', title: 'Overview', subitems: [] }]}
        currentItemId="none"
        getMenuItemDepth={() => 0}
        onItemClick={() => 'default'}
        {...overrides}
      />,
    );
  }

  const isOnPath: IsOnPathToCurrentItem = (id, current) => id === `${current}/parent`;

  it('marks the current item as selected whatever else is true', async () => {
    const onItemClick: MenuTreeItemClickCallback = () => 'default';
    const { findAll } = await renderMenu({
      currentItemId: 'overview',
      onItemClick,
      menuItems: [
        { id: 'overview', title: 'Overview', subitems: [] },
        { id: 'other', title: 'Other', subitems: [] },
      ],
    });

    const rows = findAll<HTMLElement>('[role="menuitem"]');

    expect(at(rows, 0).classList.contains('bg-bse')).toBe(true);
    expect(at(rows, 1).classList.contains('bg-bse')).toBe(false);
  });

  it('highlights the ancestor of the current item while its subitems are hidden', async () => {
    const { findAll } = await renderMenu({
      currentItemId: 'child',
      isOnPathToCurrentItem: isOnPath,
      menuItems: [
        {
          id: 'child/parent',
          title: 'Parent',
          subitems: [{ id: 'child', title: 'Child', subitems: [] }],
        },
      ],
    });

    // The parent is collapsed, so it is drawn as the way back to the current item.
    expect(at(findAll<HTMLElement>('[role="menuitem"]'), 0).classList.contains('bg-bse')).toBe(
      true,
    );
  });

  it('stops highlighting an ancestor whose open list holds the current item', async () => {
    const { findAll } = await renderMenu({
      currentItemId: 'child',
      isOnPathToCurrentItem: isOnPath,
      menuItems: [
        {
          id: 'child/parent',
          title: 'Parent',
          defaultSubitemsShown: true,
          subitems: [{ id: 'child', title: 'Child', subitems: [] }],
        },
      ],
    });

    const rows = findAll<HTMLElement>('[role="menuitem"]');

    expect(at(rows, 0).classList.contains('bg-bse')).toBe(false);
    expect(at(rows, 1).classList.contains('bg-bse')).toBe(true);
  });

  it('highlights an empty list that is on the path, because there is nothing to open', async () => {
    const { findAll } = await renderMenu({
      currentItemId: 'child',
      isOnPathToCurrentItem: isOnPath,
      menuItems: [{ id: 'child/parent', title: 'Parent', subitems: [], onlyList: true }],
    });

    expect(at(findAll<HTMLElement>('[role="menuitem"]'), 0).classList.contains('bg-bse')).toBe(
      true,
    );
  });
});
