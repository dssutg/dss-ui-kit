// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { Accordion, useAccordion } from '@/components/navigation/Accordion';
import { click, render } from '@/util/testing/render';

/** A probe that renders what `useAccordion` reports, because its two modes have no other window. */
function AccordionHookProbe({
  expanded,
  mode,
  fixedSize,
  attachRef,
}: {
  readonly expanded: boolean;
  readonly mode?: 'vertical' | 'horizontal' | undefined;
  readonly fixedSize?: number | undefined;
  readonly attachRef: boolean;
}) {
  const { contentRef, contentStyle } = useAccordion(expanded, mode, fixedSize);

  return (
    <div ref={attachRef ? contentRef : null} data-testid="content">
      <span data-testid="style">{JSON.stringify(contentStyle)}</span>
    </div>
  );
}

describe('useAccordion', () => {
  it('measures vertical content and animates its height', async () => {
    const { find } = await render(<AccordionHookProbe expanded={true} attachRef={true} />);

    const style = find('[data-testid="style"]').textContent ?? '';

    expect(style).toContain('"transition":"height 0.3s ease-in-out, opacity 0.3s ease-in-out"');
    expect(style).not.toContain('"width"');
    expect(style).toContain('"opacity":1');
  });

  it('measures horizontal content and animates its width', async () => {
    const { find } = await render(
      <AccordionHookProbe expanded={true} mode="horizontal" attachRef={true} />,
    );

    const style = find('[data-testid="style"]').textContent ?? '';

    expect(style).toContain('"transition":"width 0.3s ease-in-out, opacity 0.3s ease-in-out"');
    expect(style).not.toContain('"height"');
  });

  it('uses a fixed size instead of measuring when one is given', async () => {
    const { find } = await render(
      <AccordionHookProbe expanded={true} fixedSize={250} attachRef={true} />,
    );

    expect(find('[data-testid="style"]').textContent).toContain('"height":250');
  });

  it('collapses to zero without measuring anything', async () => {
    const { find } = await render(<AccordionHookProbe expanded={false} attachRef={true} />);

    const style = find('[data-testid="style"]').textContent ?? '';

    expect(style).toContain('"height":0');
    expect(style).toContain('"opacity":0');
  });

  it('leaves the size alone while there is no element to measure', async () => {
    const { find } = await render(<AccordionHookProbe expanded={true} attachRef={false} />);

    expect(find('[data-testid="style"]').textContent).toContain('"height":"auto"');
  });
});

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
      <Accordion expanded={true} onExpansionChange={onExpansionChange} triggerTitle="Details">
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

  it('applies contentClassName to the content, which is the only place it can mean anything', async () => {
    const { container } = await render(
      <Accordion
        expanded={true}
        onExpansionChange={() => undefined}
        triggerTitle="Details"
        contentClassName="gap-8"
      >
        <p>Body</p>
      </Accordion>,
    );

    const content = container.querySelector('section');

    expect(content?.className).toContain('gap-8');
    expect(container.querySelector('button')?.className).not.toContain('gap-8');
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

  it('ignores keys that are not activations', async () => {
    const onExpansionChange = vi.fn();
    const { find } = await render(
      <Accordion expanded={false} onExpansionChange={onExpansionChange} triggerTitle="Details" />,
    );

    find<HTMLButtonElement>('button').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'a', bubbles: true }),
    );

    expect(onExpansionChange).not.toHaveBeenCalled();
  });

  it('renders a node trigger as it is, rather than wrapping it in a line of text', async () => {
    const { container } = await render(
      <Accordion
        expanded={true}
        onExpansionChange={() => undefined}
        triggerTitle={<span data-testid="node-trigger">Node</span>}
      />,
    );

    expect(container.querySelector('.truncate')).toBeNull();
    expect(container.querySelector('[data-testid="node-trigger"]')).not.toBeNull();
  });

  it('wraps a string trigger in the truncating line', async () => {
    const { container } = await render(
      <Accordion expanded={true} onExpansionChange={() => undefined} triggerTitle="Plain" />,
    );

    expect(container.querySelector('.truncate')?.textContent).toBe('Plain');
  });

  it('renders the components a caller puts before and after the trigger', async () => {
    const { findByText } = await render(
      <Accordion
        expanded={true}
        onExpansionChange={() => undefined}
        triggerTitle="Details"
        beforeTriggerComponent={<span>Before</span>}
        afterTriggerComponent={<span>After</span>}
      />,
    );

    expect(findByText('Before')).toBeDefined();
    expect(findByText('After')).toBeDefined();
  });

  it('lets a caller override the content style', async () => {
    const { container } = await render(
      <Accordion
        expanded={true}
        onExpansionChange={() => undefined}
        triggerTitle="Details"
        getContentStyle={(isExpanded) => ({ opacity: isExpanded ? 0.5 : 0, overflow: 'auto' })}
      >
        <p>Body</p>
      </Accordion>,
    );

    const content = container.querySelector('section');

    expect(content?.style.opacity).toBe('0.5');
    expect(content?.style.overflow).toBe('auto');
  });

  it('points its chevron the other way when flippedIcon says so', async () => {
    const { container, update } = await render(
      <Accordion
        expanded={false}
        flippedIcon={true}
        onExpansionChange={() => undefined}
        triggerTitle="Details"
      />,
    );

    expect(container.querySelector('svg')?.getAttribute('class')).toContain('rotate-180');

    await update(
      <Accordion
        expanded={true}
        flippedIcon={true}
        onExpansionChange={() => undefined}
        triggerTitle="Details"
      />,
    );

    expect(container.querySelector('svg')?.getAttribute('class')).not.toContain('rotate-180');
  });

  it('points its chevron down while collapsed when it is not flipped', async () => {
    const { container } = await render(
      <Accordion expanded={false} onExpansionChange={() => undefined} triggerTitle="Details" />,
    );

    expect(container.querySelector('svg')?.getAttribute('class')).not.toContain('rotate-180');
  });
});
