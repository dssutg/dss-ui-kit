// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToTop } from '@/components/navigation/ToTop';
import { act, click, render } from '@/util/testing/render';

function scrollTo(y: number): void {
  act(() => {
    window.scrollY = y;
    window.dispatchEvent(new Event('scroll'));
  });
}

describe('ToTop', () => {
  afterEach(() => {
    window.scrollY = 0;
  });

  it('renders nothing until the page is scrolled past its threshold', async () => {
    const { query } = await render(<ToTop minAppearanceY={300} />);

    expect(query('button')).toBeNull();

    scrollTo(299);
    expect(query('button')).toBeNull();

    scrollTo(300);
    expect(query('button')).not.toBeNull();
  });

  it('hides itself again when the page is scrolled back to the top', async () => {
    const { query } = await render(<ToTop minAppearanceY={300} />);

    scrollTo(400);
    expect(query('button')).not.toBeNull();

    scrollTo(0);
    expect(query('button')).toBeNull();
  });

  it('scrolls the window back to the top when it is clicked', async () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

    const { find } = await render(<ToTop minAppearanceY={0} />);

    scrollTo(500);

    await click(find<HTMLButtonElement>('button'));

    expect(scrollToSpy).toHaveBeenCalledWith(0, 0);

    scrollToSpy.mockRestore();
  });

  it('uses the default threshold when none is given', async () => {
    const { query } = await render(<ToTop />);

    scrollTo(299);
    expect(query('button')).toBeNull();

    scrollTo(300);
    expect(query('button')).not.toBeNull();
  });
});
