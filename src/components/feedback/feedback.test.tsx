// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { ContinuousCircleSpinner } from '@/components/feedback/ContinuousCircleSpinner';
import { DashedCircle } from '@/components/feedback/DashedCircle';
import { LogOutputTextArea } from '@/components/feedback/LogOutputTextArea';
import { LogWidget } from '@/components/feedback/LogWidget';
import { Ripple } from '@/components/feedback/Ripple';
import { ScrollProgressBar } from '@/components/feedback/ScrollProgressBar';
import { Spinner } from '@/components/feedback/Spinner';
import { click, render } from '@/lib/testing/render';

describe('Spinner', () => {
  it('renders without a provider, a theme or a locale', async () => {
    const { find } = await render(<Spinner />);

    expect(find('div')).toBeDefined();
  });
});

describe('ContinuousCircleSpinner', () => {
  it('is indeterminate: it takes no percentage and only draws a rotating ring', async () => {
    const { container } = await render(<ContinuousCircleSpinner />);

    const spinner = container.querySelector('div');

    expect(spinner?.className).toContain('animate-spin');
    expect(spinner?.getAttribute('role')).toBeNull();
  });
});

describe('DashedCircle', () => {
  it('is named by its title rather than by its shape', async () => {
    const { container } = await render(<DashedCircle title="Connected" />);

    const svg = container.querySelector('svg');

    if (svg === null) {
      throw new Error('DashedCircle rendered no svg.');
    }

    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Connected');
  });

  it('draws no ring while inactive', async () => {
    const { container } = await render(<DashedCircle active={false} title="Connected" />);

    expect(container.querySelector('animate')).toBeNull();
  });
});

describe('Ripple', () => {
  it('is decorative, so it takes no place in the accessibility tree', async () => {
    const { container } = await render(<Ripple color="#fff" />);

    expect(container.querySelector('span')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('ScrollProgressBar', () => {
  it('renders the track it fills', async () => {
    const { container } = await render(<ScrollProgressBar />);

    expect(container.querySelectorAll('div').length).toBeGreaterThan(1);
  });
});

describe('LogOutputTextArea', () => {
  it('shows the output and refuses to be typed into', async () => {
    const { find } = await render(<LogOutputTextArea output={'first line\nsecond line'} />);

    const textarea = find<HTMLTextAreaElement>('textarea');

    expect(textarea.value).toBe('first line\nsecond line');
    expect(textarea.readOnly).toBe(true);
  });

  it('stops wrapping long lines only when asked', async () => {
    const { find, update } = await render(<LogOutputTextArea output="x" />);

    expect(find('textarea').className).not.toContain('whitespace-pre');

    await update(<LogOutputTextArea output="x" dontWrapLongLines />);

    expect(find('textarea').className).toContain('whitespace-pre');
  });
});

describe('LogWidget', () => {
  it('reports play or pause depending on what it is doing, rather than toggling itself', async () => {
    const onPlayClick = vi.fn();
    const onPauseClick = vi.fn();
    const { find, findByText, update } = await render(
      <LogWidget
        title="Output"
        playing
        output="ready"
        onPlayClick={onPlayClick}
        onPauseClick={onPauseClick}
        onClearClick={() => undefined}
      />,
    );

    expect(findByText('Output')).toBeDefined();
    expect(find<HTMLTextAreaElement>('textarea').value).toBe('ready');

    await click(find<HTMLButtonElement>('button'));

    expect(onPauseClick).toHaveBeenCalledTimes(1);
    expect(onPlayClick).not.toHaveBeenCalled();

    await update(
      <LogWidget
        title="Output"
        playing={false}
        output="ready"
        onPlayClick={onPlayClick}
        onPauseClick={onPauseClick}
        onClearClick={() => undefined}
      />,
    );

    await click(find<HTMLButtonElement>('button'));

    expect(onPlayClick).toHaveBeenCalledTimes(1);
  });

  it('reports a request to clear without clearing the output itself', async () => {
    const onClearClick = vi.fn();
    const { findAll, find } = await render(
      <LogWidget
        title="Output"
        playing={false}
        output="still here"
        onPlayClick={() => undefined}
        onPauseClick={() => undefined}
        onClearClick={onClearClick}
      />,
    );

    await click(findAll<HTMLButtonElement>('button')[1] as HTMLButtonElement);

    expect(onClearClick).toHaveBeenCalledTimes(1);
    expect(find<HTMLTextAreaElement>('textarea').value).toBe('still here');
  });
});
