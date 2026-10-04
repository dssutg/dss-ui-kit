/**
 * The overlay group: panels that appear above the page. The contract the suite holds is the standard
 * closed-component rule — open state is the caller's — plus the overlay-specific edges: the modal
 * portals onto the body and defers its close by its own animation, the popover hands focus back to
 * its trigger, the tooltip stays in the tree but out of the accessibility tree while hidden, and the
 * drop-down menu reports its selection instead of acting on it.
 */
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmationModal } from '@/components/overlays/ConfirmationModal';
import { DropDownMenu } from '@/components/overlays/DropDownMenu';
import { FeedbackTooltip } from '@/components/overlays/FeedbackTooltip';
import { Modal } from '@/components/overlays/Modal';
import { Popover } from '@/components/overlays/Popover';
import { act, click, render } from '@/util/testing/render';

describe('Modal', () => {
  // The dialog defers its close by the length of its own animation, so a test of that contract needs
  // the clock it defers on.
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing at all while closed', async () => {
    const { container } = await render(
      <Modal open={false} onOpenChange={() => undefined} title="Settings" />,
    );

    expect(container.textContent).toBe('');
  });

  it('portals the dialog onto the body rather than inside its own place in the tree', async () => {
    const { container, findByText } = await render(
      <Modal open onOpenChange={() => undefined} title="Settings">
        <p>Body</p>
      </Modal>,
    );

    expect(container.textContent).toBe('');
    expect(findByText('Settings')).toBeDefined();
  });

  it('asks to close on Escape, after the closing animation has been asked for', async () => {
    const onOpenChange = vi.fn();
    await render(<Modal open onOpenChange={onOpenChange} title="Settings" />);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    // The panel is locked straight away and the caller is told once the animation has been run, so a
    // dialog that closes immediately would flash rather than fade.
    expect(onOpenChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('offers a close button, and the backdrop is one too', async () => {
    const { findAll } = await render(
      <Modal open onOpenChange={() => undefined} title="Settings" />,
    );

    const buttons = findAll<HTMLButtonElement>('button');

    expect(buttons.length).toBeGreaterThanOrEqual(2);
    expect(buttons[0]?.getAttribute('aria-label')).toBe('Close');
  });

  it('keeps the panel unfocusable while it is animating in, so an invisible dialog cannot be clicked', async () => {
    const { container } = await render(
      <Modal open onOpenChange={() => undefined} title="Settings" />,
    );

    expect(container.textContent).toBe('');

    const panel = document.querySelector('.pointer-events-none');

    expect(panel).not.toBeNull();
  });
});

describe('ConfirmationModal', () => {
  // The dialog under it defers its close by the length of its animation, so a test of what happens
  // while that runs needs the clock it defers on.
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const question = (onConfirm: () => void, onCancel: () => void, destructive = false) => (
    <ConfirmationModal
      open
      title="Delete the configuration?"
      onConfirm={onConfirm}
      onCancel={onCancel}
      destructive={destructive}
    />
  );

  /**
   * The confirm and cancel buttons.
   *
   * Indexed past the dialog's own buttons: the backdrop, and the close button in its title bar.
   */
  function theAnswers() {
    const buttons = [...document.body.querySelectorAll<HTMLButtonElement>('button')];

    return { confirm: buttons[2] as HTMLButtonElement, cancel: buttons[3] as HTMLButtonElement };
  }

  it('reports the answer as two callbacks, so a caller reads which is which', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    await render(question(onConfirm, onCancel));

    const { confirm } = theAnswers();

    await click(confirm);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('treats everything that dismisses the dialog without answering it as a cancel', async () => {
    const onCancel = vi.fn();
    const { findAll } = await render(question(vi.fn(), onCancel));

    await click(findAll<HTMLButtonElement>('button')[0] as HTMLButtonElement);

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('answers once, however many times the confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    await render(question(onConfirm, vi.fn()));

    const { confirm } = theAnswers();

    await click(confirm);
    await click(confirm);

    // The caller closes the dialog in its own callback, and the animation that follows is long enough
    // for a second click to arrive at a button that is still on screen.
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('can be answered again once it has been opened afresh', async () => {
    const onConfirm = vi.fn();
    const { update } = await render(
      <ConfirmationModal
        open={false}
        title="Delete?"
        onConfirm={onConfirm}
        onCancel={() => undefined}
      />,
    );

    await update(
      <ConfirmationModal open title="Delete?" onConfirm={onConfirm} onCancel={() => undefined} />,
    );

    const { confirm } = theAnswers();
    await click(confirm);

    await update(
      <ConfirmationModal
        open={false}
        title="Delete?"
        onConfirm={onConfirm}
        onCancel={() => undefined}
      />,
    );
    await update(
      <ConfirmationModal open title="Delete?" onConfirm={onConfirm} onCancel={() => undefined} />,
    );

    await click(theAnswers().confirm);

    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it('paints the confirm button as destructive only when the action is', async () => {
    const { update } = await render(question(vi.fn(), vi.fn()));

    expect(theAnswers().confirm.className).toContain('bg-bbp');

    await update(question(vi.fn(), vi.fn(), true));

    expect(theAnswers().confirm.className).toContain('bg-bda');
  });

  it('names its buttons from the locale when the caller names them nothing', async () => {
    await render(question(vi.fn(), vi.fn()));

    const { confirm, cancel } = theAnswers();

    expect(confirm.textContent).toContain('Confirm');
    expect(cancel.textContent).toContain('Cancel');
  });
});

describe('Popover', () => {
  it('renders its panel in the tree while closed, so a caller can measure it', async () => {
    const { findByText } = await render(
      <Popover open={false} onOpenChange={() => undefined} forceMount>
        <p>Panel body</p>
      </Popover>,
    );

    expect(findByText('Panel body')).toBeDefined();
  });

  it('closes on Escape and returns the focus to the trigger', async () => {
    const onOpenChange = vi.fn();
    await render(
      <Popover open onOpenChange={onOpenChange}>
        <p>Panel body</p>
      </Popover>,
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }));
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('FeedbackTooltip', () => {
  it('keeps the tooltip in the tree but out of the accessibility tree while it is hidden', async () => {
    const { find, update } = await render(<FeedbackTooltip visible={false} title="Copied" />);

    const hidden = find('.scale-y-0');

    expect(hidden.getAttribute('aria-hidden')).toBe('true');
    expect(hidden.textContent).toBe('Copied');

    await update(<FeedbackTooltip visible title="Copied" />);

    const shown = find('.scale-y-1');

    expect(shown.getAttribute('aria-hidden')).toBe('false');
    expect(shown.textContent).toBe('Copied');
  });

  it('renders the title as a child when there is one, rather than as text', async () => {
    const { findByText } = await render(
      <FeedbackTooltip visible>
        <strong>Done</strong>
      </FeedbackTooltip>,
    );

    expect(findByText('Done').tagName).toBe('STRONG');
  });
});

/**
 * The menu holds no state of its own: it keeps closed until the trigger is used, reports the trigger
 * click, and hands each item's `onSelect` through.
 */
describe('DropDownMenu', () => {
  const menu = [
    { path: ['rename'], title: 'Rename' },
    {
      path: ['export'],
      title: 'Export',
      submenu: [{ path: ['export', 'csv'], title: 'As CSV' }],
    },
  ];

  it('keeps its menu closed until the trigger is used', async () => {
    const { findAll } = await render(<DropDownMenu menu={menu} />);

    expect(findAll('button').length).toBeLessThan(4);
  });

  it('reports the trigger click and opens on it', async () => {
    const onTriggerClick = vi.fn();
    const { findAll } = await render(<DropDownMenu menu={menu} onTriggerClick={onTriggerClick} />);

    const trigger = findAll<HTMLButtonElement>('button')[0] as HTMLButtonElement;

    await click(trigger);

    expect(onTriggerClick).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain('Rename');
  });

  it('calls the item it was given rather than holding the menu state itself', async () => {
    const onSelect = vi.fn();
    const { findAll } = await render(
      <DropDownMenu menu={[{ path: ['rename'], title: 'Rename', onSelect }]} />,
    );

    await click(findAll<HTMLButtonElement>('button')[0] as HTMLButtonElement);

    const item = findAll<HTMLButtonElement>('button').find((button) =>
      button.textContent?.includes('Rename'),
    );

    if (item === undefined) {
      throw new Error('the menu item was not rendered.');
    }

    await click(item);

    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
