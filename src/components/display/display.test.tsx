// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { HighlightedJson } from '@/components/display/HighlightedJson';
import { Icon } from '@/components/display/Icon';
import { IconedSectionTitle } from '@/components/display/IconedSectionTitle';
import { IconViewer } from '@/components/display/IconViewer';
import { Link } from '@/components/display/Link';
import { click, render } from '@/util/testing/render';

describe('Icon', () => {
  it('is hidden from the accessibility tree, because the control around it carries the name', async () => {
    const { find } = await render(<Icon name="save" />);

    const svg = find('svg');

    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(svg.querySelector('use')?.getAttribute('href')).toBe('#ui-kit-icon-save');
  });

  it('adds its path to the document once, however many icons are rendered', async () => {
    // The path lives in a sprite appended to the body and referenced by `<use>`, so the queries here
    // are scoped to the container: the sprite itself is an `<svg>` in the same document, and it
    // outlives the tree that caused it to be created.
    const { container } = await render(
      <div>
        <Icon name="save" />
        <Icon name="save" />
      </div>,
    );

    expect(container.querySelectorAll('svg')).toHaveLength(2);
    expect(document.querySelectorAll('#ui-kit-icon-save')).toHaveLength(1);
  });

  it('hides the icon but keeps its space, so a row of icons does not jump', async () => {
    const { container } = await render(<Icon name="save" invisible />);

    // An SVG element's `className` is an SVGAnimatedString, not a string, so the attribute is read.
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('invisible');
  });
});

describe('IconedSectionTitle', () => {
  it('names the section by its title rather than by its icon', async () => {
    const { container, find } = await render(
      <IconedSectionTitle icon="alphabet" title="Filters" />,
    );

    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(find('div').textContent).toContain('Filters');
  });
});

describe('IconViewer', () => {
  it('renders every icon it knows about, each labelled with its name', async () => {
    const { findAll } = await render(<IconViewer />);

    const labelled = findAll('[aria-label="save"]');

    expect(labelled.length).toBeGreaterThan(0);
  });
});

describe('HighlightedJson', () => {
  it('renders the text as given, with the tokens marked up rather than the value parsed', async () => {
    const { find } = await render(<HighlightedJson json='{"a": 1}' />);

    const pre = find('pre');

    expect(pre.textContent).toBe('{"a": 1}');
    expect(pre.querySelectorAll('span').length).toBeGreaterThan(0);
  });

  it('leaves text that is not JSON alone instead of throwing on it', async () => {
    // A panel showing a half-written value must keep showing it; refusing to render is worse than
    // showing it unhighlighted.
    const { find } = await render(<HighlightedJson json='{"a":' />);

    expect(find('pre').textContent).toBe('{"a":');
  });
});

describe('Link', () => {
  it('reports the navigation instead of following it, so a consumer router owns it', async () => {
    const onNavigate = vi.fn();
    const { find } = await render(
      <Link to="/panel/1" onNavigate={onNavigate}>
        Panel
      </Link>,
    );

    const anchor = find<HTMLAnchorElement>('a');

    expect(anchor.getAttribute('href')).toBe('/panel/1');

    await click(anchor);

    expect(onNavigate).toHaveBeenCalledWith('/panel/1');
  });

  it('leaves the navigation to the browser when given no handler', async () => {
    // Without `onNavigate` the library does not intercept the click at all, so the browser's own
    // affordances — a new tab, the status bar preview — keep working.
    const { find } = await render(<Link to="/panel/1">Panel</Link>);

    const anchor = find<HTMLAnchorElement>('a');

    expect(anchor.getAttribute('href')).toBe('/panel/1');
    expect(anchor.getAttribute('target')).toBeNull();
  });

  it('reports the plain click as well as the navigation', async () => {
    const onClick = vi.fn();
    const { find } = await render(
      <Link to="/panel/1" onClick={onClick}>
        Panel
      </Link>,
    );

    await click(find<HTMLAnchorElement>('a'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
