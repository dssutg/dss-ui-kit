import { useState } from 'react';
import { ControlledMUITabList } from '@/ui/ControlledMUITabList';
export interface MUITabDescriptor<ID extends string> {
  id: ID;
  title: string;
  content: React.ReactNode;
  forceMount: boolean;
}

export function isMUITabActive(tabContentElement: Readonly<HTMLElement>) {
  return tabContentElement.parentElement?.getAttribute('data-state') === 'active';
}

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
}) {
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
