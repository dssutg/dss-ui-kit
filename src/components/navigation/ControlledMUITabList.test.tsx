// SPDX-License-Identifier: MIT
// The controlled tab list's selection, held by the caller.
// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { ControlledMUITabList } from '@/components/navigation/ControlledMUITabList';
import type { MUITabDescriptor } from '@/components/navigation/MUITabList';
import { act, click, render } from '@/util/testing/render';

const tabs: MUITabDescriptor<string>[] = [
  { id: 'first', title: 'First', content: <p>First panel</p>, forceMount: false },
  { id: 'second', title: 'Second', content: <p>Second panel</p>, forceMount: true },
];

function pressKey(element: Element, code: string): void {
  act(() => {
    element.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
  });
}

describe('ControlledMUITabList', () => {
  it('shows the panel of the tab it was given', async () => {
    const { findByText, query } = await render(
      <ControlledMUITabList tabs={tabs} tabId="second" setTabId={() => undefined} />,
    );

    expect(findByText('Second panel')).toBeDefined();
    expect(query('div')?.textContent).not.toContain('First panel');
  });

  it('reports the tab that was clicked', async () => {
    const setTabId = vi.fn();
    const { findAll } = await render(
      <ControlledMUITabList tabs={tabs} tabId="first" setTabId={setTabId} />,
    );

    const triggers = findAll<HTMLElement>('[role="tab"]');

    expect(triggers).toHaveLength(2);

    await click(triggers[1] as HTMLElement);

    expect(setTabId).toHaveBeenCalledWith('second');
  });

  it('moves to the next tab on ArrowRight, wrapping around', async () => {
    const setTabId = vi.fn();
    const { find } = await render(
      <ControlledMUITabList tabs={tabs} tabId="second" setTabId={setTabId} />,
    );

    pressKey(find('[role="tablist"]'), 'ArrowRight');

    expect(setTabId).toHaveBeenCalledWith('first');
  });

  it('moves to the previous tab on ArrowLeft, wrapping around', async () => {
    const setTabId = vi.fn();
    const { find } = await render(
      <ControlledMUITabList tabs={tabs} tabId="first" setTabId={setTabId} />,
    );

    pressKey(find('[role="tablist"]'), 'ArrowLeft');

    expect(setTabId).toHaveBeenCalledWith('second');
  });

  it('treats a key that is not a horizontal arrow as no instruction at all', async () => {
    const setTabId = vi.fn();
    const { find } = await render(
      <ControlledMUITabList tabs={tabs} tabId="first" setTabId={setTabId} />,
    );

    setTabId.mockClear();
    pressKey(find('[role="tablist"]'), 'ArrowUp');

    expect(setTabId).not.toHaveBeenCalled();
  });

  it('keeps a forced panel mounted while the tab is not selected', async () => {
    const { findByText, update } = await render(
      <ControlledMUITabList tabs={tabs} tabId="first" setTabId={() => undefined} />,
    );

    expect(findByText('Second panel')).toBeDefined();

    await update(<ControlledMUITabList tabs={tabs} tabId="second" setTabId={() => undefined} />);

    const secondPanel = document.querySelector('[data-state="active"]');
    expect(secondPanel?.textContent).toBe('Second panel');
  });

  it('draws the underline under the selected tab once it can measure it', async () => {
    const { container } = await render(
      <ControlledMUITabList tabs={tabs} tabId="first" setTabId={() => undefined} />,
    );

    expect(container.querySelector('.bg-tli')).not.toBeNull();
  });

  it('draws no underline when the selected id names no tab', async () => {
    const { container } = await render(
      <ControlledMUITabList tabs={tabs} tabId="missing" setTabId={() => undefined} />,
    );

    expect(container.querySelector('.bg-tli')).toBeNull();
  });

  it('renders the component a caller puts at the right of the list', async () => {
    const { findByText } = await render(
      <ControlledMUITabList
        tabs={tabs}
        tabId="first"
        setTabId={() => undefined}
        rightComponent={<span>Right</span>}
      />,
    );

    expect(findByText('Right')).toBeDefined();
  });

  it('applies the styles and classes it is given to the elements they name', async () => {
    const { container } = await render(
      <ControlledMUITabList
        tabs={tabs}
        tabId="first"
        setTabId={() => undefined}
        className="outer-class"
        style={{ margin: '3px' }}
        tabTriggerListStyle={{ padding: '4px' }}
        tabTriggerStyle={{ fontSize: '9px' }}
      />,
    );

    const outer = container.firstElementChild;
    const triggerList = container.querySelector('[role="tablist"]');
    const trigger = container.querySelector('[role="tab"]');
    const triggerListBox = container.querySelector('.bg-bpd');

    expect(outer?.className).toContain('outer-class');
    expect(outer?.getAttribute('style')).toContain('margin: 3px');
    expect(triggerList?.getAttribute('aria-orientation')).toBe('horizontal');
    expect(triggerListBox?.getAttribute('style')).toContain('padding: 4px');
    expect(trigger?.getAttribute('style')).toContain('font-size: 9px');
  });

  it('renders nothing when it was handed no tabs', async () => {
    const { container } = await render(
      <ControlledMUITabList tabs={[]} tabId="first" setTabId={() => undefined} />,
    );

    expect(container.textContent).toBe('');
  });

  it('renders nothing while the selection is null', async () => {
    const { container } = await render(
      <ControlledMUITabList tabs={tabs} tabId={null} setTabId={() => undefined} />,
    );

    expect(container.textContent).toBe('');
  });

  it('reports the first tab as the selection when the tab list changes', async () => {
    const setTabId = vi.fn();
    const { update } = await render(
      <ControlledMUITabList tabs={tabs} tabId="first" setTabId={setTabId} />,
    );

    setTabId.mockClear();

    const moreTabs: MUITabDescriptor<string>[] = [
      ...tabs,
      { id: 'third', title: 'Third', content: <p>Third panel</p>, forceMount: false },
    ];

    await update(<ControlledMUITabList tabs={moreTabs} tabId="first" setTabId={setTabId} />);

    expect(setTabId).toHaveBeenCalledWith('first');
  });
});
