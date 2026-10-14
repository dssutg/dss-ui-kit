// SPDX-License-Identifier: MIT
/**
 * The measuring half of the layout group, driven the way the base suite leaves it: the resize paths
 * `AutoSizer` takes when the realm has no ResizeObserver (the scroll-driven detector), the axes it is
 * asked not to measure, the box it reports before its first measurement, and the drag the split's
 * sizer turns into a percentage.
 *
 * The environment stubs every element's measurements the same fixed box; the tests that need a
 * different box pin it on the one element they care about rather than unstubbing the world.
 */
// @vitest-environment jsdom
import { createPortal } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AutoSizer, type Size } from '@/components/layout/AutoSizer';
import { ResizableSplit } from '@/components/layout/ResizableSplit';
import { act, flush, type RenderResult, render, waitFor } from '@/util/testing/render';

/** A DOMRect at the given box, complete enough for the measurement reads the components make. */
function rectAt(left: number, top: number, width: number, height: number): DOMRect {
  return {
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
}

/** Pins one element's whole measurement set: offsets, client box and the rect the reads are made from. */
function pinMeasuredBox(element: HTMLElement, width: number, height: number): void {
  Object.defineProperty(element, 'offsetWidth', { value: width, configurable: true });
  Object.defineProperty(element, 'offsetHeight', { value: height, configurable: true });
  Object.defineProperty(element, 'getBoundingClientRect', {
    value: () => rectAt(0, 0, width, height),
    writable: true,
    configurable: true,
  });
}

/** Pins only the scaled box, so the whole-pixel size stays where it was. */
function pinScaledBox(element: Element, width: number, height: number): void {
  Object.defineProperty(element, 'getBoundingClientRect', {
    value: () => rectAt(0, 0, width, height),
    writable: true,
    configurable: true,
  });
}

/**
 * Hides the realm's ResizeObserver for the duration of `run`, so `AutoSizer` takes the scroll-driven
 * detector it keeps for environments without one. Unstubbing restores whatever was there.
 */
async function withoutResizeObserver<T>(run: () => Promise<T>): Promise<T> {
  vi.stubGlobal('ResizeObserver', undefined);

  try {
    return await run();
  } finally {
    vi.unstubAllGlobals();
  }
}

/**
 * Answers one CSS property of the inline-style prototype with a decided value, the way an engine
 * would, and hands the prototype and the previous descriptor back for the test to restore.
 *
 * The style object of an element in this realm stores its properties as accessors on the prototype
 * nearest it, so only that prototype has to be redefined for the detector's support probe to hear a
 * different answer.
 */
function decideComputedStyleProperty(
  sample: CSSStyleDeclaration,
  name: string,
  value: string | undefined,
): { prototype: object; original: PropertyDescriptor | undefined } {
  const prototype: object | null = Object.getPrototypeOf(sample);

  if (prototype === null) {
    throw new Error('the style object has no prototype to redefine.');
  }

  const original = Object.getOwnPropertyDescriptor(prototype, name);

  Object.defineProperty(prototype, name, {
    get: value === undefined ? () => undefined : () => value,
    set: () => undefined,
    configurable: true,
  });

  return { prototype, original };
}

/** Undoes one {@link decideComputedStyleProperty} decision, restoring or clearing the accessor. */
function restoreComputedStyleProperty(
  prototype: object,
  name: string,
  original: PropertyDescriptor | undefined,
): void {
  if (original === undefined) {
    Object.defineProperty(prototype, name, {
      get: () => undefined,
      set: () => undefined,
      configurable: true,
    });
  } else {
    Object.defineProperty(prototype, name, original);
  }
}

/** Fires a scroll that bubbles, the way the detector's hidden triggers report their own overflow. */
function scroll(element: EventTarget): Event {
  const event = new Event('scroll', { bubbles: true });

  act(() => {
    element.dispatchEvent(event);
  });

  return event;
}

/** An `animationstart` the realm cannot build natively, carrying the name the listener matches on. */
class FakeAnimationEvent extends Event {
  public readonly animationName: string;

  public constructor(type: string, animationName: string) {
    super(type);
    this.animationName = animationName;
  }
}

describe('AutoSizer', () => {
  it('hands its child the size of the box it was placed in, and reports the measurement', async () => {
    const onResize = vi.fn();
    const { find } = await render(
      <AutoSizer onResize={onResize}>
        {(size: Size) => <span>{`${size.width}x${size.height}`}</span>}
      </AutoSizer>,
    );

    expect(find('span').textContent).toBe('1024x768');
    expect(onResize).toHaveBeenCalledWith({
      width: 1024,
      height: 768,
      scaledWidth: 1024,
      scaledHeight: 768,
    });
  });

  it('keeps the caller style on the outer box it renders, on the tag the caller named', async () => {
    const { find } = await render(
      <AutoSizer tagName="span" className="caller-box" style={{ backgroundColor: 'red' }}>
        {(size: Size) => <span>{`${size.width}`}</span>}
      </AutoSizer>,
    );

    const outer = find('span.caller-box');

    expect(outer.style.backgroundColor).toBe('red');
    // The outer box never forces a size: the child is the one that overflows into the measurement.
    expect(outer.style.height).toBe('0px');
    expect(outer.style.overflow).toBe('visible');
  });

  it('reports through one axis only when the caller disables the other', async () => {
    const { find } = await render(
      <AutoSizer disableHeight={true}>
        {(size) => <span>{Object.keys(size).join(',')}</span>}
      </AutoSizer>,
    );

    expect(find('span').textContent).toBe('width,scaledWidth');
  });

  it('reports a height only when the width is left to someone else', async () => {
    const { find } = await render(
      <AutoSizer disableWidth={true}>
        {(size) => <span>{Object.keys(size).join(',')}</span>}
      </AutoSizer>,
    );

    expect(find('span').textContent).toBe('height,scaledHeight');
  });

  it('renders nothing before its first measurement lands on something', async () => {
    const { query, update } = await render(
      <div
        ref={(element) => {
          if (element !== null) {
            pinMeasuredBox(element, 0, 0);
          }
        }}
      >
        <AutoSizer>{(size: Size) => <span>{`${size.width}x${size.height}`}</span>}</AutoSizer>
      </div>,
    );

    expect(query('span')).toBeNull();

    // A caller may still insist on children inside a box that measures to nothing.
    await update(
      <div
        ref={(element) => {
          if (element !== null) {
            pinMeasuredBox(element, 0, 0);
          }
        }}
      >
        <AutoSizer doNotBailOutOnEmptyChildren={true}>
          {(size: Size) => <span>{`${size.width}x${size.height}`}</span>}
        </AutoSizer>
      </div>,
    );

    expect(query('span')?.textContent).toBe('0x0');
  });

  it('hears a scaled-only change through its detector', async () => {
    await withoutResizeObserver(async () => {
      const onResize = vi.fn();
      const { container, find, query } = await render(
        <div>
          <AutoSizer onResize={onResize}>
            {(size: Size) => <span>{`${size.scaledHeight}`}</span>}
          </AutoSizer>
        </div>,
      );

      expect(find('span').textContent).toBe('768');

      const parent = container.querySelector('div');

      if (parent === null) {
        throw new Error('the autosizer parent was not rendered.');
      }

      // A zoom or a transform answers a bigger rect while the offsets stay put, which is why the
      // two scales are compared on their own.
      pinScaledBox(parent, 1024, 999);

      const contract = parent.querySelector('.contract-trigger');

      if (contract === null) {
        throw new Error('the contract trigger was not rendered.');
      }

      scroll(contract);
      await waitFor(() => query('span')?.textContent === '999');

      expect(onResize).toHaveBeenCalledTimes(2);
    });
  });

  it('measures nothing when its parent belongs to a document with no window', async () => {
    const detached = document.implementation.createHTMLDocument('detached');
    const host = detached.createElement('div');

    await render(
      createPortal(
        <AutoSizer doNotBailOutOnEmptyChildren={true} defaultWidth={100} defaultHeight={50}>
          {(size: Size) => <span title={`${size.width}x${size.height}`}>x</span>}
        </AutoSizer>,
        host,
      ),
      // The render result's own container stays empty: the portal takes the tree.
    );

    // No window means no measurement ran: the child saw the defaults the caller handed in.
    expect(host.querySelector('span')?.getAttribute('title')).toBe('100x50');
  });

  it('measures through the scroll-driven detector when the realm has no ResizeObserver', async () => {
    // The stylesheet is created once per document; the nonce lands only on its own creation.
    document.head.querySelector('#detectElementResize')?.remove();

    await withoutResizeObserver(async () => {
      const onResize = vi.fn();
      const { container, find } = await render(
        <div>
          <AutoSizer nonce="test-nonce" onResize={onResize}>
            {(size: Size) => <span>{`${size.width}x${size.height}`}</span>}
          </AutoSizer>
        </div>,
      );

      expect(find('span').textContent).toBe('1024x768');
      expect(onResize).toHaveBeenCalled();

      const parent = container.querySelector('div');

      if (parent === null) {
        throw new Error('the autosizer parent was not rendered.');
      }

      // The detector makes its parent `relative` so the triggers it appends can overlay it.
      expect(parent.style.position).toBe('relative');
      expect(parent.querySelector('.resize-triggers')?.children).toHaveLength(2);
      expect(parent.querySelector('.contract-trigger')).not.toBeNull();

      const style = document.head.querySelector('#detectElementResize');

      expect(style?.getAttribute('nonce')).toBe('test-nonce');
      expect(style?.getAttribute('type')).toBe('text/css');
    });
  });

  it('recreates its stylesheet without a nonce when another document needs one', async () => {
    document.head.querySelector('#detectElementResize')?.remove();

    await withoutResizeObserver(async () => {
      const { find } = await render(
        <div>
          <AutoSizer>{(size: Size) => <span>{`${size.width}`}</span>}</AutoSizer>
        </div>,
      );

      expect(find('span').textContent).toBe('1024');

      const style = document.head.querySelector('#detectElementResize');

      expect(style).not.toBeNull();
      expect(style?.getAttribute('nonce')).toBeNull();
      // jsdom claims the standard spelling, so the keyframes carry no vendor prefix.
      expect(style?.textContent).toContain('@keyframes resizeanim');
      expect(style?.textContent).not.toContain('-webkit-');
    });
  });

  it('spells the animation the way the engine prefixes it', async () => {
    const sample = document.createElement('span');
    const renamed = decideComputedStyleProperty(sample.style, 'animationName', undefined);
    const prefixed = decideComputedStyleProperty(sample.style, 'WebkitAnimationName', 'x');

    document.head.querySelector('#detectElementResize')?.remove();

    try {
      await withoutResizeObserver(async () => {
        const { find } = await render(
          <div>
            <AutoSizer>{(size: Size) => <span>{`${size.width}`}</span>}</AutoSizer>
          </div>,
        );

        expect(find('span').textContent).toBe('1024');

        const style = document.head.querySelector('#detectElementResize');

        expect(style?.textContent).toContain('@-webkit-keyframes resizeanim');
      });
    } finally {
      restoreComputedStyleProperty(renamed.prototype, 'animationName', renamed.original);
      restoreComputedStyleProperty(prefixed.prototype, 'WebkitAnimationName', prefixed.original);
    }
  });

  it('falls back to the standard spelling when no prefix is claimed either', async () => {
    const sample = document.createElement('span');
    const renamed = decideComputedStyleProperty(sample.style, 'animationName', undefined);
    const claims: { name: string; prototype: object; original: PropertyDescriptor | undefined }[] =
      [];
    for (const prefix of ['Webkit', 'Moz', 'O', 'ms']) {
      const name = `${prefix}AnimationName`;
      claims.push({ name, ...decideComputedStyleProperty(sample.style, name, undefined) });
    }

    document.head.querySelector('#detectElementResize')?.remove();

    try {
      await withoutResizeObserver(async () => {
        const { find } = await render(
          <div>
            <AutoSizer>{(size: Size) => <span>{`${size.width}`}</span>}</AutoSizer>
          </div>,
        );

        expect(find('span').textContent).toBe('1024');

        const style = document.head.querySelector('#detectElementResize');

        expect(style?.textContent).toContain('@keyframes resizeanim');
      });
    } finally {
      restoreComputedStyleProperty(renamed.prototype, 'animationName', renamed.original);
      for (const { name, prototype, original } of claims) {
        restoreComputedStyleProperty(prototype, name, original);
      }
    }
  });

  it('re-measures when its triggers scroll, and hears nothing when nothing changed', async () => {
    await withoutResizeObserver(async () => {
      const onResize = vi.fn();
      const { container, query } = await render(
        <div
          ref={(element) => {
            if (element !== null) {
              pinMeasuredBox(element, 0, 0);
            }
          }}
        >
          <AutoSizer onResize={onResize}>
            {(size: Size) => <span>{`${size.width}x${size.height}`}</span>}
          </AutoSizer>
        </div>,
      );

      expect(query('span')).toBeNull();

      const parent = container.querySelector('div');

      if (parent === null) {
        throw new Error('the autosizer parent was not rendered.');
      }

      // The box the detector watches grows, and the scroll its triggers report carries the news.
      pinMeasuredBox(parent, 1024, 768);

      const contract = parent.querySelector('.contract-trigger');

      if (contract === null) {
        throw new Error('the contract trigger was not rendered.');
      }

      scroll(contract);
      await waitFor(() => query('span') !== null);

      expect(query('span')?.textContent).toBe('1024x768');
      expect(onResize).toHaveBeenCalledTimes(1);

      // The second scroll finds the size unchanged and reports nothing.
      scroll(contract);
      await flush();

      expect(onResize).toHaveBeenCalledTimes(1);

      // Scrolls from a child with a name of its own are not the detector's business.
      const foreign = document.createElement('div');
      foreign.className = 'foreign';
      parent.appendChild(foreign);
      scroll(foreign);
      await flush();

      expect(onResize).toHaveBeenCalledTimes(1);

      // A target that is not an element has no class to check, and the detector still re-measures.
      const text = document.createTextNode('');
      parent.appendChild(text);
      scroll(text);
      await flush();

      expect(onResize).toHaveBeenCalledTimes(1);
    });
  });

  it('collapses two scrolls into the one frame between them', async () => {
    await withoutResizeObserver(async () => {
      const onResize = vi.fn();
      const { container, find } = await render(
        <div>
          <AutoSizer onResize={onResize}>
            {(size: Size) => <span>{`${size.width}`}</span>}
          </AutoSizer>
        </div>,
      );

      const parent = container.querySelector('div');

      if (parent === null) {
        throw new Error('the autosizer parent was not rendered.');
      }

      const contract = parent.querySelector('.contract-trigger');

      if (contract === null) {
        throw new Error('the contract trigger was not rendered.');
      }

      scroll(contract);
      // The second scroll lands before the first one's frame, cancelling it.
      scroll(contract);
      await waitFor(() => document.body.querySelector('span') !== null);

      expect(find('span').textContent).toBe('1024');

      // One frame fired for two scrolls.
      expect(onResize).toHaveBeenCalledTimes(1);
    });
  });

  it('resets its triggers when the animation that restarts them plays', async () => {
    await withoutResizeObserver(async () => {
      const { container, find } = await render(
        <div>
          <AutoSizer>{(size: Size) => <span>{`${size.width}`}</span>}</AutoSizer>
        </div>,
      );

      const parent = container.querySelector('div');

      if (parent === null) {
        throw new Error('the autosizer parent was not rendered.');
      }

      const triggers = parent.querySelector<HTMLDivElement>('.resize-triggers');

      if (triggers === null) {
        throw new Error('the resize triggers were not rendered.');
      }

      // The only child of the expand trigger is the box it grows to measure against.
      const expandChild = triggers.querySelector<HTMLDivElement>('.expand-trigger > div');

      if (expandChild === null) {
        throw new Error('the expand trigger child was not rendered.');
      }

      // A different animation does not restart the triggers.
      triggers.dispatchEvent(new FakeAnimationEvent('animationstart', 'another-anim'));
      expect(expandChild.style.width).toBe('1025px');

      expandChild.style.width = '1px';
      triggers.dispatchEvent(new FakeAnimationEvent('animationstart', 'resizeanim'));
      expect(expandChild.style.width).toBe('1025px');

      expect(find('span').textContent).toBe('1024');
    });
  });

  it('shares one set of triggers between the autosizers placed in the same box', async () => {
    document.head.querySelector('#detectElementResize')?.remove();

    await withoutResizeObserver(async () => {
      const autosizer = (key: string) => (
        <AutoSizer key={key}>{(size: Size) => <span>{`${size.width}-${key}`}</span>}</AutoSizer>
      );
      const { findAll, update } = await render(<div>{autosizer('first')}</div>);

      expect(findAll('span')).toHaveLength(1);

      await update(
        <div>
          {autosizer('first')}
          {autosizer('second')}
        </div>,
      );

      expect(findAll('span')).toHaveLength(2);

      // The second autosizer reuses the first one's triggers instead of attaching its own.
      expect(document.querySelectorAll('.resize-triggers')).toHaveLength(1);

      await update(<div>{autosizer('second')}</div>);

      // The first one's removal leaves one listener behind, so nothing is torn down yet.
      expect(document.querySelectorAll('.resize-triggers')).toHaveLength(1);

      await update(<div />);

      // With the last listener gone, the triggers go with it.
      expect(document.querySelectorAll('.resize-triggers')).toHaveLength(0);
    });
  });

  it('leaves the triggers where its element no longer holds them', async () => {
    await withoutResizeObserver(async () => {
      const { query, unmount } = await render(
        <div>
          <AutoSizer>{(size: Size) => <span>{`${size.width}`}</span>}</AutoSizer>
        </div>,
      );

      expect(document.querySelectorAll('.resize-triggers')).toHaveLength(1);

      // A caller that prunes the triggers itself leaves the detector nothing to remove.
      document.querySelector('.resize-triggers')?.remove();
      unmount();

      expect(document.querySelectorAll('.resize-triggers')).toHaveLength(0);
      expect(query('span')).toBeNull();
    });
  });
});

describe('ResizableSplit', () => {
  /** The first divider of the given kind the split rendered, with the panel it resizes. */
  function theDivider(
    result: RenderResult,
    selector: string,
  ): { sizer: HTMLDivElement; panel: HTMLElement } {
    const sizer = result.findAll<HTMLDivElement>(selector)[0];

    if (sizer === undefined) {
      throw new Error('the divider was not rendered.');
    }

    const panel = sizer.parentElement;

    if (panel === null) {
      throw new Error('the panel around the divider was not rendered.');
    }

    return { sizer, panel };
  }

  it('takes the proportions the caller names and gives the last panel the rest', async () => {
    const result = await render(
      <ResizableSplit
        panels={[
          { id: 'left', component: <span>Left</span>, initialSize: 50, minSize: 10, maxSize: 90 },
          { id: 'middle', component: <span>Middle</span> },
          { id: 'right', component: <span>Right</span> },
        ]}
      />,
    );

    const { panel } = theDivider(result, 'div.cursor-col-resize');

    expect(result.findByText('Left')).toBeDefined();
    expect(panel.style.width).toBe('50%');
    expect(panel.style.minWidth).toBe('10%');
    expect(panel.style.maxWidth).toBe('90%');

    // The panel between the sizers takes the untouched share of what is left.
    expect(result.findByText('Middle').parentElement?.parentElement?.style.width).toContain(
      '33.33',
    );

    // The last panel grows to fill: React renders its zero width as 0px and gives it the grow.
    const last = result.findByText('Right').parentElement?.parentElement;

    expect(last?.style.width).toBe('0px');
    expect(last?.style.flexGrow).toBe('1');
  });

  it('drags a divider to resize the panel it belongs to, and puts the cursor back', async () => {
    const result = await render(
      <ResizableSplit
        panels={[
          { id: 'left', component: <span>Left</span> },
          { id: 'right', component: <span>Right</span> },
        ]}
      />,
    );

    const { sizer, panel } = theDivider(result, 'div.cursor-col-resize');

    act(() => {
      sizer.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: 100 }),
      );
    });

    expect(document.body.style.cursor).toBe('col-resize');

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: 512 }),
      );
    });

    // The stub box is 1024 wide and the panel held half of it, so the drag to 512 lands on a quarter.
    expect(panel.style.width).toBe('25%');

    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    expect(document.body.style.cursor).toBe('');
  });

  it('keeps the drag inside the minimum and maximum the panel was given', async () => {
    const result = await render(
      <ResizableSplit
        panels={[
          { id: 'left', component: <span>Left</span>, minSize: 10, maxSize: 30 },
          { id: 'right', component: <span>Right</span> },
        ]}
      />,
    );

    const { sizer, panel } = theDivider(result, 'div.cursor-col-resize');

    act(() => {
      sizer.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: 100 }),
      );
    });

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: 1200 }),
      );
    });

    expect(panel.style.width).toBe('30%');

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: -100 }),
      );
    });

    expect(panel.style.width).toBe('10%');

    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    expect(document.body.style.cursor).toBe('');
  });

  it('drags the row divider of a column split', async () => {
    const result = await render(
      <ResizableSplit
        orientation="vertical"
        panels={[
          { id: 'top', component: <span>Top</span> },
          { id: 'bottom', component: <span>Bottom</span> },
        ]}
      />,
    );

    const { sizer, panel } = theDivider(result, 'div.cursor-row-resize');

    act(() => {
      sizer.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientY: 100 }),
      );
    });

    expect(document.body.style.cursor).toBe('row-resize');

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientY: 384 }),
      );
    });

    // The stub box is 768 tall and the top panel held half of it: dragging to 384 is a quarter.
    expect(panel.style.height).toBe('25%');
    expect(panel.style.width).toBe('');

    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    expect(document.body.style.cursor).toBe('');
  });

  it('re-applies the requested size when the caller changes it', async () => {
    const { findAll, update } = await render(
      <ResizableSplit
        panels={[
          { id: 'left', component: <span>Left</span>, initialSize: 60 },
          { id: 'right', component: <span>Right</span> },
        ]}
      />,
    );

    const sizer = findAll<HTMLDivElement>('div.cursor-col-resize')[0];

    expect(sizer?.parentElement?.style.width).toBe('60%');

    await update(
      <ResizableSplit
        panels={[
          { id: 'left', component: <span>Left</span>, initialSize: 40 },
          { id: 'right', component: <span>Right</span> },
        ]}
      />,
    );

    expect(sizer?.parentElement?.style.width).toBe('40%');
  });

  it('wraps the panels in the overflow the caller asks for', async () => {
    const { findByText, find } = await render(
      <ResizableSplit
        childrenOverflow="overflow-hidden"
        className="caller-split"
        panels={[{ id: 'only', component: <span>Only</span> }]}
      />,
    );

    expect(findByText('Only').parentElement?.className).toContain('overflow-hidden');
    expect(find('.caller-split')).toBeDefined();
  });
});
