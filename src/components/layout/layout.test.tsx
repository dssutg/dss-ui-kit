/**
 * The layout group's two components, which are the ones that measure rather than be measured.
 *
 * `AutoSizer` is the only class component in the library: it renders nothing until it has measured
 * its parent, then hands the size to a child function. The environment stubs the measurements the
 * way `src/util/testing/setup.ts` describes, so the size a test sees is a fixed one rather than
 * whatever the machine's layout happens to be.
 *
 * `ResizableSplit` renders one panel per entry with a divider between them, and the divider's only
 * visual contract that a test can read is its drag axis — a column divider in a row, a row divider
 * in a column.
 */
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { AutoSizer } from '@/components/layout/AutoSizer';
import { ResizableSplit } from '@/components/layout/ResizableSplit';
import { render } from '@/util/testing/render';

describe('AutoSizer', () => {
  it('hands its child the size of the box it was placed in, once measured', async () => {
    const { findByText } = await render(
      <AutoSizer>{(size) => <span>{`${size.width}x${size.height}`}</span>}</AutoSizer>,
    );

    expect(findByText('1024x768')).toBeDefined();
  });
});

describe('ResizableSplit', () => {
  it('renders a panel per entry and one divider between them', async () => {
    const { findByText, findAll } = await render(
      <ResizableSplit
        panels={[
          { id: 'left', component: <span>Left</span> },
          { id: 'right', component: <span>Right</span> },
        ]}
      />,
    );

    expect(findByText('Left')).toBeDefined();
    expect(findByText('Right')).toBeDefined();
    expect(findAll('div.cursor-col-resize')).toHaveLength(1);
  });

  it('splits along a column when asked for a vertical orientation', async () => {
    const { findAll } = await render(
      <ResizableSplit
        orientation="vertical"
        panels={[
          { id: 'top', component: <span>Top</span> },
          { id: 'bottom', component: <span>Bottom</span> },
        ]}
      />,
    );

    expect(findAll('div.cursor-row-resize')).toHaveLength(1);
  });
});
