import type { iconPaths } from '@/icons/index';
import { getIconPath } from '@/icons/registry';
import { cn } from '@/util/cn';

/**
 * The name of one of the icons the library ships.
 *
 * Derived from the generated path data, so a name in this union is a name the library holds a path
 * for. {@link ShippedIconName} is this, and it is narrower than {@link IconName} on purpose.
 */
export type ShippedIconName = keyof typeof iconPaths;

/**
 * The name of an icon {@link Icon} can render: one the library ships, or one a caller registered.
 *
 * The `string` arm is what makes `name="brandMark"` legal for an icon registered through
 * `registerIcon` — an icon the library has never heard of is a supported icon, not a type error. It
 * costs the typo check on a shipped name: a misspelled one resolves to no path, reports itself, and
 * renders nothing. {@link ShippedIconName} is the union to reach for where a typo has to be caught
 * at compile time instead.
 */
export type IconName = ShippedIconName | (string & {});

/**
 * One icon from the library's set, rendered as an inline SVG.
 *
 * The element is `aria-hidden` and carries no `<title>`: the accessible name of an icon is the label
 * of the control around it, and a `<title>` inside would be announced instead of it. That is why
 * {@link IconButton} takes an `ariaLabel` of its own.
 *
 * The path is resolved on every render rather than read once, so an icon a caller registers after the
 * first render still appears. It is cached in the document as a hidden `<svg>` that the rendered icon
 * points at with `<use>`, so a repeated icon in one tree costs one path rather than one per copy. The
 * cache is keyed on the name *and* the path, which is what lets a registered icon replace a shipped
 * one without the earlier copy being reused.
 *
 * A name nothing holds a path for renders an empty SVG and reports itself. Rendering nothing would
 * leave a caller with a silently missing control; rendering the name as text would put a debug string
 * in front of an operator.
 */
export function Icon({
  name,
  className,
  style,
  prependComponent,
  appendComponent,
  onDrop,
  invisible = false, // hides icon but occupies space to avoid flickering
  children,
}: {
  readonly name: IconName;
  readonly className?: string | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly prependComponent?: React.ReactNode | undefined;
  readonly appendComponent?: React.ReactNode | undefined;
  readonly onDrop?: React.DragEventHandler<SVGSVGElement> | undefined;
  readonly invisible?: boolean | undefined;
  readonly children?: React.ReactNode | undefined;
}): React.JSX.Element {
  const icon = getIconPath(name);

  const SVG_NS = 'http://www.w3.org/2000/svg';

  if (icon === undefined) {
    console.error(
      `No path is registered for the icon "${name}". Call registerIcon(name, path) before rendering it, ` +
        'or use one of the names IconName lists.',
    );
  }

  // Keyed on the path as well as the name, so replacing a path renders the replacement rather than
  // the copy a previous render already put in the document.
  const iconId = `ui-kit-icon-${sanitizeForId(name)}-${hashPath(icon)}`;
  if (icon !== undefined && document.getElementById(iconId) === null) {
    const pathElement = document.createElementNS(SVG_NS, 'path');
    pathElement.setAttribute('d', icon);

    const svgElement = document.createElementNS(SVG_NS, 'svg');
    svgElement.setAttribute('id', iconId);
    svgElement.setAttribute('aria-hidden', 'true');
    svgElement.setAttribute('role', 'img');
    svgElement.setAttribute('focusable', 'false');
    svgElement.setAttribute('width', '100');
    svgElement.setAttribute('height', '100');
    svgElement.setAttribute('viewBox', '0 0 100 100');
    svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgElement.style.position = 'fixed';
    svgElement.style.top = '-2000px';
    svgElement.style.left = '-2000px';
    svgElement.style.width = '100px';
    svgElement.style.height = '100px';
    svgElement.style.overflow = 'hidden';
    svgElement.appendChild(pathElement);
    document.body.appendChild(svgElement);
  }

  return (
    <svg
      aria-hidden="true"
      role="img"
      focusable="false"
      width="100"
      height="100"
      className={cn('shrink-0', invisible && 'invisible', className)}
      style={style}
      viewBox="0 0 100 100"
      xmlns={SVG_NS}
      onDrop={onDrop}
    >
      {prependComponent}
      {icon !== undefined && <use href={`#${iconId}`} />}
      {appendComponent}
      {children}
    </svg>
  );
}

/**
 * The characters an id may hold, replaced where a name holds others.
 *
 * An icon name is a caller's string and is interpolated into an id, so a name with a space or a slash
 * in it would produce a `href` that resolves to nothing. The hash below is what keeps two such names
 * apart after they are folded down to the same characters.
 */
function sanitizeForId(name: string): string {
  return name.replace(/[^A-Za-z0-9_-]/g, '_');
}

/**
 * A short hash of the path data, for keying the document cache.
 *
 * The point is not to be collision resistant — two icons whose paths collide would render each
 * other's artwork, and this is a 32-bit hash of generated data, which is a risk nobody takes
 * deliberately. It is to change when the path changes: the cache holds a rendered path, so the key
 * has to say which one.
 */
function hashPath(path: string | undefined): string {
  let hash = 0x81_1c_9d_c5;
  const text = path ?? '';
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01_00_01_93);
  }
  return (hash >>> 0).toString(36);
}
