import { Icon, type IconName } from './icon';

export function IconedSectionTitle({
  icon,
  title,
  style,
}: {
  readonly icon: IconName;
  readonly title: string;
  readonly style?: React.CSSProperties;
}) {
  return (
    <h1
      className="m-0 flex w-full select-none items-center justify-center gap-4 p-0 text-center text-2xl text-tpl"
      style={style}
    >
      <div className="ml-4">
        <Icon name={icon} className="size-6 fill-tpd" />
      </div>
      {title}
    </h1>
  );
}
