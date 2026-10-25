// SPDX-License-Identifier: MIT
// Renders the trail of links, its separators and its overflow fade.
// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { type BreadcrumbItem, Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { click, render } from '@/util/testing/render';

const items: readonly BreadcrumbItem[] = [
  { to: '/', label: 'Home' },
  { to: '/shelves', label: 'Shelves' },
  { to: '/shelves/12', label: 'Shelf 12' },
];

describe('Breadcrumbs', () => {
  it('renders every earlier step as an anchor to its destination', async () => {
    const { findAll } = await render(<Breadcrumbs items={items} />);
    const anchors = findAll<HTMLAnchorElement>('a');

    expect(anchors.map((anchor) => anchor.getAttribute('href'))).toEqual(['/', '/shelves']);
    expect(anchors.map((anchor) => anchor.textContent)).toEqual(['Home', 'Shelves']);
  });

  it('renders the current page as text rather than a link', async () => {
    const { find, query } = await render(<Breadcrumbs items={items} />);
    const current = find('[aria-current="page"]');

    expect(current.textContent).toBe('Shelf 12');
    expect(current.tagName).toBe('SPAN');
    expect(query('a[href="/shelves/12"]')).toBeNull();
  });

  it('renders a separator only between steps', async () => {
    const { findAll } = await render(<Breadcrumbs items={items} />);

    expect(findAll('[aria-hidden="true"]').map((separator) => separator.textContent)).toEqual([
      '/',
      '/',
    ]);
  });

  it('uses a custom separator', async () => {
    const { findAll } = await render(<Breadcrumbs items={items} separator=">" />);

    expect(findAll('[aria-hidden="true"]').map((separator) => separator.textContent)).toEqual([
      '>',
      '>',
    ]);
  });

  it('reports the destination on a plain click', async () => {
    const onNavigate = vi.fn();
    const { find } = await render(<Breadcrumbs items={items} onNavigate={onNavigate} />);

    click(find('a[href="/shelves"]'));

    expect(onNavigate).toHaveBeenCalledWith('/shelves');
  });

  it('fades the right edge by default', async () => {
    const { find } = await render(<Breadcrumbs items={items} />);

    expect(find('nav').getAttribute('style')).toContain('mask-image');
  });

  it('keeps the right edge solid when fade is false', async () => {
    const { find } = await render(<Breadcrumbs items={items} fade={false} />);

    expect(find('nav').getAttribute('style') ?? '').not.toContain('mask-image');
  });

  it('merges a supplied className on the nav and itemClassName on every step', async () => {
    const { find, findAll } = await render(
      <Breadcrumbs items={items} className="ml-2" itemClassName="text-sm" />,
    );

    expect(find('nav').className).toContain('overflow-hidden');
    expect(find('nav').className).toContain('ml-2');
    expect(findAll('li')).toHaveLength(items.length);

    for (const item of findAll('li')) {
      expect(item.className).toContain('whitespace-nowrap');
      expect(item.className).toContain('text-sm');
    }
  });

  it('renders an empty nav for an empty trail', async () => {
    const { find, query } = await render(<Breadcrumbs items={[]} />);

    expect(find('nav').getAttribute('aria-label')).toBe('Breadcrumb');
    expect(find('ol').children).toHaveLength(0);
    expect(query('li')).toBeNull();
  });
});
