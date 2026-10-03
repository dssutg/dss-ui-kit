import { DropDownMenu, type DropDownMenuItem } from '@/components/overlays/DropDownMenu';

export type DropDownButtonVariant = 'regular' | 'danger';

const dropdownVariantStyles: Readonly<Record<DropDownButtonVariant, React.CSSProperties>> = {
  regular: {
    backgroundColor: 'var(--color-bbp)',
    color: 'var(--color-tpl)',
  },
  danger: {
    backgroundColor: 'var(--color-bda)',
    color: 'var(--color-bdat)',
  },
};

const dropdownVariantClasses: Readonly<Record<DropDownButtonVariant, string>> = {
  regular: 'data-[highlighted]:bg-bbp',
  danger: 'data-[highlighted]:bg-bda',
};

const dropdownIconColorStyles: Readonly<Record<DropDownButtonVariant, React.CSSProperties>> = {
  regular: { fill: 'var(--color-tpl)' },
  danger: { fill: 'var(--color-bdat)' },
};

export function DropDownButton({
  menu,
  variant = 'regular',
  triggerTitle,
  style,
}: {
  readonly menu: DropDownMenuItem[];
  readonly variant?: DropDownButtonVariant | undefined;
  readonly triggerTitle: string;
  readonly style?: React.CSSProperties | undefined;
}) {
  return (
    <DropDownMenu
      variant="button"
      triggerTitle={triggerTitle}
      triggerStyle={{
        ...dropdownVariantStyles[variant],
        ...style,
      }}
      triggerIconStyle={dropdownIconColorStyles[variant]}
      dropDownListStyle={dropdownVariantStyles[variant]}
      menuItemClassName={`
        data-[highlighted]:brightness-150
        ${dropdownVariantClasses[variant]}
      `}
      menuItemIconStyle={dropdownIconColorStyles[variant]}
      menuItemIconMoreStyle={dropdownIconColorStyles[variant]}
      menu={menu}
    />
  );
}
