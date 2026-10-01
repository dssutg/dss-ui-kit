import { useCallback, useId, useRef, useState } from 'react';
import { wrapIndex } from '@/lib/math';
import { useForceUpdate } from '@/lib/use_force_update';
import { useGranularEffect } from '@/lib/use_granular_effect';
import { Ripple } from './ripple';

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

export function ControlledMUITabList<ID extends string>({
  tabs,
  rightComponent,
  style,
  tabTriggerListStyle,
  tabTriggerStyle,
  tabId,
  setTabId,
}: {
  readonly tabs: readonly MUITabDescriptor<ID>[];
  readonly rightComponent?: React.ReactNode | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly tabTriggerListStyle?: React.CSSProperties | undefined;
  readonly tabTriggerStyle?: React.CSSProperties | undefined;
  readonly tabId: ID | null;
  readonly setTabId: (tabId: ID | null) => void;
}) {
  const triggerListRef = useRef<HTMLDivElement>(null);

  // The id prefix that ties each tab to its panel. `useId` rather than a prop, because the pairing is
  // an implementation detail of this widget and a caller should not have to invent unique ids for it.
  const idPrefix = useId();

  const forceUpdate = useForceUpdate();

  useGranularEffect(
    () => {
      setTabId(tabs[0]?.id ?? null);
    },
    [tabs.length],
    [tabs],
  );

  // Force additional component re-render after refs have been initialized
  // so that the initial tab underline is shown when this component mounts
  useGranularEffect(
    () => {
      forceUpdate();
    },
    [],
    [forceUpdate],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && tabId !== null) {
        if (tabs.length === 0) {
          return;
        }

        let delta = 1;
        if (e.code === 'ArrowLeft') {
          delta = -1;
        }

        const itemIndex = wrapIndex(
          Math.max(
            0,
            tabs.findIndex((tab) => tab.id === tabId),
          ) + delta,
          tabs.length,
        );

        setTabId(tabs[itemIndex]?.id ?? tabId);
      }
    },
    [tabId, setTabId, tabs],
  );

  if (tabs[0] === undefined || tabId === null) {
    return null;
  }

  function getUnderlineInfo() {
    if (triggerListRef.current === null) {
      return null;
    }

    for (const node of triggerListRef.current.childNodes) {
      const button = node as HTMLButtonElement;

      if (button.getAttribute('data-tab') === tabId) {
        const buttonBox = button.getBoundingClientRect();
        const listBox = triggerListRef.current.getBoundingClientRect();

        const x = buttonBox.left - listBox.left;
        const { width } = buttonBox;

        return { x, width };
      }
    }

    return null;
  }

  const underlineInfo = getUnderlineInfo();

  return (
    <div className="flex w-full flex-col gap-2 overflow-hidden" style={style}>
      <div
        className="bg-bpd relative flex shrink-0 overflow-auto rounded-tl-lg rounded-tr-lg"
        style={tabTriggerListStyle}
      >
        <div>
          {/* `role="tablist"` with `role="tab"` children and `aria-selected` is what makes this a set
              of tabs rather than a row of buttons. It also carries the container's `tabIndex={0}`:
              a composite widget takes focus once and then moves within itself with the arrow keys,
              which is what `onKeyDown` implements. */}
          <div
            tabIndex={0}
            ref={triggerListRef}
            role="tablist"
            aria-orientation="horizontal"
            className="flex"
            onKeyDown={onKeyDown}
          >
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                id={`${idPrefix}-tab-${tab.id}`}
                role="tab"
                aria-selected={tab.id === tabId}
                aria-controls={`${idPrefix}-panel-${tab.id}`}
                data-tab={tab.id}
                className={`
                  relative overflow-hidden truncate p-4 select-none
                  ${tab.id === tabId ? 'text-tli' : 'text-tpl'}
                `}
                style={tabTriggerStyle}
                onClick={() => setTabId(tab.id)}
              >
                <Ripple color="var(--color-ripple-button)" />
                {tab.title}
              </button>
            ))}
          </div>
          <div className="h-1">
            {underlineInfo !== null && (
              <div
                className="bg-tli absolute h-1 transition-all duration-200"
                style={{ left: underlineInfo.x, width: underlineInfo.width }}
              />
            )}
          </div>
        </div>
        {rightComponent}
      </div>
      {tabs.map(
        (tab) =>
          (tab.id === tabId || tab.forceMount) && (
            <div
              key={tab.id}
              id={`${idPrefix}-panel-${tab.id}`}
              role="tabpanel"
              aria-labelledby={`${idPrefix}-tab-${tab.id}`}
              className="flex-grow overflow-hidden"
              style={{ display: tab.id === tabId ? 'flex' : 'none' }}
              data-state={tab.id === tabId ? 'active' : 'inactive'}
            >
              {tab.content}
            </div>
          ),
      )}
    </div>
  );
}
