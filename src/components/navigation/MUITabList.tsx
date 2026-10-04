import { useState } from 'react';
import { ControlledMUITabList } from './ControlledMUITabList';
/**
 * One tab: the id that identifies it, the label an operator reads, and the content it shows.
 *
 * Generic over the id, so a caller whose tab ids are a union of its own gets the selected id typed
 * rather than as a string. `forceMount` keeps the content mounted while the tab is not selected, for
 * a tab whose content holds state or is expensive to build.
 */
export interface MUITabDescriptor<ID extends string> {
  id: ID;
  title: string;
  content: React.ReactNode;
  forceMount: boolean;
}

/**
 * Whether a tab's content is the selected one, read from the trigger's `data-state`.
 *
 * Exported because a caller rendering something *inside* tab content needs to know whether it is
 * visible, and the answer is one attribute read rather than a duplicate of the selection state.
 */
export function isMUITabActive(tabContentElement: Readonly<HTMLElement>): boolean {
  return tabContentElement.parentElement?.getAttribute('data-state') === 'active';
}

/**
 * A tab list holding its own selection, starting on the first tab.
 *
 * Use {@link ControlledMUITabList} instead when something outside has to know which tab is open.
 */
export function MUITabList<ID extends string>({
  tabs,
  rightComponent,
  style,
  tabTriggerListStyle,
  tabTriggerStyle,
}: {
  readonly tabs: readonly MUITabDescriptor<ID>[];
  readonly rightComponent?: React.ReactNode | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly tabTriggerListStyle?: React.CSSProperties | undefined;
  readonly tabTriggerStyle?: React.CSSProperties | undefined;
}): React.JSX.Element {
  const [tabId, setTabId] = useState<ID | null>(tabs[0]?.id ?? null);

  return (
    <ControlledMUITabList
      tabs={tabs}
      rightComponent={rightComponent}
      style={style}
      tabTriggerListStyle={tabTriggerListStyle}
      tabTriggerStyle={tabTriggerStyle}
      tabId={tabId}
      setTabId={setTabId}
    />
  );
}
