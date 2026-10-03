import { createPortal, useEffect, useId, useRef, useState } from 'react';
import { IconButton } from '@/components/buttons/IconButton';
import { Icon } from '@/components/display/Icon';
import { clamp, cmp } from '@/lib/math';
import { useGranularEffect } from '@/lib/use_granular_effect';
import { useIsMobileScreen } from '@/lib/use_is_mobile_screen';
import { useLocale } from '@/locale';

const MAX_HISTORY_ITEMS = 20;
const MAX_HISTORY_ITEM_LENGTH = 100;

interface HistoryItem {
  content: string;
  timestamp: number;
  usageCount: number;
}

interface History {
  id: string;
  items: HistoryItem[];
}

/**
 * A search field with a clear button and a history of past searches.
 *
 * The history is the component's own, kept in `localStorage` and capped at 20 entries; it is a
 * convenience and it is why the component does not take a value for it. Entries are ranked by how
 * often and how recently they were used rather than kept in order, and are keyed by `historyId`, so
 * two search fields in one page can keep separate histories. Without a `historyId` nothing is stored
 * and no history is shown.
 *
 * On a narrow screen the history opens as a sheet rather than a dropdown, which is the one place this
 * component consults the viewport itself.
 */
export function SearchInput({
  value,
  placeholder,
  onChange,
  onClear,
  onChangeText,
  style,
  inputStyle,
  autoFocus = false,
  outerRef,
  historyId,
}: {
  readonly value: string;
  readonly placeholder?: string | undefined;
  readonly onChange?: React.ChangeEventHandler<HTMLInputElement> | undefined;
  readonly onClear?: (() => void) | undefined;
  readonly onChangeText?: ((text: string) => void) | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly inputStyle?: React.CSSProperties | undefined;
  readonly autoFocus?: boolean | undefined;
  outerRef?: React.MutableRefObject<HTMLDivElement | null> | undefined;
  readonly historyId?: string | undefined;
}) {
  const { t } = useLocale();

  const inputRef = useRef<HTMLInputElement>(null);

  const [componentBoundingBox, setComponentBoundingBox] = useState<DOMRect | null>(null);

  const [historyShown, setHistoryShown] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);

  const [selectedHistoryItemIndex, setSelectedHistoryItemIndex] = useState<number | null>(null);

  useEffect(() => {
    if (historyId === undefined) {
      return;
    }

    setHistoryItems(loadHistory(historyId).items);
  }, [historyId]);

  useGranularEffect(
    () => {
      if (selectedHistoryItemIndex === null) {
        return;
      }

      if (selectedHistoryItemIndex < 0) {
        setSelectedHistoryItemIndex(0);
      }

      if (selectedHistoryItemIndex >= historyItems.length) {
        setSelectedHistoryItemIndex(Math.max(0, historyItems.length - 1));
      }
    },
    [historyItems],
    [selectedHistoryItemIndex],
  );

  useGranularEffect(
    () => {
      if (historyShown) {
        setSelectedHistoryItemIndex(0);
      } else {
        setSelectedHistoryItemIndex(null);
      }
    },
    [historyShown],
    [],
  );

  useGranularEffect(
    () => {
      if (value === '') {
        setHistoryShown(false);
      }
    },
    [value],
    [],
  );

  const isMobile = useIsMobileScreen();

  // The id both the combobox and its options are named by, so `aria-activedescendant` can point at
  // one and the browser can resolve it.
  const listboxId = useId();

  const historyItemCount = historyItems.length;

  const shouldShowHistoryPopover =
    componentBoundingBox !== null && historyShown && historyItems.length !== 0;

  return (
    // Not focusable. It used to carry `tabIndex={0}` and an `onFocus` that called
    // `inputRef.current?.focus()`, which put a phantom tab stop in front of the real one. The input
    // below reports its own focus now, and measures the wrapper for the history popover.
    <div
      ref={outerRef ?? null}
      className="relative bg-bin flex flex-grow items-center rounded-lg px-2 py-1"
      style={style}
    >
      <Icon name="search" style={{ fill: 'var(--color-tpl)', width: '1rem', height: '1rem' }} />
      {/* A combobox: the input keeps the focus the whole time and `aria-activedescendant` names the
          suggestion the arrow keys have reached. That is why the suggestions are not focusable and
          why Enter is handled up here rather than on each one. */}
      <input
        ref={inputRef}
        id={listboxId}
        type="text"
        role="combobox"
        aria-expanded={shouldShowHistoryPopover}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          selectedHistoryItemIndex === null
            ? undefined
            : `${listboxId}-option-${selectedHistoryItemIndex}`
        }
        className="text-tpl placeholder-tpd ml-4 flex-grow bg-transparent outline-none"
        style={inputStyle}
        placeholder={placeholder ?? t('SearchInput.search')}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellcheck={false}
        autoFocus={autoFocus}
        value={value}
        onFocus={() => {
          // The popover is positioned against the wrapper, so that is what is measured here.
          setComponentBoundingBox(outerRef?.current?.getBoundingClientRect() ?? null);
        }}
        onBlur={() => {
          setSelectedHistoryItemIndex(null);

          setTimeout(() => {
            setHistoryShown(false);
          }, 300);

          // Try to add value to history
          if (historyId === undefined) {
            return;
          }

          const trimmedValue = value.trim().slice(0, MAX_HISTORY_ITEM_LENGTH);

          if (trimmedValue === '') {
            return;
          }

          const existingItemIndex = historyItems.findIndex((item) => item.content === trimmedValue);

          function mergeItems() {
            const existingItem =
              existingItemIndex === -1 ? undefined : historyItems[existingItemIndex];

            if (existingItem !== undefined) {
              const newItems = [...historyItems];

              newItems[existingItemIndex] = {
                ...existingItem,
                content: existingItem.content,
                timestamp: Date.now(),
                usageCount: existingItem.usageCount + 1,
              };

              return newItems;
            }

            return [
              ...historyItems,
              {
                content: trimmedValue,
                timestamp: Date.now(),
                usageCount: 0,
              },
            ];
          }

          const newItems = sortHistoryItems(mergeItems()).slice(0, MAX_HISTORY_ITEMS);

          setHistoryItems(newItems);
          saveHistory({ id: historyId, items: newItems });
        }}
        onChange={(e) => {
          onChange?.(e);
          onChangeText?.(e.currentTarget.value);
        }}
        onKeyDown={(e) => {
          function moveHistorySelection(delta: number) {
            let newIndex = 0;
            if (selectedHistoryItemIndex !== null) {
              newIndex = clamp(selectedHistoryItemIndex + delta, 0, historyItemCount - 1);
            }

            setSelectedHistoryItemIndex(newIndex);

            const item = historyItems[newIndex];

            if (item !== undefined) {
              const { content } = item;

              onChangeText?.(content);

              const input = e.currentTarget;

              input.value = content;

              setTimeout(() => {
                input.setSelectionRange(content.length, content.length);
              }, 100);
            }
          }

          switch (e.key) {
            case 'Enter': {
              e.preventDefault();
              e.stopPropagation();

              break;
            }

            case 'Tab': {
              e.preventDefault();
              e.stopPropagation();

              setHistoryShown((shown) => !shown);

              break;
            }

            case 'Escape': {
              e.preventDefault();
              e.stopPropagation();

              setHistoryShown(false);

              break;
            }

            case 'Backspace':
            case 'Delete': {
              if (value === '') {
                e.preventDefault();
                e.stopPropagation();

                setHistoryShown(false);
              }

              break;
            }

            case 'ArrowUp': {
              e.preventDefault();
              e.stopPropagation();

              setHistoryShown(true);
              moveHistorySelection(-1);

              break;
            }

            case 'ArrowDown': {
              e.preventDefault();
              e.stopPropagation();

              setHistoryShown(true);
              moveHistorySelection(1);

              break;
            }

            default: {
              setHistoryShown(true);
              break;
            }
          }
        }}
      />
      <IconButton
        icon="times"
        iconClassName={`
          fill-tpl size-2 mr-0.5
          ${value === '' ? 'opacity-0' : ''}
        `}
        className="rounded-full p-2"
        bgClassName={value !== '' ? 'hover:bg-bse' : ''}
        rippleColor="var(--color-ripple-icon-button)"
        title={value !== '' ? t('SearchInput.clear') : ''}
        onClick={(e) => {
          e.stopPropagation();
          onClear?.();
          onChangeText?.('');
        }}
        inactive={value === ''}
      />
      {shouldShowHistoryPopover &&
        createPortal(
          <div
            role="listbox"
            aria-label={t('SearchInput.search')}
            className="fixed top-0 left-0 flex flex-col gap-2 bg-bpd p-2 rounded-lg overflow-auto shadow-black shadow-lg"
            style={{
              top: componentBoundingBox.bottom,
              left: isMobile ? 0 : componentBoundingBox.left,
              width: isMobile ? '100vw' : componentBoundingBox.width,
              maxHeight: `min(100vh - ${componentBoundingBox.bottom}px, ${300}px)`,
            }}
          >
            {historyItems.map((item, index) => (
              <HistoryListItem
                key={item.content}
                id={`${listboxId}-option-${index}`}
                item={item}
                selected={selectedHistoryItemIndex === index}
                onClick={() => onChangeText?.(item.content)}
                onSelect={() => setSelectedHistoryItemIndex(index)}
              />
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

function HistoryListItem({
  id,
  item,
  selected,
  onSelect,
  onClick,
}: {
  readonly id: string;
  readonly item: HistoryItem;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly onClick: React.MouseEventHandler<HTMLButtonElement>;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  useGranularEffect(
    () => {
      ref.current?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
      });
    },
    [selected],
    [],
  );

  // A button carrying `role="option"`. It is never in the tab order — the input keeps the focus for
  // the whole interaction and `aria-activedescendant` names the active suggestion — but a real button
  // is what makes the click a click and Enter and Space equivalent, rather than a div with a handler
  // that only the mouse can reach.
  return (
    <button
      ref={ref}
      id={id}
      type="button"
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      className={`
        flex w-full cursor-pointer items-center border-none bg-transparent p-2 text-left
        border-b-2 border-b-bsp last:border-b-0
        ${selected ? 'bg-bse' : ''}
      `}
      onClick={onClick}
      onMouseEnter={onSelect}
    >
      <span className="truncate">{item.content}</span>
    </button>
  );
}

function getHistoryLocaleStorageKey(historyId: string) {
  return `ui-kit.search-input.${historyId}`;
}

function saveHistory(history: Readonly<History>) {
  try {
    localStorage.setItem(getHistoryLocaleStorageKey(history.id), JSON.stringify(history));
  } catch (error) {
    console.error(error);
  }
}

function sortHistoryItems(items: readonly HistoryItem[]) {
  return items.toSorted(
    (a, b) =>
      -cmp(a.usageCount, b.usageCount) ||
      -cmp(a.timestamp, b.timestamp) ||
      cmp(a.content, b.content),
  );
}

function loadHistory(historyId: string): History {
  const empty = { id: historyId, items: [] };

  try {
    const json = localStorage.getItem(getHistoryLocaleStorageKey(historyId));

    if (json === null) {
      return empty;
    }

    const parsedData = JSON.parse(json);

    if (!Array.isArray(parsedData?.items)) {
      return empty;
    }

    let items: HistoryItem[] = [];

    for (const item of parsedData.items) {
      if (item === null || item === undefined) {
        continue;
      }

      const { content, timestamp, usageCount } = item;

      if (
        typeof content !== 'string' ||
        content.trim() === '' ||
        !Number.isSafeInteger(timestamp) ||
        !Number.isSafeInteger(usageCount)
      ) {
        continue;
      }

      const parsedItem: HistoryItem = {
        content: content.trim().slice(0, MAX_HISTORY_ITEM_LENGTH),
        timestamp: Math.max(0, timestamp),
        usageCount: Math.max(0, usageCount),
      };

      items = [...items, parsedItem];
    }

    const history = {
      id: historyId,
      items: sortHistoryItems(items.slice(-MAX_HISTORY_ITEMS)),
    };

    saveHistory(history);

    return history;
  } catch (error) {
    console.error(error);

    return empty;
  }
}
