import { cn } from '@/util/cn';
import { Icon, type IconName } from './Icon';

/**
 * A heading with a leading icon, for a panel whose title also has a recognisable symbol.
 *
 * The icon is `aria-hidden` and the title is the accessible name: the SVG carries no name of its own,
 * so a screen reader reads the text and not the icon.
 */
export function IconedSectionTitle({
  icon,
  title,
  className,
  style,
}: {
  readonly icon: IconName;
  readonly title: string;
  readonly className?: string | undefined;
  readonly style?: React.CSSProperties | undefined;
}): React.JSX.Element {
  return (
    <h1
      className={cn(
        'm-0 flex w-full select-none items-center justify-center gap-4 p-0 text-center text-2xl text-tpl',
        className,
      )}
      style={style}
    >
      <div className="ml-4">
        <Icon name={icon} className="size-6 fill-tpd" />
      </div>
      {title}
    </h1>
  );
}
