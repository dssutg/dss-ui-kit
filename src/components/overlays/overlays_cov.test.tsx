// SPDX-License-Identifier: MIT
/**
 * The overlay paths the base suite does not drive: the dialog edges a caller is responsible for (the
 * cancel button, the alignment and width props), the popover's own trigger keys and the interval that
 * follows a moved trigger, the tooltip's re-show helper and its positioning math, and the drop-down
 * menu's keyboard navigation, submenus and repositioning.
 *
 * Fake timers appear where a component defers work on a timer of its own — the modal's close
 * animation and the 500ms interval the menus poll the trigger box with — and real timers everywhere
 * else, because the deferred work there is measured in single ticks.
 */
// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmationModal } from '@/components/overlays/ConfirmationModal';
import { DropDownMenu, type DropDownMenuItem } from '@/components/overlays/DropDownMenu';
import { FeedbackTooltip, showFeedbackTooltip } from '@/components/overlays/FeedbackTooltip';
import { Modal } from '@/components/overlays/Modal';
import { Popover } from '@/components/overlays/Popover';
import { act, click, flush, render, waitFor } from '@/util/testing/render';

/** Pins an element's measured box for one test, the way the global stub pins every other element's. */
function pinRect(element: Element, left: number, top: number, width: number, height: number): void {
  const rect: DOMRect = {
    x: left,
    y: top,
    width,
    height,
    left,
    top,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({
      x: left,
      y: top,
      width,
      height,
      left,
      top,
      right: left + width,
      bottom: top + height,
    }),
  };

  Object.defineProperty(element, 'getBoundingClientRect', {
    value: () => rect,
    writable: true,
    configurable: true,
  });
}

/** Dispatches a key down at the window, for the listeners the overlays hold there. */
function pressWindowKey(init: { key: string; code: string }): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });

  act(() => {
    window.dispatchEvent(event);
  });

  return event;
}

/** Dispatches a key down into the tree, the way a focused control reports one. */
function pressKey(element: Element, init: { key: string; code: string }): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });

  act(() => {
    element.dispatchEvent(event);
  });

  return event;
}

/** Reports the pointer entering or leaving an element the way a real move would. */
function hover(element: Element, kind: 'enter' | 'leave'): void {
  act(() => {
    element.dispatchEvent(new MouseEvent(kind === 'enter' ? 'mouseenter' : 'mouseleave'));
  });
}

/** The first button in the body, which pre-open is the trigger this group renders. */
function firstButton(): HTMLButtonElement {
  const button = document.body.querySelector<HTMLButtonElement>('button');

  if (button === null) {
    throw new Error('no button was rendered.');
  }

  return button;
}

/** The one button whose text contains `title`, for the buttons that are named rather than labelled. */
function buttonTitled(title: string): HTMLButtonElement {
  const button = [...document.body.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent?.includes(title) === true,
  );

  if (button === undefined) {
    throw new Error(`no button titled ${title} was rendered.`);
  }

  return button;
}

/** The cover the open menus portall over the page, or a failure naming what was rendered. */
function theCover(): HTMLButtonElement {
  const button = document.body.querySelector<HTMLButtonElement>('button[aria-label="Close"]');

  if (button === null) {
    throw new Error('no cover button was rendered.');
  }

  return button;
}

/** The titles of the menu items currently highlighted with a keyboard-driven path. */
function highlightedTitles(): string[] {
  return [...document.body.querySelectorAll<HTMLButtonElement>('[data-highlighted="true"]')].map(
    (button) => button.textContent ?? '',
  );
}

/** One menu per shape the navigation tests need, sharing item paths so updates stay comparable. */
function theMenu(onFirstSelect?: () => void, deeper?: DropDownMenuItem): DropDownMenuItem[] {
  const deeperItem: DropDownMenuItem = deeper ?? {
    path: ['deeper'],
    title: 'Deeper',
    icon: 'plus',
    submenu: [
      { path: ['deeper', 'inner'], title: 'Inner' },
      { path: ['deeper', 'inner2'], title: 'Inner2' },
    ],
  };

  return [
    // `onSelect` is required on a menu item, so it is set only when the caller handed one, rather
    // than set to the optional callback's `undefined`.
    onFirstSelect === undefined
      ? { path: ['first'], title: 'First' }
      : { path: ['first'], title: 'First', onSelect: onFirstSelect },
    { path: ['second'], title: 'Second' },
    deeperItem,
  ];
}

/** The menus a re-render hands back, each invalidating or keeping the path in its own way. */
const menuDeeperWithoutSubmenuKeys: DropDownMenuItem[] = [
  { path: ['first'], title: 'First' },
  { path: ['second'], title: 'Second' },
  { path: ['deeper'], title: 'Deeper' },
];
const menuDeeperWithEmptySubmenu: DropDownMenuItem[] = [
  { path: ['first'], title: 'First' },
  { path: ['second'], title: 'Second' },
  { path: ['deeper'], title: 'Deeper', submenu: [] },
];
const menuWithoutFirst: DropDownMenuItem[] = [
  { path: ['second'], title: 'Second' },
  { path: ['deeper'], title: 'Deeper' },
];
const menuWithOnlyUnrelated: DropDownMenuItem[] = [{ path: ['another'], title: 'Another' }];

describe('Modal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('aligns the panel to the top of the screen when the caller asks for it', async () => {
    const { find } = await render(
      <Modal open={true} onOpenChange={() => undefined} title="Settings" verticalAlignment="top">
        <p>Body</p>
      </Modal>,
    );

    const panel = find('.top-4');

    expect(panel.className).toContain('top-4');
    expect(panel.className).not.toContain('top-1/2');
  });

  it('drops the fixed body width when the caller asks for an unrestricted one', async () => {
    const { find } = await render(
      <Modal open={true} onOpenChange={() => undefined} title="Settings" noWidthRestriction={true}>
        <p>Body</p>
      </Modal>,
    );

    const body = find('.max-h-\\[80vh\\]');

    expect(body.className).not.toContain('w-[600px]');
  });

  it('keeps the fixed body width by default', async () => {
    const { find } = await render(
      <Modal open={true} onOpenChange={() => undefined} title="Settings">
        <p>Body</p>
      </Modal>,
    );

    expect(find('.max-h-\\[80vh\\]').className).toContain('w-[600px]');
  });

  it('unlocks the panel once its opening animation has run, so it becomes clickable', async () => {
    await render(
      <Modal open={true} onOpenChange={() => undefined} title="Settings">
        <p>Body</p>
      </Modal>,
    );

    const panel = document.querySelector<HTMLDivElement>('.origin-center');

    if (panel === null) {
      throw new Error('the dialog panel was not rendered.');
    }

    expect(panel.classList.contains('pointer-events-none')).toBe(true);

    // Keys other than Escape reach the page, the dialog stays open.
    const pressOther = pressWindowKey({ key: ' ', code: 'Space' });

    expect(pressOther.defaultPrevented).toBe(false);

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(document.querySelectorAll('.origin-center')).toHaveLength(1);
    expect(panel.classList.contains('pointer-events-none')).toBe(false);
    expect(panel.classList.contains('scale-1')).toBe(true);
  });
});

describe('ConfirmationModal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports the cancel button as a cancel, and names the buttons the caller gave', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    await render(
      <ConfirmationModal
        open={true}
        title="Remove the configuration?"
        message="This cannot be undone."
        confirmLabel="Remove"
        cancelLabel="Keep it"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(document.body.textContent).toContain('This cannot be undone.');
    expect(buttonTitled('Remove').textContent).toBe('Remove');
    expect(buttonTitled('Keep it').textContent).toBe('Keep it');

    await click(buttonTitled('Keep it'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('FeedbackTooltip', () => {
  it('places itself against the trigger the caller hands it', async () => {
    const firstTrigger = document.createElement('div');
    document.body.appendChild(firstTrigger);
    const { find, update } = await render(
      <FeedbackTooltip visible={true} title="Saved" trigger={firstTrigger} />,
    );

    // With nothing to read a height from, the tooltip keeps the whole viewport under its trigger.
    const wrapper = find('.scale-y-1');
    expect(wrapper.style.left).toBe('0px');
    expect(wrapper.style.top).toBe('768px');

    // A computed height jsdom can parse changes the room the tooltip keeps below its trigger, and
    // a second trigger re-runs the positioning that reads it.
    wrapper.style.height = '100px';
    const secondTrigger = document.createElement('div');
    document.body.appendChild(secondTrigger);
    await update(<FeedbackTooltip visible={true} title="Saved" trigger={secondTrigger} />);

    // The trigger's box is the stubbed one at the origin, so the tooltip hugs its bottom edge.
    expect(wrapper.style.left).toBe('0px');
    expect(wrapper.style.top).toBe('668px');
    secondTrigger.remove();
    firstTrigger.remove();
  });

  it('hides itself again after its own duration has passed', async () => {
    const { find } = await render(<FeedbackTooltip visible={true} duration={20} title="Saved" />);

    expect(find('.scale-y-1').textContent).toBe('Saved');

    await waitFor(() => document.querySelector('.scale-y-0') !== null);
  });

  it('re-shows a tooltip through the helper, replaying the animation', async () => {
    function Replay(): React.JSX.Element {
      const [visible, setVisible] = useState(false);

      return (
        <>
          <FeedbackTooltip visible={visible} title="Copied" />
          <button title="Show" type="button" onClick={() => showFeedbackTooltip(setVisible)}>
            Show
          </button>
        </>
      );
    }

    await render(<Replay />);

    await click(buttonTitled('Show'));
    await flush();

    expect(document.querySelector('.scale-y-1')?.textContent).toBe('Copied');
  });
});

describe('Popover', () => {
  it('reports the trigger click and the trigger keys it handles itself', async () => {
    const onOpenChange = vi.fn();
    const { find } = await render(
      <Popover
        open={false}
        onOpenChange={onOpenChange}
        trigger={<button type="button">Pick one</button>}
      >
        <p>Panel body</p>
      </Popover>,
    );

    const wrapper = find('[role="button"]');

    await click(buttonTitled('Pick one'));
    expect(onOpenChange).toHaveBeenLastCalledWith(true);

    const space = pressKey(wrapper, { key: ' ', code: 'Space' });
    expect(space.defaultPrevented).toBe(true);
    expect(onOpenChange).toHaveBeenLastCalledWith(true);

    pressKey(wrapper, { key: 'Enter', code: 'Enter' });
    expect(onOpenChange).toHaveBeenLastCalledWith(true);

    const other = pressKey(wrapper, { key: 'a', code: 'KeyA' });
    expect(other.defaultPrevented).toBe(false);
    expect(onOpenChange).toHaveBeenCalledTimes(3);
  });

  it('closes on Escape and hands the focus back to the trigger', async () => {
    const onOpenChange = vi.fn();
    const { find } = await render(
      <Popover
        open={true}
        onOpenChange={onOpenChange}
        trigger={<button type="button">Pick one</button>}
      >
        <p>Panel body</p>
      </Popover>,
    );

    // The panel is a dialog the popover moved the focus into on its own.
    expect(find('[role="dialog"]')).toBe(document.activeElement);

    const pressEscape = pressWindowKey({ key: 'Escape', code: 'Escape' });

    expect(pressEscape.defaultPrevented).toBe(true);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(document.activeElement).toBe(buttonTitled('Pick one'));
  });

  it('leaves the focus where the caller put it when asked not to autofocus', async () => {
    const onOpenChange = vi.fn();
    await render(
      <Popover open={true} onOpenChange={onOpenChange} noAutofocusToPanel={true}>
        <p>Panel body</p>
      </Popover>,
    );

    expect(document.activeElement?.getAttribute('role') ?? 'body').not.toBe('dialog');
  });

  it('ignores Escape while it is closed, and is not in the tree at all', async () => {
    const onOpenChange = vi.fn();
    await render(
      <Popover open={false} onOpenChange={onOpenChange}>
        <p>Panel body</p>
      </Popover>,
    );

    expect(document.querySelector('[role="dialog"]')).toBeNull();

    pressWindowKey({ key: 'Escape', code: 'Escape' });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('covers the page with a backdrop the caller can style, and closes on it', async () => {
    const onOpenChange = vi.fn();
    await render(
      <Popover
        open={true}
        onOpenChange={onOpenChange}
        hasBackDrop={true}
        backDropStyle={{ background: 'red' }}
      >
        <p>Panel body</p>
      </Popover>,
    );

    const backdrop = theCover();

    expect(backdrop.style.background).toBe('red');

    await click(backdrop);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders no backdrop when the caller asks for none', async () => {
    await render(
      <Popover open={true} onOpenChange={() => undefined}>
        <p>Panel body</p>
      </Popover>,
    );

    expect(document.body.querySelector('button[aria-label="Close"]')).toBeNull();
  });

  it('follows the trigger around within the window, on the interval it polls with', async () => {
    vi.useFakeTimers();
    try {
      const { find } = await render(
        <Popover
          open={true}
          onOpenChange={() => undefined}
          trigger={<button type="button">Pick one</button>}
          popoverClassName="caller-panel"
          popoverStyle={{ maxHeight: '10rem' }}
        >
          <p>Panel body</p>
        </Popover>,
      );

      const panel = find('[role="dialog"]');
      const trigger = buttonTitled('Pick one');

      expect(panel.className).toContain('caller-panel');
      expect(panel.style.maxHeight).toBe('10rem');
      // The stubbed box fills the window, so both clamps bottom out at the edges.
      expect(panel.style.left).toBe('0px');
      expect(panel.style.top).toBe('0px');

      // A smaller panel gives the vertical clamp room: the panel parks on its lowest edge.
      pinRect(panel, 0, 0, 200, 100);
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(panel.style.left).toBe('0px');
      expect(panel.style.top).toBe('668px');

      pinRect(trigger, 50, 400, 10, 10);
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(panel.style.left).toBe('50px');
      expect(panel.style.top).toBe('413px');

      // A second interval finds the box unchanged and redraws nothing.
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(panel.style.left).toBe('50px');
      expect(panel.style.top).toBe('413px');
    } finally {
      vi.useRealTimers();
    }
  });

  it('measures nothing for a panel mounted without a trigger to measure', async () => {
    vi.useFakeTimers();
    try {
      const { find } = await render(
        <Popover open={false} onOpenChange={() => undefined} forceMount={true}>
          <p>Panel body</p>
        </Popover>,
      );

      const panel = find('[role="dialog"]');
      expect(panel.className).toContain('opacity-0');

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(panel.className).toContain('opacity-0');
      expect(panel.style.left).toBe('0px');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('DropDownMenu', () => {
  it('walks the menu with the arrow keys and answers Enter', async () => {
    const onSelect = vi.fn();
    await render(<DropDownMenu menu={theMenu(onSelect)} />);

    await click(firstButton());

    expect(highlightedTitles()).toEqual([]);

    expect(pressWindowKey({ key: 'ArrowDown', code: 'ArrowDown' }).defaultPrevented).toBe(true);
    expect(highlightedTitles()).toContain('First');

    pressWindowKey({ key: 'ArrowDown', code: 'ArrowDown' });
    expect(highlightedTitles()).toContain('Second');

    pressWindowKey({ key: 'ArrowDown', code: 'ArrowDown' });
    expect(highlightedTitles()).toEqual(['Deeper']);

    // Moving down past the last item of the open panel changes nothing.
    pressWindowKey({ key: 'ArrowDown', code: 'ArrowDown' });
    expect(highlightedTitles()).toEqual(['Deeper']);

    pressWindowKey({ key: 'ArrowUp', code: 'ArrowUp' });
    expect(highlightedTitles()).toContain('Second');

    pressWindowKey({ key: 'ArrowUp', code: 'ArrowUp' });
    expect(highlightedTitles()).toContain('First');

    // Clamped at the first item, another step up stays put.
    pressWindowKey({ key: 'ArrowUp', code: 'ArrowUp' });
    expect(highlightedTitles()).toContain('First');

    pressWindowKey({ key: 'Enter', code: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(highlightedTitles()).toEqual([]);

    // Reopened, the path starts empty again rather than resuming where it left off.
    await click(firstButton());
    pressWindowKey({ key: 'ArrowDown', code: 'ArrowDown' });
    pressWindowKey({ key: 'Enter', code: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('toggles with Space while open, closes on Escape, and hands other keys on', async () => {
    await render(<DropDownMenu menu={theMenu()} />);

    await click(firstButton());
    expect(document.body.textContent).toContain('First');

    // An open menu toggles closed on Space.
    pressWindowKey({ key: ' ', code: 'Space' });
    expect(document.body.textContent).not.toContain('First');

    // Closed, the keys are not answered: nothing highlighted, no toggle back open.
    const pressEnterClosed = pressWindowKey({ key: 'Enter', code: 'Enter' });
    expect(pressEnterClosed.defaultPrevented).toBe(false);
    const pressOtherClosed = pressWindowKey({ key: 'x', code: 'KeyX' });
    expect(pressOtherClosed.defaultPrevented).toBe(false);

    await click(firstButton());
    expect(document.body.textContent).toContain('First');

    pressWindowKey({ key: 'Escape', code: 'Escape' });
    expect(document.body.textContent).not.toContain('First');

    await click(firstButton());
    const pressOther = pressWindowKey({ key: 'x', code: 'KeyX' });
    expect(pressOther.defaultPrevented).toBe(false);
    expect(document.body.textContent).toContain('First');
  });

  it('steps into a submenu with ArrowRight and back out with ArrowLeft', async () => {
    await render(<DropDownMenu menu={theMenu()} />);

    await click(firstButton());

    // Right with nothing highlighted changes nothing.
    pressWindowKey({ key: 'ArrowRight', code: 'ArrowRight' });
    expect(highlightedTitles()).toEqual([]);

    pressWindowKey({ key: 'ArrowDown', code: 'ArrowDown' });
    pressWindowKey({ key: 'ArrowDown', code: 'ArrowDown' });
    pressWindowKey({ key: 'ArrowDown', code: 'ArrowDown' });
    expect(highlightedTitles()).toEqual(['Deeper']);
    expect(document.body.textContent).toContain('Inner');

    // Enter on a submenu head is a step down a level, not a choice: the menu stays open.
    pressWindowKey({ key: 'Enter', code: 'Enter' });
    expect(highlightedTitles()).toEqual(['Deeper']);
    expect(document.body.textContent).toContain('Inner');

    pressWindowKey({ key: 'ArrowRight', code: 'ArrowRight' });
    expect(highlightedTitles()).toEqual(['Inner']);

    // Entering further is not a step: the highlighted item has no submenu of its own.
    pressWindowKey({ key: 'ArrowRight', code: 'ArrowRight' });
    expect(highlightedTitles()).toEqual(['Inner']);

    pressWindowKey({ key: 'ArrowLeft', code: 'ArrowLeft' });
    expect(highlightedTitles()).toEqual(['Deeper']);

    // Left at the top level stops at the root rather than clearing the path.
    pressWindowKey({ key: 'ArrowLeft', code: 'ArrowLeft' });
    expect(highlightedTitles()).toEqual(['Deeper']);

    // Both panels have been clamped to the window the stub reports: the nested one overflows off
    // the right edge and is parked on its left side instead.
    const panels = document.querySelectorAll<HTMLDivElement>('div.bg-bpd');

    expect(panels).toHaveLength(2);
    for (const panel of panels) {
      expect(panel.style.left).toBe('0px');
      expect(panel.style.top).toBe('0px');
      expect(panel.className).not.toContain('invisible');
    }
  });

  it('opens a submenu pane when its parent item is hovered', async () => {
    await render(<DropDownMenu menu={theMenu()} />);

    await click(firstButton());

    hover(buttonTitled('Deeper'), 'enter');

    expect(highlightedTitles()).toEqual(['Deeper']);
    expect(document.body.textContent).toContain('Inner');
  });

  it('closes from the item that was chosen, the cover, and not from a submenu head', async () => {
    await render(<DropDownMenu menu={theMenu()} />);

    await click(firstButton());
    // A leaf item without an action still closes the menu.
    await click(buttonTitled('Second'));
    expect(document.body.textContent).not.toContain('Second');

    await click(firstButton());
    pressWindowKey({ key: 'ArrowDown', code: 'ArrowDown' });
    pressWindowKey({ key: 'ArrowDown', code: 'ArrowDown' });
    pressWindowKey({ key: 'ArrowDown', code: 'ArrowDown' });
    expect(document.body.textContent).toContain('Inner');

    // The head of a submenu is a step into it, not a choice of it.
    await click(buttonTitled('Deeper'));
    expect(document.body.textContent).toContain('Inner');

    await click(theCover());
    expect(document.body.textContent).not.toContain('Inner');
  });

  it('renders a button trigger with the caller decorations and reports its pointer events', async () => {
    const onTriggerClick = vi.fn();
    const onTriggerEnter = vi.fn();
    const onTriggerLeave = vi.fn();
    await render(
      <DropDownMenu
        variant="button"
        triggerIcon="plus"
        triggerTitle="Options"
        triggerTitleStyle={{ color: 'red' }}
        triggerHoverTitle="not-for-button"
        triggerClassName="caller-trigger"
        triggerStyle={{ margin: '1px' }}
        triggerIconStyle={{ color: 'blue' }}
        onTriggerClick={onTriggerClick}
        onTriggerMouseEnter={onTriggerEnter}
        onTriggerMouseLeave={onTriggerLeave}
        menu={theMenu()}
      />,
    );

    const trigger = firstButton();

    expect(trigger.textContent).toContain('Options');
    expect(trigger.querySelector('svg')).not.toBeNull();
    expect(trigger.className).toContain('caller-trigger');
    expect(trigger.style.margin).toBe('1px');
    expect(trigger.getAttribute('title')).toBeNull();

    hover(trigger, 'enter');
    expect(onTriggerEnter).toHaveBeenCalledTimes(1);

    hover(trigger, 'leave');
    expect(onTriggerLeave).toHaveBeenCalledTimes(1);

    await click(trigger);
    expect(onTriggerClick).toHaveBeenCalledTimes(1);
  });

  it('falls back to the chevron for a button trigger named no icon', async () => {
    await render(<DropDownMenu variant="button" triggerTitle="Options" menu={theMenu()} />);

    const trigger = firstButton();

    expect(trigger.textContent).toContain('Options');
    expect(trigger.querySelector('svg')).not.toBeNull();
  });

  it('names the dots trigger from the hover title when there is one, and the locale when not', async () => {
    const { find } = await render(
      <DropDownMenu
        menu={theMenu()}
        triggerHoverTitle="Custom"
        triggerIcon="plus"
        triggerStyle={{ margin: '2px' }}
        triggerIconStyle={{ color: 'blue' }}
      />,
    );

    const trigger = firstButton();

    expect(trigger.getAttribute('title')).toBe('Custom');
    expect(trigger.style.margin).toBe('2px');
    expect(trigger.querySelector('svg')).not.toBeNull();
    // An unopened dots trigger carries an explicit transparent background, not a class of its own.
    expect(find('.bg-transparent')).not.toBeNull();
  });

  it('follows the moved trigger on its polling interval and closes on the cover', async () => {
    vi.useFakeTimers();
    // The menu panel is remounted whenever the box it hangs off changes, so the stub the panels
    // measure with is replaced at the prototype for the duration: every pane reads back as a small
    // box, which leaves the clamps inside the window and a moved trigger observable in the pane's
    // position.
    const measured = window.Element.prototype.getBoundingClientRect;
    const paneRect = (() => {
      const rect: DOMRect = {
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        left: 0,
        top: 0,
        right: 200,
        bottom: 100,
        toJSON: () => ({
          x: 0,
          y: 0,
          width: 200,
          height: 100,
          left: 0,
          top: 0,
          right: 200,
          bottom: 100,
        }),
      };

      return () => rect;
    })();
    window.Element.prototype.getBoundingClientRect = function () {
      return this.className?.includes?.('bg-bpd') === true ? paneRect() : measured.apply(this, []);
    };
    try {
      await render(<DropDownMenu menu={theMenu()} />);

      const trigger = firstButton();
      await click(trigger);

      const panel = document.querySelector<HTMLDivElement>('div.bg-bpd');

      if (panel === null) {
        throw new Error('the menu panel was not rendered.');
      }

      // The first poll finds the trigger where it was: the pane hangs below its full-height box,
      // clamped to the bottom edge of the window.
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(panel.style.left).toBe('0px');
      expect(panel.style.top).toBe('668px');

      pinRect(trigger, 50, 400, 10, 10);
      act(() => {
        vi.advanceTimersByTime(500);
      });

      const moved = document.querySelector<HTMLDivElement>('div.bg-bpd');

      if (moved === null) {
        throw new Error('the moved menu panel was not rendered.');
      }

      expect(moved.style.left).toBe('50px');
      expect(moved.style.top).toBe('413px');

      // The next poll sees the same box and redraws nothing.
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(moved.style.left).toBe('50px');

      await click(theCover());
      expect(document.body.textContent).not.toContain('Inner');
    } finally {
      window.Element.prototype.getBoundingClientRect = measured;
      vi.useRealTimers();
    }
  });

  it('drops a highlighted path the re-rendered menu no longer holds', async () => {
    const { update } = await render(<DropDownMenu menu={theMenu()} />);

    await click(firstButton());
    pressWindowKey({ key: 'ArrowDown', code: 'ArrowDown' });
    pressWindowKey({ key: 'ArrowDown', code: 'ArrowDown' });
    pressWindowKey({ key: 'ArrowDown', code: 'ArrowDown' });
    pressWindowKey({ key: 'ArrowRight', code: 'ArrowRight' });
    expect(highlightedTitles()).toEqual(['Inner']);

    // The deepest item's submenu emptied out: the path names an item that is not there.
    await update(<DropDownMenu menu={menuDeeperWithEmptySubmenu} />);
    expect(highlightedTitles()).toEqual([]);

    await update(<DropDownMenu menu={theMenu()} />);
    pressWindowKey({ key: 'ArrowDown', code: 'ArrowDown' });
    pressWindowKey({ key: 'ArrowDown', code: 'ArrowDown' });
    pressWindowKey({ key: 'ArrowDown', code: 'ArrowDown' });
    pressWindowKey({ key: 'ArrowRight', code: 'ArrowRight' });
    expect(highlightedTitles()).toEqual(['Inner']);

    // The intermediate item lost its submenu: the path can no longer be walked.
    await update(<DropDownMenu menu={menuDeeperWithoutSubmenuKeys} />);
    expect(highlightedTitles()).toEqual([]);

    // A highlighted leaf that exists is kept across a re-render.
    pressWindowKey({ key: 'ArrowDown', code: 'ArrowDown' });
    pressWindowKey({ key: 'ArrowDown', code: 'ArrowDown' });
    pressWindowKey({ key: 'ArrowDown', code: 'ArrowDown' });
    expect(highlightedTitles()).toEqual(['Deeper']);
    await update(<DropDownMenu menu={menuWithoutFirst} />);
    expect(highlightedTitles()).toEqual(['Deeper']);

    // An item the new menu does not hold at all: the whole path is dropped.
    await update(<DropDownMenu menu={menuWithOnlyUnrelated} />);
    expect(highlightedTitles()).toEqual([]);
    expect(document.body.textContent).toContain('Another');
  });

  it('answers an empty menu with an empty path', async () => {
    await render(<DropDownMenu menu={[]} />);

    await click(firstButton());

    pressWindowKey({ key: 'ArrowDown', code: 'ArrowDown' });
    pressWindowKey({ key: 'ArrowUp', code: 'ArrowUp' });

    expect(highlightedTitles()).toEqual([]);
  });

  it('renders the panes the caller decorated, with placeholder and icon states', async () => {
    await render(
      <DropDownMenu
        menu={theMenu()}
        dropDownListStyle={{ minWidth: '4rem' }}
        menuItemClassName="caller-item"
        menuItemIconStyle={{ color: 'green' }}
        menuItemIconMoreStyle={{ color: 'orange' }}
      />,
    );

    const trigger = firstButton();
    await click(trigger);

    const items = [...document.body.querySelectorAll<HTMLButtonElement>('button.caller-item')];

    // First has no icon and a placeholder box; Deeper carries one and a submenu chevron.
    expect(
      items.find((item) => item.textContent?.includes('First') === true)?.querySelector('svg'),
    ).toBeNull();
    expect(
      items.find((item) => item.textContent?.includes('Deeper') === true)?.querySelector('svg'),
    ).not.toBeNull();
    expect(buttonTitled('First').className).toContain('caller-item');
    expect(document.querySelector('div.bg-bpd')?.getAttribute('style')).toContain('min-width');
  });
});
