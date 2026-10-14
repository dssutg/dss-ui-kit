// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  defaultPieChartColors,
  getPieChartShareEndAngle,
  getShareColor,
  getSharePercent,
  mapToShares,
  PieChart,
} from '@/components/charts/PieChart';
import { act, render } from '@/util/testing/render';

/** The 2d context methods the pie chart uses, as spies a test can read. */
function fakeContext() {
  return {
    fillStyle: '',
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    arc: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
  };
}

/** Answers every canvas `getContext` with `answer`, restoring the original after the test. */
function stubGetContext(answer: () => unknown): void {
  const original = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext');

  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: answer,
  });

  afterEach(() => {
    if (original !== undefined) {
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', original);
    }
  });
}

/** Dispatches a `mousemove` at the given client point, inside `act`. */
function dispatchMouseMove(canvas: Element, clientX: number, clientY: number): void {
  act(() => {
    canvas.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX, clientY }));
  });
}

const halfShares = [
  { title: 'first', percent: 50, color: '#111111' },
  { title: 'second', percent: 50, color: '#222222' },
];

describe('PieChart helpers', () => {
  it('reports a share of the total as a percentage', () => {
    expect(getSharePercent(3, 4)).toBe(75);
  });

  it('reports an empty total as full rather than dividing by zero', () => {
    expect(getSharePercent(0, 0)).toBe(100);
  });

  it('gives each share the next colour of the palette', () => {
    expect(getShareColor({ shareIndex: 1, totalShares: 3 })).toBe(defaultPieChartColors[1]);
  });

  it('does not give the last share the first share colour when another is available', () => {
    const colors = ['#111111', '#222222'];

    expect(getShareColor({ shareIndex: 2, totalShares: 3, colors })).toBe('#222222');
  });

  it('keeps the first colour when the palette has nothing else to offer', () => {
    expect(getShareColor({ shareIndex: 0, totalShares: 1, colors: ['#111111'] })).toBe('#111111');
  });

  it('falls back to the default palette rather than to no colour at all', () => {
    expect(getShareColor({ shareIndex: 2, totalShares: 4, colors: [] })).toBe(
      defaultPieChartColors[2],
    );
  });

  it('turns counted records into slices with a title, a percentage and a colour', () => {
    const shares = mapToShares([{ count: 3 }, { count: 1 }], 4, () => ({
      title: 'x',
      count: 3,
    }));

    expect(shares).toHaveLength(2);
    expect(shares[0]?.percent).toBe(75);
  });

  it('clamps a share of more than the whole, so slices cannot overlap', () => {
    expect(getPieChartShareEndAngle(0, 140)).toBeCloseTo(Math.PI * 2);
  });
});

describe('PieChart', () => {
  it('draws a slice per share, shifted away from the centre by the margin', async () => {
    const context = fakeContext();

    stubGetContext(() => context);

    const { find } = await render(
      <PieChart shares={halfShares} radius={50} shareMarginDegrees={4} />,
    );

    expect(find<HTMLCanvasElement>('canvas').width).toBe(100);
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 100, 100);
    expect(context.arc).toHaveBeenCalledTimes(2);
    expect(context.fill).toHaveBeenCalledTimes(2);
  });

  it('draws nothing when the canvas has no 2d context', async () => {
    stubGetContext(() => null);

    const { find } = await render(<PieChart shares={halfShares} radius={50} />);

    expect(find<HTMLCanvasElement>('canvas')).toBeDefined();
  });

  it('names the share the pointer is over, as a title', async () => {
    stubGetContext(() => fakeContext());

    const { find } = await render(<PieChart shares={halfShares} radius={50} />);

    const canvas = find('canvas');

    dispatchMouseMove(canvas, 50, 50);

    expect(canvas.getAttribute('title')).toBe('first - 50%');
  });

  it('shows no title while the pointer is outside the circle', async () => {
    stubGetContext(() => fakeContext());

    const { find } = await render(<PieChart shares={halfShares} radius={50} />);

    const canvas = find('canvas');

    dispatchMouseMove(canvas, 5000, 5000);

    expect(canvas.getAttribute('title')).toBe('');
  });

  it('clears the title when the pointer leaves the share it was over', async () => {
    stubGetContext(() => fakeContext());

    const { find } = await render(<PieChart shares={halfShares} radius={50} />);

    const canvas = find('canvas');

    dispatchMouseMove(canvas, 50, 50);
    dispatchMouseMove(canvas, 5000, 5000);

    expect(canvas.getAttribute('title')).toBe('');
  });

  it('shows no title for a point inside the circle but in a gap between slices', async () => {
    stubGetContext(() => fakeContext());

    const shares = [
      { title: 'small', percent: 10, color: '#111111' },
      { title: 'smaller', percent: 10, color: '#222222' },
    ];

    const { find } = await render(<PieChart shares={shares} radius={50} />);

    const canvas = find('canvas');

    dispatchMouseMove(canvas, 20, 50);

    expect(canvas.getAttribute('title')).toBe('');
  });
});
