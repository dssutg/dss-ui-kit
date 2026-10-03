import { iconPaths } from '@/icons/index';

/**
 * The name of one of the icons the library ships.
 *
 * Derived from the generated path data, so a name in this union is a name {@link Icon} can render and
 * nothing else. A consumer with its own artwork uses its own SVG rather than extending this.
 */
export type IconName = keyof typeof iconPaths;

/**
 * One icon from the library's set, rendered as an inline SVG.
 *
 * The element is `aria-hidden` and carries no `<title>`: the accessible name of an icon is the label
 * of the control around it, and a `<title>` inside would be announced instead of it. That is why
 * {@link IconButton} takes an `ariaLabel` of its own.
 *
 * The SVG is given an id derived from the name and looked up in the document before it is built, so a
 * repeated icon in one tree renders once. It must therefore be rendered in a document rather than
 * detached, which is what every consumer of it does.
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
}) {
  const icon = iconPaths[name];

  const SVG_NS = 'http://www.w3.org/2000/svg';

  const iconId = `ui-kit-icon-${name}`;

  const iconElement = document.getElementById(iconId);

  if (iconElement === null) {
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
      className={`shrink-0 ${invisible ? 'invisible' : ''} ${className}`}
      style={style}
      viewBox="0 0 100 100"
      xmlns={SVG_NS}
      onDrop={onDrop}
    >
      {prependComponent}
      <use href={`#${iconId}`} />
      {appendComponent}
      {children}
    </svg>
  );
}
