// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { formatChartHSL, MAX_SCALE, MIN_SCALE, SCALE_FACTOR } from '@/components/charts/Chart';
import { MiniCalendar } from '@/components/charts/MiniCalendar';
import {
  defaultPieChartColors,
  getPieChartShareEndAngle,
  getShareColor,
  getSharePercent,
  mapToShares,
  PieChart,
} from '@/components/charts/PieChart';
import { RingProgress } from '@/components/charts/RingProgress';
import { SimpleLineChart } from '@/components/charts/SimpleLineChart';
import { StaticCalendar } from '@/components/charts/StaticCalendar';
import { ZoomableCanvas } from '@/components/charts/ZoomableCanvas';
import { act, click, render } from '@/lib/testing/render';

/** A shape with no subject in it: what a chart is counting is the caller's business. */
interface Entry {
  readonly label: string;
  readonly count: number;
}

const entries: Entry[] = [
  { label: 'alpha', count: 3 },
  { label: 'beta', count: 1 },
];

describe('PieChart', () => {
  describe('getSharePercent', () => {
    it('is a share of the total, as a percentage', () => {
      expect(getSharePercent(3, 4)).toBe(75);
    });

    it('reports an empty total as full rather than dividing by zero', () => {
      // A share of nothing is not 0%, which would draw no slice at all, nor NaN, which would put the
      // arc somewhere no arc goes.
      expect(getSharePercent(0, 0)).toBe(100);
    });
  });

  describe('getShareColor', () => {
    it('gives each share the next colour of the palette', () => {
      expect(getShareColor({ shareIndex: 1, totalShares: 3 })).toBe(defaultPieChartColors[1]);
    });

    it('wraps around the palette when there are more shares than colours', () => {
      const shareIndex = defaultPieChartColors.length;

      // Two more shares than the palette has, so the wrapped share is not also the last one.
      expect(getShareColor({ shareIndex, totalShares: shareIndex + 2 })).toBe(
        defaultPieChartColors[0],
      );
    });

    it("does not give the last share the first share's colour", () => {
      const colors = ['#111111', '#222222'];

      // With two shares and two colours the last one would wrap onto the first, and a pie with two
      // identically coloured slices shows one.
      expect(getShareColor({ shareIndex: 1, totalShares: 2, colors })).toBe('#222222');
      expect(getShareColor({ shareIndex: 1, totalShares: 2, colors })).not.toBe('#111111');
    });

    it('falls back to the default palette rather than to no colour at all', () => {
      expect(getShareColor({ shareIndex: 2, totalShares: 4, colors: [] })).toBe(
        defaultPieChartColors[2],
      );
    });
  });

  describe('mapToShares', () => {
    it("turns counted records into slices of the total, keeping the caller's order", () => {
      const shares = mapToShares(entries, 4, (entry) => ({
        title: entry.label,
        count: entry.count,
      }));

      expect(shares.map((share) => share.title)).toEqual(['alpha', 'beta']);
      expect(shares.map((share) => share.percent)).toEqual([75, 25]);
    });

    it('returns nothing for no records, rather than a slice for nothing', () => {
      expect(mapToShares([], 0, () => ({ title: '', count: 0 }))).toEqual([]);
    });
  });

  describe('getPieChartShareEndAngle', () => {
    it('ends a quarter of the way round the circle at a quarter of it', () => {
      expect(getPieChartShareEndAngle(0, 25)).toBeCloseTo(Math.PI / 2);
    });

    it('starts where the previous slice ended', () => {
      const first = getPieChartShareEndAngle(0, 25);

      expect(getPieChartShareEndAngle(first, 25)).toBeCloseTo(Math.PI);
    });

    it('clamps a share of more than the whole, so slices cannot overlap', () => {
      // A rounding error in a caller's counts must not draw one slice over the next.
      expect(getPieChartShareEndAngle(0, 140)).toBeCloseTo(Math.PI * 2);
    });
  });

  it('draws a canvas twice the radius it was given', async () => {
    const shares = mapToShares(entries, 4, (entry) => ({ title: entry.label, count: entry.count }));
    const { find } = await render(<PieChart shares={shares} radius={50} />);

    const canvas = find<HTMLCanvasElement>('canvas');

    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(100);
  });
});

describe('Chart', () => {
  it('keeps the zoom inside a range a chart can still be read at', () => {
    // A chart zoomed out until it is a line of pixels and one zoomed in until it is a single pixel is
    // a chart nobody can read, so both ends are bounded and the wheel moves by a fraction of a step.
    expect(MIN_SCALE).toBeGreaterThan(0);
    expect(MIN_SCALE).toBeLessThan(1);
    expect(MAX_SCALE).toBeGreaterThan(1);
    expect(SCALE_FACTOR).toBeGreaterThan(0);
    expect(SCALE_FACTOR).toBeLessThan(1);
  });

  it('writes a hue as the CSS a canvas fillStyle takes', () => {
    // Modern space-separated syntax, which `fillStyle` accepts and which needs no commas to be
    // mistyped into an invalid colour.
    expect(formatChartHSL([120, 50, 50])).toBe('hsl(120 50% 50%)');
  });
});

describe('RingProgress', () => {
  it('renders a canvas and the title it was given', async () => {
    const { find, findByText } = await render(<RingProgress progress={40} title="40 of 100" />);

    expect(find<HTMLCanvasElement>('canvas')).toBeDefined();
    expect(findByText('40 of 100')).toBeDefined();
  });

  it('renders only the canvas when there is no title', async () => {
    const { container, find } = await render(<RingProgress progress={0} />);

    expect(find<HTMLCanvasElement>('canvas')).toBeDefined();
    expect(container.textContent).toBe('');
  });
});

describe('SimpleLineChart', () => {
  it('renders a canvas inside a box that has been measured', async () => {
    const { find } = await render(<SimpleLineChart yPoints={[1, 2, 3]} />);

    // The chart is drawn inside an autosizer, so a canvas at all means the box was measured and the
    // draw callback ran rather than the chart sitting empty.
    expect(find<HTMLCanvasElement>('canvas')).toBeDefined();
  });
});

describe('ZoomableCanvas', () => {
  const transform = { scale: 1, offsetX: 0, offsetY: 0 };

  it('renders a canvas at the size it was given', async () => {
    const { find } = await render(
      <ZoomableCanvas
        width={320}
        height={200}
        transform={transform}
        onTransformChange={() => undefined}
        drawCallback={() => undefined}
      />,
    );

    const canvas = find<HTMLCanvasElement>('canvas');

    expect(canvas.width).toBe(320);
    expect(canvas.height).toBe(200);
  });

  it('reports where the pointer went down, in canvas pixels', async () => {
    const onClickAt = vi.fn();
    const { find } = await render(
      <ZoomableCanvas
        width={320}
        height={200}
        transform={transform}
        onTransformChange={() => undefined}
        drawCallback={() => undefined}
        onClickAt={onClickAt}
      />,
    );

    const canvas = find('canvas');

    act(() => {
      canvas.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, clientX: 40, clientY: 30 }),
      );
    });
    act(() => {
      canvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 40, clientY: 30 }));
    });

    // The canvas sits at the origin of the document, so canvas pixels are the client coordinates.
    expect(onClickAt).toHaveBeenCalledWith(40, 30);
  });

  it('reports no click for a drag, which is a pan and not a click', async () => {
    const onClickAt = vi.fn();
    const { find } = await render(
      <ZoomableCanvas
        width={320}
        height={200}
        transform={transform}
        onTransformChange={() => undefined}
        drawCallback={() => undefined}
        onClickAt={onClickAt}
      />,
    );

    const canvas = find('canvas');

    act(() => {
      canvas.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, clientX: 40, clientY: 30 }),
      );
    });
    act(() => {
      canvas.dispatchEvent(
        new MouseEvent('mousemove', { bubbles: true, clientX: 90, clientY: 30 }),
      );
    });
    act(() => {
      canvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 90, clientY: 30 }));
    });

    expect(onClickAt).not.toHaveBeenCalled();
  });

  it('zooms with the wheel and stays inside the scale it was given', async () => {
    const onTransformChange = vi.fn();
    const { find } = await render(
      <ZoomableCanvas
        width={320}
        height={200}
        transform={transform}
        onTransformChange={onTransformChange}
        drawCallback={() => undefined}
        minScale={0.5}
        maxScale={2}
      />,
    );

    const canvas = find<HTMLCanvasElement>('canvas');

    for (let zoom = 0; zoom < 20; zoom++) {
      act(() => {
        canvas.dispatchEvent(
          new WheelEvent('wheel', { bubbles: true, deltaY: -100, clientX: 10, clientY: 10 }),
        );
      });
    }

    // A chart that can be zoomed past the point where it is readable is a chart an operator cannot
    // undo, so the bounds are the contract and the new scale is reported rather than applied here.
    expect(onTransformChange).toHaveBeenCalled();
    for (const [{ scale }] of onTransformChange.mock.calls) {
      expect(scale).toBeLessThanOrEqual(2);
      expect(scale).toBeGreaterThanOrEqual(0.5);
    }
  });
});

describe('StaticCalendar', () => {
  it('names the month the date is in, and draws its days', async () => {
    const { find, findByText } = await render(<StaticCalendar date={new Date(2024, 4, 15)} />);

    // The heading is what an operator reads to know which month the grid below belongs to; it is one
    // element holding the whole title rather than a caption beside the grid.
    expect(find('h2').textContent).toBe('May, 2024');
    expect(findByText('15')).toBeDefined();
  });

  it('holds no state of its own: the same date twice gives the same tree', async () => {
    const first = await render(<StaticCalendar date={new Date(2024, 4, 15)} />);
    const second = await render(<StaticCalendar date={new Date(2024, 4, 15)} />);

    expect(first.container.innerHTML).toBe(second.container.innerHTML);
  });
});

describe('MiniCalendar', () => {
  const date = new Date(2024, 4, 15);

  it('renders the month but hides it while it is not visible', async () => {
    const { find, findByText } = await render(
      <MiniCalendar visible={false} date={date} posX={10} posY={20} onClose={() => undefined} />,
    );

    expect(find<HTMLButtonElement>('button').style.display).toBe('none');
    expect(findByText('15')).toBeDefined();
  });

  it('shows itself when it is visible, and closes on a click anywhere', async () => {
    const onClose = vi.fn();
    const { find } = await render(
      <MiniCalendar visible date={date} posX={10} posY={20} onClose={onClose} />,
    );

    expect(find<HTMLButtonElement>('button').style.display).toBe('block');

    await click(find('button'));

    expect(onClose).toHaveBeenCalled();
  });
});
