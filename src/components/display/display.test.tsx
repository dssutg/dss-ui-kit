/**
 * The display group renders what it is handed without owning any of it: icons are decoration hidden
 * from the accessibility tree because the control around them carries the name, `HighlightedJson`
 * marks up text it cannot parse rather than rejecting it, `Link` reports navigation instead of
 * following it so a consumer router takes the decision, and `LightRayOverlay` draws with an image the
 * caller bundled rather than one of the library's.
 */
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HighlightedJson } from '@/components/display/HighlightedJson';
import { Icon } from '@/components/display/Icon';
import { IconedSectionTitle } from '@/components/display/IconedSectionTitle';
import { IconViewer } from '@/components/display/IconViewer';
import { LightRayOverlay } from '@/components/display/LightRayOverlay';
import { Link } from '@/components/display/Link';
import {
  getIconNames,
  getIconPath,
  hasIcon,
  registerIcon,
  registerIcons,
  unregisterIcon,
} from '@/icons/registry';
import { click, render } from '@/util/testing/render';

describe('Icon', () => {
  it('is hidden from the accessibility tree, because the control around it carries the name', async () => {
    const { find } = await render(<Icon name="save" />);

    const svg = find('svg');

    const href = svg.querySelector('use')?.getAttribute('href');

    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    // The id carries the name and a hash of the path, so it names the icon and says which drawing of
    // it the copy is pointing at. What matters is that the reference resolves.
    expect(href).toContain('ui-kit-icon-save-');
    expect(document.querySelector(href ?? '')).not.toBeNull();
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

    const href = container.querySelector('use')?.getAttribute('href');

    expect(container.querySelectorAll('svg')).toHaveLength(2);
    expect(document.querySelectorAll(href ?? '')).toHaveLength(1);
  });

  it('hides the icon but keeps its space, so a row of icons does not jump', async () => {
    const { container } = await render(<Icon name="save" invisible />);

    // An SVG element's `className` is an SVGAnimatedString, not a string, so the attribute is read.
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('invisible');
  });
});

describe('registered icons', () => {
  // The registry is application-wide and module-level, which is the point of it, so the names this
  // suite adds are taken back afterwards: one test registering `plus` must not decide what the next
  // one reads.
  const registeredByThisSuite: string[] = [];

  const register = (name: string, path: string): void => {
    registeredByThisSuite.push(name);
    registerIcon(name, path);
  };

  afterEach(() => {
    for (const name of registeredByThisSuite.splice(0)) {
      unregisterIcon(name);
    }
  });

  it('renders an icon the application registered, with the path it registered', async () => {
    register('testBrandMark', 'm0 0h100v100h-100z');

    const { container } = await render(<Icon name="testBrandMark" />);

    const href = container.querySelector('use')?.getAttribute('href');
    const sprite = document.querySelector(href ?? '');

    expect(sprite?.querySelector('path')?.getAttribute('d')).toBe('m0 0h100v100h-100z');
  });

  it('replaces the artwork of a shipped icon without the earlier copy being reused', async () => {
    // The sprite is cached in the document by id, so a cache key of the name alone would keep serving
    // the drawing from before the registration and the replacement would appear to do nothing.
    const { container, update } = await render(<Icon name="plus" />);
    const before = container.querySelector('use')?.getAttribute('href');

    register('plus', 'm50 0v100');
    await update(<Icon name="plus" />);

    const after = container.querySelector('use')?.getAttribute('href');
    const sprite = document.querySelector(after ?? '');

    expect(after).not.toBe(before);
    expect(sprite?.querySelector('path')?.getAttribute('d')).toBe('m50 0v100');
  });

  it('gives the shipped path back when a replacement is taken away again', () => {
    const shipped = getIconPath('plus');

    register('plus', 'm50 0v100');

    expect(unregisterIcon('plus')).toBe(true);
    expect(getIconPath('plus')).toBe(shipped);
  });

  it('reports a name nothing holds a path for rather than rendering nothing quietly', async () => {
    // A silently absent icon is a control an operator cannot read and nobody was told about.
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { container } = await render(<Icon name="testNoSuchIcon" />);

    expect(error).toHaveBeenCalledWith(expect.stringContaining('testNoSuchIcon'));
    // The space is still there, so a row of icons does not jump around a missing one.
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('use')).toBeNull();

    error.mockRestore();
  });

  it('lists a registered icon beside the shipped ones, because a name nobody can search for is lost', async () => {
    register('testSearchable', 'm0 0h100v100h-100z');

    const { findAll } = await render(<IconViewer />);

    expect(findAll('[aria-label="testSearchable"]').length).toBeGreaterThan(0);
  });

  it('registers a whole icon set at once, from the shape one is exported as', () => {
    registeredByThisSuite.push('testFirst', 'testSecond');
    registerIcons({ testFirst: 'm0 0h10v10h-10z', testSecond: 'm10 0h10v10h-10z' });

    expect(hasIcon('testFirst')).toBe(true);
    expect(hasIcon('testSecond')).toBe(true);
    expect(getIconNames()).toContain('testFirst');
  });

  it('refuses an empty name, because the name is what the icon is called in the DOM', () => {
    expect(() => registerIcon('', 'm0 0h10v10h-10z')).toThrow();
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

describe('LightRayOverlay', () => {
  it("draws with the caller's own image, because the picture is the application's asset", async () => {
    const { container } = await render(<LightRayOverlay image="/ray.png" />);

    // The browser rewrites `url(...)` into its own quoted form, so what is asserted is the URL itself.
    expect(container.querySelector('div')?.style.backgroundImage).toContain('/ray.png');
  });

  it('takes no clicks, or it would stand between the operator and the panel in front of it', async () => {
    const { container } = await render(<LightRayOverlay image="/ray.png" />);

    expect(container.querySelector('div')?.className).toContain('pointer-events-none');
  });

  it('is hidden from the accessibility tree, because there is nothing in it to read', async () => {
    const { container } = await render(<LightRayOverlay image="/ray.png" />);

    expect(container.querySelector('div')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('lets the caller choose how bright the overlay is, because the default is a default', async () => {
    const { container } = await render(<LightRayOverlay image="/ray.png" className="opacity-90" />);

    expect(container.querySelector('div')?.className).toContain('opacity-90');
    expect(container.querySelector('div')?.className).not.toContain('opacity-[0.4]');
  });

  it('lets the caller place it rather than assuming the viewport, while still covering it', async () => {
    const { container } = await render(<LightRayOverlay image="/ray.png" className="left-1/3" />);

    const overlay = container.querySelector('div');

    expect(overlay?.className).toContain('left-1/3');
    expect(overlay?.className).toContain('fixed');
    expect(overlay?.className).toContain('bg-cover');
  });
});
