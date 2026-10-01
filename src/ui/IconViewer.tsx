import { useCallback, useMemo, useState } from 'react';
import { copyToClipboard } from '@/lib/dom';
import { Icon, type IconName } from '@/ui/Icon';
import { iconPaths } from '@/ui/icons/index';
import { SearchInput } from '@/ui/SearchInput';

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
            // A button, because clicking the icon copies its name. The name is the accessible name
            // as well as the tooltip, so a screen reader announces what will be copied.
            return (
              <button
                key={icon}
                type="button"
                title={icon}
                aria-label={icon}
                className="cursor-pointer border-none bg-transparent p-0"
                onClick={() => copyToClipboard(icon)}
              >
                <Icon
                  name={icon}
                  style={{
                    width: size,
                    height: size,
                    fill: 'var(--color-tpl)',
                  }}
                />
              </button>
            );
          }
          return <div key={icon} style={{ width: size, height: size }} />;
        })}
      </div>
    </div>
  );
}
