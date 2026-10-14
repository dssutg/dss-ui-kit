// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RingProgress } from '@/components/charts/RingProgress';
import { render } from '@/util/testing/render';

/** The 2d context methods the ring uses, as spies a test can read. */
function fakeContext() {
  return {
    lineWidth: 0,
    strokeStyle: '',
    lineCap: '',
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
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

describe('RingProgress', () => {
  it('draws a background ring and a progress arc, with the progress as text', async () => {
    const context = fakeContext();

    stubGetContext(() => context);

    const { find, findByText } = await render(<RingProgress progress={40} title="40 of 100" />);

    expect(find<HTMLCanvasElement>('canvas').width).toBe(140);
    expect(context.arc).toHaveBeenCalledTimes(2);
    expect(context.fillText).toHaveBeenCalledWith('40%', 70, 70);
    expect(findByText('40 of 100')).toBeDefined();
  });

  it('draws only the background ring at zero progress', async () => {
    const context = fakeContext();

    stubGetContext(() => context);

    await render(<RingProgress progress={0} />);

    expect(context.arc).toHaveBeenCalledTimes(1);
    expect(context.fillText).toHaveBeenCalledWith('0%', 70, 70);
  });

  it('puts the title above the ring when asked to', async () => {
    stubGetContext(() => fakeContext());

    const { findByText } = await render(
      <RingProgress progress={10} title="above" titlePos="top" />,
    );

    expect(findByText('above')).toBeDefined();
  });

  it('accepts a colour that is not a valid CSS colour, without a colour of its own', async () => {
    const context = fakeContext();

    stubGetContext(() => context);

    await render(
      <RingProgress
        progress={50}
        colorBreakPoints={[
          [0, 'not-a-colour'],
          [100, '#e55f5f'],
        ]}
        interpolation={false}
      />,
    );

    expect(context.stroke).toHaveBeenCalled();
  });

  it('draws nothing when the canvas has no 2d context', async () => {
    stubGetContext(() => null);

    const { find } = await render(<RingProgress progress={40} />);

    expect(find<HTMLCanvasElement>('canvas')).toBeDefined();
  });

  it('renders only the canvas when there is no title', async () => {
    stubGetContext(() => fakeContext());

    const { container, find } = await render(<RingProgress progress={0} />);

    expect(find<HTMLCanvasElement>('canvas')).toBeDefined();
    expect(container.textContent).toBe('');
  });
});
