// @vitest-environment jsdom

import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Accordion } from '@/components/navigation/Accordion';
import { ControlledMUITabList } from '@/components/navigation/ControlledMUITabList';
import { EditableAccordionList } from '@/components/navigation/EditableAccordionList';
import {
  MenuTree,
  type MenuTreeItemClickCallback,
  type TMenuTreeItem,
} from '@/components/navigation/MenuTree';
import type { MUITabDescriptor } from '@/components/navigation/MUITabList';
import { NavBar } from '@/components/navigation/NavBar';
import { OrderPanel } from '@/components/navigation/OrderPanel';
import { type RouteDescriptor, RouteSwitch } from '@/components/navigation/RouteSwitch';
import { SlideMenu } from '@/components/navigation/SlideMenu';
import { ToTop } from '@/components/navigation/ToTop';
import { TreeView, type TreeViewItem } from '@/components/navigation/TreeView';
import { getPathParam } from '@/util/routing';
import { act, click, render, type } from '@/util/testing/render';

describe('Accordion', () => {
  it('reports the state it would move to rather than moving there itself', async () => {
    const onExpansionChange = vi.fn();
    const { find, update } = await render(
      <Accordion expanded={false} onExpansionChange={onExpansionChange} triggerTitle="Details">
        <p>Body</p>
      </Accordion>,
    );

    await click(find<HTMLButtonElement>('button'));

    expect(onExpansionChange).toHaveBeenCalledWith(true);

    await update(
      <Accordion expanded onExpansionChange={onExpansionChange} triggerTitle="Details">
        <p>Body</p>
      </Accordion>,
    );

    await click(find<HTMLButtonElement>('button'));

    expect(onExpansionChange).toHaveBeenLastCalledWith(false);
  });

  it('keeps its content in the document while collapsed, so it can be searched', async () => {
    const { findByText } = await render(
      <Accordion expanded={false} onExpansionChange={() => undefined} triggerTitle="Details">
        <p>Searchable body</p>
      </Accordion>,
    );

    expect(findByText('Searchable body')).toBeDefined();
  });

  it('takes the content out of the document when told not to keep it mounted', async () => {
    const { container } = await render(
      <Accordion
        expanded={false}
        onExpansionChange={() => undefined}
        triggerTitle="Details"
        forceMount={false}
      >
        <p>Expensive body</p>
      </Accordion>,
    );

    expect(container.textContent).not.toContain('Expensive body');
  });

  it('expands on Enter and on Space, because a section is a control a keyboard reaches', async () => {
    const onExpansionChange = vi.fn();
    const { find } = await render(
      <Accordion expanded={false} onExpansionChange={onExpansionChange} triggerTitle="Details" />,
    );

    const trigger = find<HTMLButtonElement>('button');

    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

    expect(onExpansionChange).toHaveBeenCalledTimes(2);
  });
});

describe('ToTop', () => {
  it('renders nothing until the page is scrolled far enough', async () => {
    const { query } = await render(<ToTop minAppearanceY={300} />);

    expect(query('button')).toBeNull();

    act(() => {
      window.scrollY = 400;
      window.dispatchEvent(new Event('scroll'));
    });

    expect(query('button')).not.toBeNull();
  });

  it('disappears again when the page is scrolled back to the top', async () => {
    const { query } = await render(<ToTop minAppearanceY={300} />);

    act(() => {
      window.scrollY = 400;
      window.dispatchEvent(new Event('scroll'));
    });

    act(() => {
      window.scrollY = 0;
      window.dispatchEvent(new Event('scroll'));
    });

    expect(query('button')).toBeNull();
  });
});

describe('ControlledMUITabList', () => {
  // `forceMount` is what the component itself sets for the selected tab, so a descriptor a caller
  // writes carries only the three fields a caller knows.
  const tabs: MUITabDescriptor<'first' | 'second'>[] = [
    { id: 'first', title: 'First', content: <p>First panel</p>, forceMount: false },
    { id: 'second', title: 'Second', content: <p>Second panel</p>, forceMount: false },
  ];

  it('shows the panel of the tab it was given, and nothing else', async () => {
    const { findByText, query } = await render(
      <ControlledMUITabList tabs={tabs} tabId="second" setTabId={() => undefined} />,
    );

    expect(findByText('Second panel')).toBeDefined();
    expect(query('div')?.textContent).not.toContain('First panel');
  });

  it('reports the tab that was clicked, holding the selection itself', async () => {
    const setTabId = vi.fn();
    const { findAll } = await render(
      <ControlledMUITabList tabs={tabs} tabId="first" setTabId={setTabId} />,
    );

    const triggers = findAll<HTMLElement>('[role="tab"]');

    expect(triggers).toHaveLength(2);

    await click(triggers[1] as HTMLElement);

    expect(setTabId).toHaveBeenCalledWith('second');
  });
});

/**
 * The list as a caller holds it: it keeps the items and hands them back.
 *
 * A list is controlled throughout, so a test that types into it and asserts on a row that is still
 * editing is only meaningful if something re-renders with the new list — which is what the component
 * is for, and what a row-ending edit reads to decide whether the name it holds is valid.
 */
function EditableListUnderTest({
  isItemNameValid,
}: {
  readonly isItemNameValid: (name: string) => boolean;
}) {
  const [items, setItems] = useState([
    { key: 'k1', name: 'First', editing: true, expanded: false },
  ]);

  return (
    <EditableAccordionList
      items={items}
      onChange={setItems}
      isItemNameValid={isItemNameValid}
      errors={[]}
      getItemContent={() => <p>Content</p>}
      appendItemTitle="Add"
    />
  );
}

describe('EditableAccordionList', () => {
  const items = [
    { key: 'k1', name: 'First', editing: true, expanded: false },
    { key: 'k2', name: 'Second', editing: true, expanded: false },
  ];

  it('reports an edit to the list it was given rather than keeping one of its own', async () => {
    const onChange = vi.fn();
    const { findAll } = await render(
      <EditableAccordionList
        items={items}
        onChange={onChange}
        isItemNameValid={() => true}
        errors={[]}
        getItemContent={() => <p>Content</p>}
        appendItemTitle="Add"
      />,
    );

    const inputs = findAll<HTMLInputElement>('input');

    expect(inputs).toHaveLength(2);

    await type(inputs[0] as HTMLInputElement, 'Renamed');

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ key: 'k1', name: 'Renamed', editing: true }),
      expect.objectContaining({ key: 'k2', name: 'Second' }),
    ]);
  });

  it('ends the edit on Enter when the name is valid, and stays editing when it is not', async () => {
    const { find, findByText, query } = await render(
      <EditableListUnderTest isItemNameValid={(name) => name.length > 3} />,
    );

    await type(find<HTMLInputElement>('input'), 'no');
    act(() => {
      find<HTMLInputElement>('input').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
    });

    // The row is still being edited, because the name it would be given is not one the caller accepts.
    expect(query('input')).not.toBeNull();

    await type(find<HTMLInputElement>('input'), 'A long enough name');
    act(() => {
      find<HTMLInputElement>('input').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
    });

    expect(query('input')).toBeNull();
    expect(findByText('A long enough name')).toBeDefined();
  });

  it('reports a row removed, without removing it itself', async () => {
    const onChange = vi.fn();
    const { findAll } = await render(
      <EditableAccordionList
        items={items}
        onChange={onChange}
        isItemNameValid={() => true}
        errors={[]}
        getItemContent={() => <p>Content</p>}
        appendItemTitle="Add"
      />,
    );

    const removeButton = findAll<HTMLButtonElement>('button').find(
      (button) => button.getAttribute('title') === 'Remove record',
    );

    if (removeButton === undefined) {
      throw new Error('the remove control was not rendered.');
    }

    await click(removeButton);

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ key: 'k2' })]);
  });

  it('shows the empty message rather than an empty box when there is nothing to list', async () => {
    const { findByText } = await render(
      <EditableAccordionList
        items={[]}
        onChange={() => undefined}
        isItemNameValid={() => true}
        errors={[]}
        getItemContent={() => <p>Content</p>}
        appendItemTitle="Add"
      />,
    );

    expect(findByText('Empty List')).toBeDefined();
  });
});

describe('OrderPanel', () => {
  it('reports the order the caller asked for and holds none of its own', async () => {
    const onChange = vi.fn();
    const { findAll } = await render(
      <OrderPanel
        title="Order"
        items={[1, 2, 3]}
        onChange={onChange}
        itemIndexFormatter={(item) => item}
      />,
    );

    const buttons = findAll<HTMLButtonElement>('button');

    expect(buttons.length).toBeGreaterThan(0);

    await click(buttons[0] as HTMLButtonElement);

    expect(onChange).toHaveBeenCalled();
  });
});

describe('TreeView', () => {
  // `icon` is an `IconName` rather than a string, which is what stops a caller passing a name the
  // library does not ship.
  const group: TreeViewItem = {
    id: 'group',
    label: 'Group',
    icon: 'alphabet',
    expanded: false,
    children: [{ id: 'leaf', label: 'Leaf' }],
  };

  const collapsedTree: TreeViewItem[] = [group];
  const expandedTree: TreeViewItem[] = [{ ...group, expanded: true }];

  it('renders the rows the caller described and reports the selection rather than moving it', async () => {
    const onSelectedItemIdChange = vi.fn();
    const { findByText, findAll } = await render(
      <TreeView
        tree={collapsedTree}
        setTree={() => undefined}
        selectedItemId={null}
        onSelectedItemIdChange={onSelectedItemIdChange}
      />,
    );

    expect(findByText('Group')).toBeDefined();

    const items = findAll<HTMLElement>('[role="treeitem"]');

    expect(items).toHaveLength(1);
    expect(items[0]?.getAttribute('aria-expanded')).toBe('false');

    await click(items[0] as HTMLElement);

    expect(onSelectedItemIdChange).toHaveBeenCalledWith('group');
    // The selection is the caller's: the tree has not moved it into the tab order by itself.
    expect(items[0]?.getAttribute('aria-selected')).toBe('false');
  });

  it("shows a row's children only when the caller's tree says it is expanded", async () => {
    const { findByText, update } = await render(
      <TreeView
        tree={collapsedTree}
        setTree={() => undefined}
        selectedItemId={null}
        onSelectedItemIdChange={() => undefined}
      />,
    );

    expect(document.body.textContent).not.toContain('Leaf');

    await update(
      <TreeView
        tree={expandedTree}
        setTree={() => undefined}
        selectedItemId="group"
        onSelectedItemIdChange={() => undefined}
      />,
    );

    expect(findByText('Leaf')).toBeDefined();
  });
});

describe('MenuTree', () => {
  const menuItems: TMenuTreeItem[] = [
    {
      id: 'overview',
      title: 'Overview',
      subitems: [],
    },
    {
      id: 'settings',
      title: 'Settings',
      subitems: [{ id: 'settings/general', title: 'General', subitems: [] }],
    },
  ];

  const renderTree = (onItemClick: MenuTreeItemClickCallback) =>
    render(
      <MenuTree
        expanded
        width={200}
        menuItems={menuItems}
        currentItemId="overview"
        getMenuItemDepth={() => 0}
        onItemClick={onItemClick}
      />,
    );

  it('renders one entry per item and nothing else', async () => {
    const { findByText, query } = await renderTree(vi.fn());

    expect(findByText('Overview')).toBeDefined();
    expect(findByText('Settings')).toBeDefined();
    // Subitems are the caller's to show; the tree reports what a click would do.
    expect(query('[data-testid="subitem"]')).toBeNull();
    expect(document.body.textContent).not.toContain('General');
  });

  it('reports the item and the subitem state on a click, and honours a denial', async () => {
    const onItemClick = vi.fn().mockReturnValue('deny');
    const { findAll } = await renderTree(onItemClick);

    const entries = findAll<HTMLElement>('[role="menuitem"]');

    expect(entries).toHaveLength(2);

    await click(entries[0] as HTMLElement);

    expect(onItemClick).toHaveBeenCalledTimes(1);
    expect(onItemClick.mock.calls[0]?.[0]).toMatchObject({
      menuItem: { id: 'overview' },
    });
  });

  it('renders an item with neither a title nor a key as nothing, rather than as a raw key', async () => {
    const { findAll } = await render(
      <MenuTree
        expanded
        width={200}
        menuItems={[{ id: 'nameless', titleKey: undefined, subitems: [] }]}
        currentItemId="nameless"
        getMenuItemDepth={() => 0}
        onItemClick={() => 'default'}
      />,
    );

    const entry = findAll<HTMLElement>('[role="menuitem"]')[0];

    expect(entry?.textContent?.trim()).toBe('');
  });
});

describe('RouteSwitch', () => {
  const routes: RouteDescriptor[] = [
    { path: '/about', render: () => <p>About</p> },
    { path: '/serverRack/:rackId', render: (match) => <p>Rack {getPathParam(match, 'rackId')}</p> },
    { path: '*', render: () => <p>Not found</p> },
  ];

  it('renders the route the path addresses', async () => {
    const { findByText } = await render(<RouteSwitch path="/about" routes={routes} />);

    expect(findByText('About')).toBeDefined();
  });

  it('hands the matched route the parameters its pattern bound', async () => {
    const { findByText } = await render(<RouteSwitch path="/serverRack/rack-1" routes={routes} />);

    expect(findByText('Rack rack-1')).toBeDefined();
  });

  it("renders nothing when no route matches, because the fallback is the caller's to give", async () => {
    const { container } = await render(<RouteSwitch path="/other" routes={routes.slice(0, 2)} />);

    expect(container.textContent).toBe('');
  });

  it('builds only the route it renders', async () => {
    const renderAbout = vi.fn(() => <p>About</p>);

    await render(
      <RouteSwitch path="/other" routes={[...routes, { path: '/about', render: renderAbout }]} />,
    );

    expect(renderAbout).not.toHaveBeenCalled();
  });
});

describe('SlideMenu', () => {
  it('reports the state it would move to rather than moving there itself', async () => {
    const onOpenChange = vi.fn();
    const { find, update } = await render(
      <SlideMenu open={false} onOpenChange={onOpenChange}>
        <p>Menu</p>
      </SlideMenu>,
    );

    await click(find<HTMLButtonElement>('button'));

    expect(onOpenChange).toHaveBeenCalledWith(true);

    await update(
      <SlideMenu open onOpenChange={onOpenChange}>
        <p>Menu</p>
      </SlideMenu>,
    );

    await click(find<HTMLButtonElement>('button'));

    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('keeps the panel in the document while it is closed, so a drag can open it', async () => {
    const { findByText } = await render(
      <SlideMenu open={false} onOpenChange={() => undefined}>
        <p>Menu item</p>
      </SlideMenu>,
    );

    expect(findByText('Menu item')).toBeDefined();
  });

  it('closes when its backdrop is clicked, which is the only thing the backdrop does', async () => {
    const onOpenChange = vi.fn();
    const { findAll } = await render(
      <SlideMenu open onOpenChange={onOpenChange}>
        <p>Menu item</p>
      </SlideMenu>,
    );

    // The button that opens the menu, and the backdrop behind the panel: the backdrop is a button
    // because a `div` one could be closed only by a mouse.
    await click(findAll<HTMLButtonElement>('button')[1] as HTMLButtonElement);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('names its button from the locale when the caller names it nothing', async () => {
    const { find } = await render(
      <SlideMenu open={false} onOpenChange={() => undefined}>
        <p>Menu</p>
      </SlideMenu>,
    );

    expect(find<HTMLButtonElement>('button').getAttribute('aria-label')).toBe('Open Menu');
  });

  it('leaves the panel to the width and offset the caller gives it', async () => {
    const { find } = await render(
      <SlideMenu open onOpenChange={() => undefined} width="30rem" topOffset="3rem">
        <p>Menu item</p>
      </SlideMenu>,
    );

    // The panel is portalled onto the body, so the query that finds it is one that searches there.
    const panel = find<HTMLElement>('.bg-bpd');

    expect(panel.style.width).toBe('30rem');
    expect(panel.style.top).toBe('3rem');
    expect(panel.style.height).toBe('calc(100vh - 3rem)');
  });
});

describe('NavBar', () => {
  it('joins the root title and the breadcrumb, so a caller holding a menu can name where it is', async () => {
    const { findByText } = await render(
      <NavBar rootTitle="Server room" breadcrumb={['Racks', 'Rack 1']} />,
    );

    expect(findByText('Server room / Racks / Rack 1')).toBeDefined();
  });

  it('shows the root title alone when there is nothing to lead to it', async () => {
    const { findByText } = await render(<NavBar rootTitle="Server room" />);

    expect(findByText('Server room')).toBeDefined();
  });

  it('renders the menu button only when there is a menu to open', async () => {
    const onMenuClick = vi.fn();
    const { container, update } = await render(<NavBar rootTitle="Server room" />);

    expect(container.querySelector('button')).toBeNull();

    await update(<NavBar rootTitle="Server room" onMenuClick={onMenuClick} />);

    const [menuButton] = container.querySelectorAll<HTMLButtonElement>('button');

    await click(menuButton as HTMLButtonElement);

    expect(onMenuClick).toHaveBeenCalledTimes(1);
  });

  it('renders what the caller puts at its right', async () => {
    const { findByText } = await render(
      <NavBar rootTitle="Server room">
        <p>Right</p>
      </NavBar>,
    );

    expect(findByText('Right')).toBeDefined();
  });
});
