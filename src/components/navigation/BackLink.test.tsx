// SPDX-License-Identifier: MIT
// Renders the compact link that returns to the previous section.
// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { BackLink } from '@/components/navigation/BackLink';
import { click, render } from '@/util/testing/render';

describe('BackLink', () => {
  it('renders an anchor to the destination', async () => {
    const { find } = await render(<BackLink to="/previous" />);

    expect(find<HTMLAnchorElement>('a').getAttribute('href')).toBe('/previous');
  });

  it('uses the locale title by default', async () => {
    const { find } = await render(<BackLink to="/previous" />);

    expect(find('a').title).toBe('Go back');
  });

  it('uses a supplied title instead of the locale one', async () => {
    const { find } = await render(<BackLink to="/previous" title="Back to the list" />);

    expect(find('a').title).toBe('Back to the list');
  });

  it('renders the default icon', async () => {
    const { find, container } = await render(<BackLink to="/previous" />);

    expect(find('svg')).toBeDefined();
    expect(container.textContent).toContain('Go back');
  });

  it('honours a custom icon name', async () => {
    const { container } = await render(<BackLink to="/previous" icon="arrowRight" />);

    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('use')?.getAttribute('href')).toContain('arrowRight');
  });

  it('renders the label in a visually hidden span', async () => {
    const { find } = await render(<BackLink to="/previous" />);

    expect(find('.sr-only').textContent).toBe('Go back');
  });

  it('reports the destination through onNavigate on a plain click', async () => {
    const onNavigate = vi.fn();

    const { find } = await render(<BackLink to="/previous" onNavigate={onNavigate} />);

    click(find('a'));

    expect(onNavigate).toHaveBeenCalledWith('/previous');
  });

  it('merges a supplied className with its own', async () => {
    const { find } = await render(<BackLink to="/previous" className="ml-2" />);

    const classes = find('a').className;

    expect(classes).toContain('inline-flex');
    expect(classes).toContain('ml-2');
  });
});
