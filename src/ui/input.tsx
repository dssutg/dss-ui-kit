import { createPortal, useCallback, useEffect, useRef, useState } from 'react';
import { Editor } from '@/lib/editor';
import { highlightText } from '@/lib/highlight';
import { ipv4Regex } from '@/lib/ipv4';
import { clamp, cmp } from '@/lib/math';
import { useGranularEffect } from '@/lib/use_granular_effect';
import { useLocale } from '@/locale';
import { IconButton, PlayPauseButton } from './button';
import { Icon } from './icon';
import { useIsMobileScreen } from './use_is_mobile_screen';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  readonly className?: string | undefined;
}

export function Input({ ...rest }: InputProps) {
  return (
    <input
      className="bg-bin block rounded-lg p-1 h-fit text-tpl placeholder-tpd outline-none"
      {...rest}
    />
  );
}

export function UnsignedIntegerInput({
  value = 0,
  onChange,
  min = 0,
  max = 100,
}: {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min?: number | undefined;
  readonly max?: number | undefined;
}) {
  const actualMin = Math.max(min, 0);
  const actualMax = Math.min(max, Number.MAX_SAFE_INTEGER);

  const incrementDecrement = useCallback(
    (isIncrement: boolean) => {
      let newValue = 0;
      if (isIncrement) {
        newValue = Math.min(value + 1, actualMax);
      } else {
        newValue = Math.max(value - 1, actualMin);
      }

      if (newValue.toString().includes('e')) {
        onChange?.(0);
      } else {
        onChange?.(newValue);
      }
    },
    [onChange, actualMin, actualMax, value],
  );

  return (
    <div className="box-border flex w-32 min-w-full">
      <input
        type="number"
        pattern="[0-9]{10}"
        value={value}
        min={actualMin}
        max={actualMax}
        step="1"
        onChange={(e) => {
          let val = '0';
          if (e.currentTarget.value !== '' && !e.currentTarget.value.includes('e')) {
            val = e.currentTarget.value;
          }

          const x = parseInt(val, 10);

          e.currentTarget.value = x.toString();
          onChange?.(x);
        }}
        onKeyDown={(e) => {
          if (!/\d/.test(e.key)) {
            e.preventDefault();
          }
        }}
        onBlur={(e) => {
          const x = clamp(parseInt(e.currentTarget.value, 10), actualMin, actualMax);
          e.currentTarget.value = x.toString();
          onChange?.(x);
        }}
        className="bg-bin text-tpl m-0 box-border w-full appearance-none rounded-l-full border-none py-4 pl-4 pr-0 text-base outline-none"
      />
      <div className="bg-bin flex flex-col items-center justify-center gap-1 rounded-r-full pr-5">
        {Array.from({ length: 2 }).map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => incrementDecrement(index === 0)}
            className="text-tpd box-border cursor-pointer border-none bg-transparent p-0 text-base hover:brightness-150"
          >
            {index === 0 ? <>&#9650;</> : <>&#9660;</>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TextInput({
  type,
  shouldRender = true,
  textColor = 'var(--color-tpl)',
  placeholderColor = 'var(--color-placeholder)',
  outline = 'none',
  placeholder,
  width = 'max-content',
  minWidth = '8rem',
  inputPadding = '0.25rem 0.5rem',
  clearButtonPadding = '0.25rem 0.5rem',
  showHidePasswordPadding = '0.25rem 0.5rem',
  value = '',
  min,
  max,
  step,
  hasShowPasswordButton = false,
  inputRef = null,
  inputAutoFocus = false,
  onChange,
  onChangeText,
  onClearClick,
  onKeyUp,
  onKeyDown,
  onConfirm,
  onFocus,
  onBlur,
  onShowPasswordClick,
  spellCheck,
  hiddenText = false,
  pattern,
  showPasswordIconInnerStyle,
  clearIconInnerStyle,
  inputStyle,
}: {
  readonly type?: React.HTMLInputTypeAttribute | undefined;
  readonly shouldRender?: boolean | undefined;
  readonly textColor?: string | undefined;
  readonly placeholderColor?: string | undefined;
  readonly outline?: string | undefined;
  readonly placeholder?: string | undefined;
  readonly width?: string | undefined;
  readonly minWidth?: string | undefined;
  readonly inputPadding?: string | undefined;
  readonly clearButtonPadding?: string | undefined;
  readonly value?: string | undefined;
  readonly min?: string | number | undefined;
  readonly max?: string | number | undefined;
  readonly step?: string | number | undefined;
  readonly hasShowPasswordButton?: boolean | undefined;
  inputRef?: React.Ref<HTMLInputElement> | undefined;
  readonly onChange?: React.ChangeEventHandler<HTMLInputElement> | undefined;
  readonly onChangeText?: (value: string) => void;
  readonly onClearClick?: React.MouseEventHandler<HTMLButtonElement> | undefined;
  readonly onKeyUp?: React.KeyboardEventHandler<HTMLInputElement> | undefined;
  readonly onKeyDown?: React.KeyboardEventHandler<HTMLInputElement> | undefined;
  readonly onConfirm?: React.KeyboardEventHandler<HTMLInputElement> | undefined;
  readonly onFocus?: React.FocusEventHandler<HTMLInputElement> | undefined;
  readonly onBlur?: React.FocusEventHandler<HTMLInputElement> | undefined;
  readonly onShowPasswordClick?: React.MouseEventHandler<HTMLButtonElement> | undefined;
  readonly spellCheck?: boolean | undefined;
  readonly hiddenText?: boolean | undefined;
  readonly pattern?: string | undefined;
  readonly inputAutoFocus?: boolean | undefined;
  readonly showPasswordIconInnerStyle?: React.CSSProperties | undefined;
  readonly clearIconInnerStyle?: React.CSSProperties | undefined;
  readonly inputStyle?: React.CSSProperties | undefined;
  [x: string]: unknown;
}) {
  const { t } = useLocale();

  return (
    shouldRender && (
      <div className="box-border flex h-fit" style={{ width, minWidth }}>
        <input
          ref={inputRef}
          type={type ?? (hiddenText ? 'password' : 'text')}
          placeholder={placeholder}
          value={value}
          min={min}
          max={max}
          step={step}
          autoFocus={inputAutoFocus}
          onChange={(e) => {
            onChangeText?.(e.currentTarget.value);
            onChange?.(e);
          }}
          onKeyUp={onKeyUp}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onConfirm?.(e);
            }
            onKeyDown?.(e);
          }}
          onFocus={onFocus}
          onBlur={onBlur}
          spellcheck={spellCheck}
          pattern={pattern}
          className="m-0 box-border w-full rounded-l-lg text-base outline-none placeholder:text-[var(--placeholder-color)] bg-bin"
          style={
            {
              '--placeholder-color': placeholderColor,
              color: textColor,
              border: outline,
              padding: inputPadding,
              ...inputStyle,
            } as React.CSSProperties
          }
        />
        {hasShowPasswordButton && (
          <IconButton
            icon={hiddenText ? 'eye' : 'eyeSlash'}
            iconStyle={{
              width: '1rem',
              height: '1rem',
              ...showPasswordIconInnerStyle,
            }}
            bgClassName="hover:bg-bse bg-bin"
            style={
              {
                fill: 'var(--color-tpl)',
                padding: showHidePasswordPadding,
              } as React.CSSProperties
            }
            rippleColor="var(--color-ripple-icon-button)"
            onClick={onShowPasswordClick}
            title={t(hiddenText ? 'actions.showPassword' : 'actions.hidePassword')}
          />
        )}
        <IconButton
          icon="times"
          iconStyle={{
            width: '0.5rem',
            height: '0.5rem',
            ...(value === '' && { opacity: 0 }),
            ...clearIconInnerStyle,
          }}
          bgClassName={`bg-bin ${value !== '' ? 'hover:bg-bse' : ''}`}
          style={
            {
              fill: 'var(--color-tpl)',
              width: '1.5rem',
              borderTopRightRadius: '0.5rem',
              borderBottomRightRadius: '0.5rem',
              padding: clearButtonPadding,
            } as React.CSSProperties
          }
          rippleColor="var(--color-ripple-icon-button)"
          onClick={(e) => {
            onChangeText?.('');
            onClearClick?.(e);
          }}
          title={value !== '' ? t('actions.clearInputTextField') : ''}
          inactive={value === ''}
        />
      </div>
    )
  );
}

export function IPInput({
  value,
  onChange,
  width,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly width?: string | undefined;
}) {
  const onChangeText = useCallback(
    (text: string) => {
      onChange(
        text
          .replace(/[^\d.]+/g, '')
          .replace(/^0+/g, '0')
          .replace(/^\.+/g, '')
          .replace(/\.\.\.+/g, '..') // but allow double period for editing
          .split('.')
          .slice(0, 4)
          .map((octet) => {
            if (octet === '') {
              return '';
            }
            return clamp(Number(octet) || 0, 0, 255);
          })
          .join('.'),
      );
    },
    [onChange],
  );

  let outline = '1px solid var(--color-tda)';
  if (ipv4Regex.test(value)) {
    outline = '1px solid rgba(0, 0, 0, 0)';
  }

  return <TextInput value={value} onChangeText={onChangeText} width={width} outline={outline} />;
}

export function FloatInput({
  value,
  onChange,
  width,
  min,
  max,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly width?: string | undefined;
  readonly min?: number | undefined;
  readonly max?: number | undefined;
}) {
  const valueNum = Number(value);

  const valid =
    /^-?\d+(\.\d+)?$/.test(value) &&
    !Number.isNaN(valueNum) &&
    (min === undefined || valueNum >= min) &&
    (max === undefined || valueNum <= max);

  const onChangeText = useCallback(
    (text: string) => {
      onChange(
        text
          .replace(/[^\d.-]+/g, '')
          .replace(/--+/g, '-')
          .replace(/^00+/g, '0')
          .replace(/^\.+/g, '')
          .split('.')
          .slice(0, 2)
          .join('.'),
      );
    },
    [onChange],
  );

  return (
    <TextInput
      type="number"
      value={value}
      onChangeText={onChangeText}
      width={width}
      min={min}
      max={max}
      outline={valid ? '1px solid rgba(0, 0, 0, 0)' : '1px solid var(--color-tda)'}
    />
  );
}

export function SocketServerAddressInput({
  value,
  onChange,
  onConfirm,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onConfirm: () => void;
}) {
  return (
    <TextInput
      value={value}
      placeholder="ws://127.0.0.1:9000"
      onChange={(e) => onChange(e.currentTarget.value)}
      onClearClick={() => onChange('')}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onConfirm();
        }
      }}
    />
  );
}

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

  const historyItemCount = historyItems.length;

  const shouldShowHistoryPopover =
    componentBoundingBox !== null && historyShown && historyItems.length !== 0;

  return (
    <div
      ref={outerRef ?? null}
      className="relative bg-bin flex flex-grow items-center rounded-lg px-2 py-1"
      style={style}
      tabIndex={0}
      onFocus={(e) => {
        inputRef.current?.focus();

        setComponentBoundingBox(e.currentTarget.getBoundingClientRect());
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
    >
      <Icon name="search" style={{ fill: 'var(--color-tpl)', width: '1rem', height: '1rem' }} />
      <input
        ref={inputRef}
        type="text"
        className="text-tpl placeholder-tpd ml-4 flex-grow bg-transparent outline-none"
        style={inputStyle}
        placeholder={placeholder ?? t('SearchInput.search')}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellcheck={false}
        autoFocus={autoFocus}
        value={value}
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
  item,
  selected,
  onSelect,
  onClick,
}: {
  readonly item: HistoryItem;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly onClick: React.MouseEventHandler<HTMLDivElement>;
}) {
  const ref = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={ref}
      tabIndex={0}
      className={`
        flex shrink-0 p-2 w-full rounded-lg cursor-pointer border-b-2 border-b-bsp last:border-b-0
        ${selected ? 'bg-bse' : ''}
      `}
      onClick={onClick}
      onMouseEnter={onSelect}
    >
      <div className="truncate">{item.content}</div>
    </div>
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

export function HourMinuteTimeInput({
  hour,
  onHourChange,
  minute,
  onMinuteChange,
}: {
  readonly hour: number;
  readonly onHourChange: (hour: number) => void;
  readonly minute: number;
  readonly onMinuteChange: (minute: number) => void;
}) {
  return (
    <div className="flex gap-2 items-center">
      <TimePartInput value={hour} onChange={onHourChange} max={23} />
      <div>:</div>
      <TimePartInput value={minute} onChange={onMinuteChange} max={59} />
    </div>
  );
}

export function HourMinuteSecondTimeInput({
  hour,
  onHourChange,
  minute,
  onMinuteChange,
  second,
  onSecondChange,
}: {
  readonly hour: number;
  readonly onHourChange: (hour: number) => void;
  readonly minute: number;
  readonly onMinuteChange: (minute: number) => void;
  readonly second: number;
  readonly onSecondChange: (second: number) => void;
}) {
  return (
    <div className="flex gap-2 items-center">
      <TimePartInput value={hour} onChange={onHourChange} max={23} />
      <div>:</div>
      <TimePartInput value={minute} onChange={onMinuteChange} max={59} />
      <div>:</div>
      <TimePartInput value={second} onChange={onSecondChange} max={59} />
    </div>
  );
}

function TimePartInput({
  value,
  onChange,
  max,
}: {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly max: number;
}) {
  const min = 0;

  return (
    <div className="flex flex-col items-center">
      <IconButton
        icon="triangleDown"
        iconClassName="size-3 fill-tpd rotate-180"
        className="rounded-full p-1"
        rippleColor="var(--color-ripple-icon-button)"
        onClick={() => onChange(clamp(value + 1, min, max))}
        inactive={value === max}
      />
      <DecimalIntegerInput
        value={value}
        minValue={min}
        maxValue={max}
        onChange={(value) => onChange(value ?? min)}
        shouldResetEmptyInput
        inputStyle={{ width: '3rem' }}
      />
      <IconButton
        icon="triangleDown"
        iconClassName="size-3 fill-tpd"
        className="rounded-full p-1"
        rippleColor="var(--color-ripple-icon-button)"
        onClick={() => onChange(clamp(value - 1, min, max))}
        inactive={value === min}
      />
    </div>
  );
}

export type DecimalIntegerInputValue = number | undefined;

export function DecimalIntegerInput({
  value,
  onChange,
  onClear,
  minValue = 0,
  maxValue = 2 ** 32 - 1,
  style,
  inputStyle,
  onInputBlur,
  onInputKeyDown,
  onInputWheel,
  shouldResetEmptyInput = false,
  inputRef = null,
  noAlteringValueWithArrowKeys = false,
  noAlteringValueWithMouseWheel = false,
  base = 10,
}: {
  readonly value: DecimalIntegerInputValue;
  readonly onChange: (value: DecimalIntegerInputValue) => void;
  readonly onClear?: (() => void) | undefined;
  readonly minValue?: number | undefined;
  readonly maxValue?: number | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly inputStyle?: React.CSSProperties | undefined;
  readonly onInputBlur?: React.FocusEventHandler<HTMLInputElement> | undefined;
  readonly onInputKeyDown?: (event: KeyboardEvent) => void;
  readonly onInputWheel?: (event: WheelEvent) => void;
  readonly shouldResetEmptyInput?: boolean | undefined;
  inputRef?: React.Ref<HTMLInputElement> | undefined;
  readonly noAlteringValueWithArrowKeys?: boolean | undefined;
  readonly noAlteringValueWithMouseWheel?: boolean | undefined;
  readonly base?: 10 | 16 | undefined;
}) {
  const { t } = useLocale();

  const maxDigits = maxValue.toString(base).length;

  const adjustValue = useCallback(
    (delta: number) => {
      onChange(clamp((value ?? minValue) + delta, minValue, maxValue));
    },
    [onChange, value, minValue, maxValue],
  );

  const handleKeyDownDefault = useCallback(
    (event: KeyboardEvent) => {
      if (noAlteringValueWithArrowKeys) {
        return;
      }

      const handlers: Readonly<Record<string, () => void>> = {
        ArrowUp: () => adjustValue(1),
        ArrowDown: () => adjustValue(-1),
      };

      const handler = handlers[event.key];

      if (!handler) {
        return;
      }

      event.preventDefault();
      handler();
    },
    [noAlteringValueWithArrowKeys, adjustValue],
  );

  const handleWheelDefault = useCallback(
    (event: WheelEvent) => {
      const element = event.currentTarget as HTMLInputElement;

      if (document.activeElement !== element) {
        return;
      }

      if (noAlteringValueWithMouseWheel) {
        return;
      }

      adjustValue(-Math.sign(event.deltaY));
    },
    [noAlteringValueWithMouseWheel, adjustValue],
  );

  const getTextValue = useCallback(
    (value: DecimalIntegerInputValue) => {
      if (value === undefined) {
        return '';
      }
      return value.toString(base).toUpperCase();
    },
    [base],
  );

  return (
    <div className="bg-bin flex rounded-lg pl-2 h-fit" style={style}>
      <input
        ref={inputRef}
        type="text"
        className="text-tpl placeholder-tpd flex-grow bg-transparent outline-none"
        style={inputStyle}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellcheck={false}
        value={getTextValue(value)}
        onChange={(e) => {
          let filterRegexp = /\D/g;
          if (base !== 10) {
            filterRegexp = /[^\dA-Fa-f]/g;
          }

          const digits = e.currentTarget.value
            .replace(filterRegexp, '')
            .replace(/^0+([^.])/, '$1')
            .slice(0, maxDigits);

          if (digits === '') {
            if (shouldResetEmptyInput) {
              onChange(minValue);
            } else {
              onChange(undefined);
            }
            return;
          }

          const enteredNumber = parseInt(digits, base);

          const value = clamp(enteredNumber, minValue, maxValue);

          onChange(value);
        }}
        onBlur={onInputBlur}
        onKeyDown={(e) => {
          handleKeyDownDefault(e);
          onInputKeyDown?.(e);
        }}
        onWheel={(e) => {
          handleWheelDefault(e);
          onInputWheel?.(e);
        }}
      />
      <IconButton
        icon="times"
        iconClassName={`
          fill-tpl size-2
          ${value === undefined ? 'opacity-0' : ''}
        `}
        className={`
          rounded-full p-2
          ${value !== undefined ? 'hover:bg-bse' : ''}
        `}
        rippleColor="var(--color-ripple-icon-button)"
        title={value !== undefined ? t('DecimalIntegerInput.clear') : ''}
        onClick={(e) => {
          e.stopPropagation();
          if (shouldResetEmptyInput || onClear === undefined) {
            onChange(minValue);
          } else {
            onClear();
          }
        }}
        inactive={value === undefined}
      />
    </div>
  );
}

export function DelayedInput({
  value,
  onChange,
  onBlur,
  spellCheck = true,
  className,
  style,
  getFilteredValue,
  changeOnEnterKey = false,
  autoFocus = false,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onBlur?: () => void;
  readonly spellCheck?: boolean | undefined;
  readonly className?: string | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly getFilteredValue?: (value: string) => string;
  readonly changeOnEnterKey?: boolean | undefined;
  readonly autoFocus?: boolean | undefined;
}) {
  const [hotValue, setHotValue] = useState(value);

  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => setHotValue(value), [value]);

  return (
    <input
      ref={ref}
      type="text"
      value={hotValue}
      spellcheck={spellCheck}
      onChange={(e) => {
        const { value } = e.currentTarget;

        if (getFilteredValue) {
          setHotValue(getFilteredValue(value));
        } else {
          setHotValue(value);
        }
      }}
      onBlur={() => {
        onChange(hotValue);
        onBlur?.();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && changeOnEnterKey) {
          ref.current?.blur();
        }
      }}
      className={className}
      style={style}
      autoFocus={autoFocus}
    />
  );
}

export function JsonEditor({
  code,
  setCode,
  expandingTab = false,
  tabSize = 2,
  highlightSyntax = true,
  style,
}: {
  readonly code: string;
  readonly setCode: (code: string) => void;
  readonly expandingTab?: boolean | undefined;
  readonly tabSize?: number | undefined;
  readonly highlightSyntax?: boolean | undefined;
  readonly style?: React.CSSProperties | undefined;
}) {
  return (
    <div className="flex w-full gap-2 overflow-hidden" style={style}>
      <div className="flex-grow overflow-scroll">
        <Editor
          value={code}
          onValueChange={setCode}
          highlight={() => {
            if (highlightSyntax) {
              return highlightText(code, 'json');
            }
            return code;
          }}
          tabSize={expandingTab ? tabSize : 1}
          insertSpaces={expandingTab}
          autoFocus
          className="min-h-full font-mono outline-none"
          textareaStyle={{
            fontFamily: 'var(--font-mono)',
            outline: '2px solid transparent',
            outlineOffset: 2,
          }}
          preClassName="font-mono outline-none"
        />
      </div>
    </div>
  );
}

export function ByteFractionInput({
  value,
  onChange,
}: {
  readonly value: number;
  readonly onChange: (value: number) => void;
}) {
  const min = 0;
  const max = 25.5;

  return (
    <TextInput
      type="number"
      min={min}
      max={max}
      step={0.1}
      value={value.toString()}
      onChangeText={(value) => {
        onChange(clamp(Number(value.replace(/[^\d.]/g, '')) || 0, min, max));
      }}
      width="100%"
    />
  );
}

export function LogWidget({
  title,
  playing,
  output,
  onPlayClick,
  onPauseClick,
  onClearClick,
  extraLeftControlsComponent,
  extraRightControlsComponent,
  style,
  className,
}: {
  readonly title: string;
  readonly playing: boolean;
  readonly output: string;
  readonly onPlayClick: React.MouseEventHandler<HTMLButtonElement>;
  readonly onPauseClick: React.MouseEventHandler<HTMLButtonElement>;
  readonly onClearClick: React.MouseEventHandler<HTMLButtonElement>;
  readonly extraLeftControlsComponent?: React.ReactNode | undefined;
  readonly extraRightControlsComponent?: React.ReactNode | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly className?: string | undefined;
}) {
  const { t } = useLocale();

  return (
    <div
      className={`bg-bpd flex flex-grow flex-col overflow-hidden rounded-2xl p-4 ${className}`}
      style={style}
    >
      <div className="flex justify-between">
        <div className="flex">
          <PlayPauseButton
            playTitle={t('LogWidget.enableMessageOutput')}
            pauseTitle={t('LogWidget.disableMessageOutput')}
            playing={playing}
            onClick={playing ? onPauseClick : onPlayClick}
          />
          <IconButton
            icon="clear"
            iconClassName="fill-tda size-6"
            className="ml-2 rounded-full p-1 sm:ml-10"
            rippleColor="var(--color-ripple-icon-button)"
            title={t('LogWidget.clearMessageOutput')}
            onClick={onClearClick}
          />
          {extraLeftControlsComponent}
        </div>
        <div className="text-tpl flex-grow text-center truncate select-none">{title}</div>
        <div>{extraRightControlsComponent}</div>
      </div>
      <LogOutputTextArea
        output={output}
        style={{ marginTop: '0.5rem', borderRadius: 0, padding: 0 }}
      />
    </div>
  );
}

export function LogOutputTextArea({
  output,
  dontWrapLongLines = false,
  style,
  shouldScrollToEndOnUpdate = false,
}: {
  readonly output: string;
  readonly dontWrapLongLines?: boolean | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly shouldScrollToEndOnUpdate?: boolean | undefined;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useGranularEffect(
    () => {
      const textarea = textareaRef.current;

      if (!textarea) {
        return;
      }

      if (
        shouldScrollToEndOnUpdate ||
        textarea.scrollHeight - (textarea.scrollTop + textarea.clientHeight) < 200
      ) {
        textarea.scrollTop = textarea.scrollHeight;
      }
    },
    [output, textareaRef, shouldScrollToEndOnUpdate],
    [],
  );

  return (
    <textarea
      ref={textareaRef}
      className={`
        bg-bpd text-tpl w-full flex-grow resize-none overflow-y-scroll rounded-2xl p-2 font-mono outline-none
        ${dontWrapLongLines ? 'overflow-x-scroll whitespace-pre' : ''}
      `}
      style={style}
      value={output}
      readOnly
    />
  );
}

export function HighlightedJson({
  json,
  className,
}: {
  readonly json: string;
  readonly className?: string | undefined;
}) {
  return (
    <pre className={className} dangerouslySetInnerHTML={{ __html: highlightText(json, 'json') }} />
  );
}
