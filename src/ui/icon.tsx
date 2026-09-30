import { useCallback, useMemo, useState } from 'react';
import { copyToClipboard } from '@/lib/dom';
import { iconPaths } from './icons';
import { SearchInput } from './input';

export type IconName = keyof typeof iconPaths;

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

export function IconViewer() {
  const [searchText, setSearchText] = useState('');

  const iconNames = Object.keys(iconPaths) as IconName[];

  const totalIcons = iconNames.length;
  const size = 16 * 3;
  const gap = 4;

  const columns = Math.ceil(Math.sqrt(totalIcons));

  const normalizeQuery = useCallback(
    (searchText: string) => searchText.replace(/\s+/g, '').toLowerCase(),
    [],
  );

  const query = useMemo(() => normalizeQuery(searchText), [searchText, normalizeQuery]);

  const sortedIconNames = useMemo(() => iconNames.toSorted(), [iconNames]);

  return (
    <div className="flex flex-col gap-2">
      <SearchInput value={searchText} placeholder={'Search Icon'} onChangeText={setSearchText} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap,
          width: (size + gap) * columns,
        }}
      >
        {sortedIconNames.map((icon) => {
          if (normalizeQuery(icon).includes(query)) {
            return (
              <div key={icon} title={icon} onClick={() => copyToClipboard(icon)}>
                <Icon
                  name={icon}
                  style={{
                    width: size,
                    height: size,
                    fill: 'var(--color-tpl)',
                  }}
                />
              </div>
            );
          }
          return <div key={icon} style={{ width: size, height: size }} />;
        })}
      </div>
    </div>
  );
}
