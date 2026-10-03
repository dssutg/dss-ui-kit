import { Icon, type IconName } from '@/components/display/Icon';
import { Ripple } from '@/components/feedback/Ripple';

export function IconedButtonGroup({
  group,
  value = 0,
  onChange,
  style,
}: {
  readonly group: { icon: IconName; title: string }[];
  readonly value?: number | undefined;
  readonly onChange?: (index: number) => void;
  readonly style?: React.CSSProperties | undefined;
}) {
  return (
    <div className="flex items-center justify-center" style={style}>
      {group.map((item, index) => (
        <button
          key={index}
          className={`
            relative cursor-pointer overflow-hidden border-none p-2 hover:brightness-150
            ${index === value ? 'bg-bse' : 'bg-bpd2'}
          `}
          type="button"
          onClick={() => onChange?.(index)}
          title={item.title}
        >
          <Ripple color="var(--color-ripple-button)" />
          <Icon
            name={item.icon}
            style={{
              width: '1.25rem',
              height: '1.25rem',
              fill: 'var(--color-tpl)',
            }}
          />
        </button>
      ))}
    </div>
  );
}
