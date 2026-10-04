import { DropDownMenu, type DropDownMenuItem } from '@/components/overlays/DropDownMenu';
import { cn } from '@/util/cn';

/**
 * How the trigger button looks: `danger` for a menu whose items are destructive.
 *
 * A variant colours the trigger and its arrow only. The menu itself is {@link DropDownMenu}'s, so
 * the items' own styling is not this component's decision.
 */
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

/**
 * A button that opens a {@link DropDownMenu}.
 *
 * The trigger's title is a required prop rather than the first menu item's, because a button that
 * opens something else as well as a menu has to be able to say so. The menu is rendered by
 * {@link DropDownMenu}, which owns closing on selection; this component only opens it.
 */
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
      menuItemClassName={cn('data-[highlighted]:brightness-150', dropdownVariantClasses[variant])}
      menuItemIconStyle={dropdownIconColorStyles[variant]}
      menuItemIconMoreStyle={dropdownIconColorStyles[variant]}
      menu={menu}
    />
  );
}
