import { createPortal, useCallback, useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from '@/components/display/Icon';
import { Ripple } from '@/components/feedback/Ripple';
import { compareArrays, isChildArrayPath } from '@/lib/array';
import { areDOMRectsEqual } from '@/lib/dom';
import { clamp } from '@/lib/math';
import { useEventListener } from '@/lib/use_event_listener';
import { useGranularEffect } from '@/lib/use_granular_effect';
import { useInterval } from '@/lib/use_interval';
import { useWindowSize } from '@/lib/use_window_size';
import { useLocale } from '@/locale';

export function DropDownMenu({
  variant = 'dots',
  triggerIcon,
  triggerTitle,
  triggerTitleStyle,
  triggerHoverTitle,
  triggerStyle,
  triggerIconStyle,
  dropDownListStyle,
  menuItemClassName,
  menuItemIconStyle,
  menuItemIconMoreStyle,
  menu,
  onTriggerClick,
  onTriggerMouseEnter,
  onTriggerMouseLeave,
}: {
  readonly variant?: 'dots' | 'button' | undefined;
  readonly triggerIcon?: IconName | undefined;
  readonly triggerTitle?: string | undefined;
  readonly triggerTitleStyle?: React.CSSProperties | undefined;
  readonly triggerHoverTitle?: string | undefined;
  readonly triggerStyle?: React.CSSProperties | undefined;
  readonly triggerIconStyle?: React.CSSProperties | undefined;
  readonly dropDownListStyle?: React.CSSProperties | undefined;
  readonly menuItemClassName?: string | undefined;
  readonly menuItemIconStyle?: React.CSSProperties | undefined;
  readonly menuItemIconMoreStyle?: React.CSSProperties | undefined;
  readonly menu: DropDownMenuItem[];
  readonly onTriggerClick?: React.MouseEventHandler<HTMLButtonElement> | undefined;
  readonly onTriggerMouseEnter?: React.MouseEventHandler<HTMLButtonElement> | undefined;
  readonly onTriggerMouseLeave?: React.MouseEventHandler<HTMLButtonElement> | undefined;
}) {
  const { t } = useLocale();

  const [open, setOpen] = useState(false);
  const [path, setPath] = useState<string[]>([]);

  useGranularEffect(() => setPath([]), [open], []);

  useEffect(() => {
    setPath((p) => {
      if (getPanelMenuItemsByPath(p, menu) === null) {
        return [];
      }
      return p;
    });
  }, [menu]);

  // Only the dots variant carries a hover title. Resolving it here keeps the fallback out of a
  // nested ternary at the call site.
  const dotsTriggerTitle =
    variant === 'dots' ? (triggerHoverTitle ?? t('DropDownMenu.trigger.title')) : undefined;

  // The dots variant marks the open state with its own background. Resolving it here keeps the
  // `open` test out of a nested ternary inside the class string. An unopened trigger is given an
  // explicit transparent background rather than nothing, because the dots variant also sets a
  // border and the two have to agree about what sits under it.
  let openDotsBackground = '';
  if (variant === 'dots') {
    openDotsBackground = open ? 'bg-bse' : 'bg-transparent';
  }

  const triggerRef = useRef<HTMLButtonElement>(null);

  const onClose = useCallback(() => setOpen(false), []);

  useWindowSize();

  const moveUpOrDown = useCallback(
    (direction: 'up' | 'down') => {
      const up = direction === 'up';

      if (path.length === 0) {
        if (up) {
          setPath(menu[menu.length - 1]?.path ?? []);
        } else {
          setPath(menu[0]?.path ?? []);
        }
        return;
      }

      const panelInfo = getPanelMenuItemsByPath(path, menu);

      if (panelInfo === null) {
        return;
      }

      const { panel, itemIndex } = panelInfo;

      let delta = 1;
      if (up) {
        delta = -1;
      }

      const newPath = panel[clamp(itemIndex + delta, 0, panel.length)]?.path;

      if (newPath === undefined) {
        return;
      }

      setPath(newPath);
    },
    [path, menu],
  );

  /**
   * Enter activates the highlighted item, which is only a choice when it has no submenu of its own:
   * otherwise it is a step down a level, which is what ArrowRight does.
   */
  const onEnter = () => {
    const panelInfo = getPanelMenuItemsByPath(path, menu);

    if (panelInfo !== null && panelInfo.item.submenu === undefined) {
      onClose();
      panelInfo.item.onSelect?.();
    }
  };

  /** ArrowLeft goes up one level, and stops at the root rather than at nothing. */
  const onArrowLeft = () => {
    setPath((path) => {
      if (path.length > 1) {
        return path.slice(0, -1);
      }
      return path;
    });
  };

  /** ArrowRight steps into the highlighted item's submenu, and does nothing if it has none. */
  const onArrowRight = () => {
    const panelInfo = getPanelMenuItemsByPath(path, menu);

    const newPath = panelInfo?.item.submenu?.[0]?.path;

    if (newPath !== undefined) {
      setPath(newPath);
    }
  };

  /**
   * What each key does while the menu is open. Every one of them calls `preventDefault` and then a
   * single action, so listing them here keeps the listener below from growing a branch per key.
   */
  const keyActions: Readonly<Record<string, () => void>> = {
    Escape: onClose,
    Space: () => setOpen((isOpen) => !isOpen),
    ArrowUp: () => moveUpOrDown('up'),
    ArrowDown: () => moveUpOrDown('down'),
    ArrowLeft: onArrowLeft,
    ArrowRight: onArrowRight,
  };

  useEventListener('keydown', (event: KeyboardEvent) => {
    if (!open) {
      return;
    }

    // Enter is matched on `key` where every other key here is matched on `code`.
    if (event.key === 'Enter') {
      event.preventDefault();
      onEnter();
      return;
    }

    const action = keyActions[event.code];

    if (action !== undefined) {
      event.preventDefault();
      action();
    }
  });

  const [rootTriggerBox, setRootTriggerBox] = useState<DOMRect | null>(null);

  useEffect(() => {
    setRootTriggerBox(triggerRef.current?.getBoundingClientRect() ?? null);
  }, []);

  useEffect(() => {
    const trigger = triggerRef.current;

    if (trigger === null) {
      return undefined;
    }

    // The element is captured in a closure below, which ends the narrowing the check above did.
    function updateRootTriggerBox() {
      if (trigger === null) {
        return;
      }

      setRootTriggerBox(trigger.getBoundingClientRect());
    }

    const resizeObserver = new ResizeObserver(updateRootTriggerBox);
    const mutationObserver = new MutationObserver(updateRootTriggerBox);

    resizeObserver.observe(trigger);
    mutationObserver.observe(trigger, {
      attributes: true,
      childList: true,
      subtree: true,
    });

    updateRootTriggerBox();

    return () => {
      resizeObserver.unobserve(trigger);
      mutationObserver.disconnect();
    };
  }, []);

  useInterval(() => {
    if (triggerRef.current === null) {
      return;
    }

    const box = triggerRef.current.getBoundingClientRect();

    if (rootTriggerBox !== null && areDOMRectsEqual(rootTriggerBox, box)) {
      return;
    }

    setRootTriggerBox(box);
  }, 500);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        tabIndex={0}
        className={`
          relative box-border flex shrink-0 select-none place-items-center overflow-hidden
          ${variant === 'dots' ? 'aspect-square rounded-full border-none p-2 hover:bg-bse' : ''}
          ${variant === 'button' ? 'rounded-lg bg-bbp px-2 hover:brightness-150' : ''}
          ${openDotsBackground}
        `}
        style={triggerStyle}
        title={dotsTriggerTitle}
        onClick={(e) => {
          setOpen((open) => !open);
          onTriggerClick?.(e);
        }}
        onMouseEnter={onTriggerMouseEnter}
        onMouseLeave={onTriggerMouseLeave}
      >
        {variant === 'button' && (
          <div className="mr-2 flex-grow border-r-2 border-tpl py-2 pr-4" style={triggerTitleStyle}>
            {triggerTitle}
          </div>
        )}
        <Icon
          name={triggerIcon ?? (variant === 'dots' ? 'more' : 'triangleDown')}
          style={{
            ...(variant === 'dots'
              ? { width: '1.5rem', height: '1.5rem', fill: 'var(--color-tpd)' }
              : { width: '1rem', height: '1rem', fill: 'var(--color-tpl)' }),
            ...triggerIconStyle,
          }}
        />
      </button>
      {open &&
        // Portals help to avoid incorrect positioning because of transforms like scale or translate
        // that affect top and left CSS properties to be not relative viewport.
        // This problem often happens in modal windows.
        // We also want the trigger button to receive styles, not a wrapper DIV around
        // these two elements.
        createPortal(
          <div className="fixed top-0 left-0">
            {/* An invisible full-screen button: clicking anywhere outside the menu closes it, and
                a keyboard user gets the same. `opacity-0` leaves it in the accessibility tree, which
                is what makes the close reachable at all. */}
            <button
              type="button"
              aria-label={t('Modal.close')}
              className="fixed top-0 left-0 h-screen w-screen cursor-default border-none bg-transparent p-0 opacity-0"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            />
            <DropDownMenuPanel
              key={JSON.stringify([menu, rootTriggerBox])}
              onClose={onClose}
              path={path}
              setPath={setPath}
              submenu={menu}
              triggerBox={rootTriggerBox}
              rootTriggerBox={rootTriggerBox}
              dropDownListStyle={dropDownListStyle}
              menuItemClassName={menuItemClassName}
              menuItemIconStyle={menuItemIconStyle}
              menuItemIconMoreStyle={menuItemIconMoreStyle}
            />
          </div>,
          document.body,
        )}
    </>
  );
}

export interface DropDownMenuItem {
  path: string[];
  icon?: IconName | undefined;
  title: string;
  onSelect?: () => void;
  submenu?: DropDownMenuItem[] | undefined;
}

function getPanelMenuItemsByPath(path: readonly string[], rootPanel: readonly DropDownMenuItem[]) {
  let panel: readonly DropDownMenuItem[] = rootPanel;

  for (let partIndex = 0; partIndex < path.length; partIndex++) {
    const subpath = path.slice(0, partIndex + 1);

    const itemIndex = panel.findIndex((item) => compareArrays(item.path, subpath) === 0);
    const item = itemIndex === -1 ? undefined : panel[itemIndex];

    if (item === undefined) {
      return null;
    }

    // Final item?
    if (partIndex === path.length - 1) {
      return { panel, item, itemIndex };
    }

    // It's predecessor, continue searching deeper
    // If not submenu, nothing is found
    if (item.submenu === undefined || item.submenu.length === 0) {
      return null;
    }

    panel = item.submenu;
  }

  return null;
}

function DropDownMenuPanel({
  submenu,
  onClose,
  path,
  setPath,
  rootTriggerBox,
  triggerBox,
  dropDownListStyle,
  menuItemClassName,
  menuItemIconStyle,
  menuItemIconMoreStyle,
}: {
  readonly onClose: () => void;
  readonly path: string[];
  readonly setPath: (path: string[]) => void;
  readonly submenu: DropDownMenuItem[];
  readonly rootTriggerBox: DOMRect | null;
  readonly triggerBox: DOMRect | null;
  readonly dropDownListStyle?: React.CSSProperties | undefined;
  readonly menuItemClassName?: string | undefined;
  readonly menuItemIconStyle?: React.CSSProperties | undefined;
  readonly menuItemIconMoreStyle?: React.CSSProperties | undefined;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  const [posX, setPosX] = useState<number | null>(null);
  const [posY, setPosY] = useState<number | null>(null);

  const updatePos = useCallback(() => {
    if (triggerBox === null || rootTriggerBox === null || listRef.current === null) {
      return;
    }

    const listBox = listRef.current.getBoundingClientRect();

    const marginX = 3;
    const marginY = 3;

    let offsetX = 0;
    let offsetY = triggerBox.height + marginY;

    if (triggerBox !== rootTriggerBox) {
      offsetX = triggerBox.width + marginX;
      offsetY = 0;
    }

    let x = triggerBox.x + offsetX;
    const y = clamp(triggerBox.y + offsetY, 0, window.innerHeight - listBox.height);

    const maxX = window.innerWidth - listBox.width;

    if (triggerBox !== rootTriggerBox && x >= maxX) {
      // Nested panel overflows, try left side
      x = triggerBox.x - listBox.width - marginX;
    }

    x = clamp(x, 0, maxX);

    setPosX(x);
    setPosY(y);
  }, [triggerBox, rootTriggerBox]);

  useGranularEffect(
    () => {
      updatePos();
    },
    [triggerBox, rootTriggerBox],
    [updatePos],
  );

  useGranularEffect(
    () => {
      const list = listRef.current;

      if (list === null) {
        return undefined;
      }

      const resizeObserver = new ResizeObserver(updatePos);
      const mutationObserver = new MutationObserver(updatePos);

      resizeObserver.observe(list);
      mutationObserver.observe(list, { childList: true });

      updatePos();

      return () => {
        resizeObserver.unobserve(list);
        mutationObserver.disconnect();
      };
    },
    [],
    [updatePos],
  );

  return (
    <div
      ref={listRef}
      className={`
        max-h-[300px] max-w-[100vw] shrink-0 overflow-y-auto overflow-x-hidden rounded-2xl bg-bpd p-2 text-tpl shadow-lg shadow-black
        fixed top-0 left-0
        ${posX === null || posY === null ? 'invisible pointer-events-none opacity-0' : ''}
      `}
      style={{
        top: posY ?? 0,
        left: posX ?? 0,
        ...dropDownListStyle,
      }}
    >
      {submenu.map((item) => (
        <DropDownMenuItemElement
          key={JSON.stringify([item.path, posX, posY])}
          item={item}
          onClose={onClose}
          path={path}
          setPath={setPath}
          rootTriggerBox={rootTriggerBox}
          dropDownListStyle={dropDownListStyle}
          menuItemClassName={menuItemClassName}
          menuItemIconStyle={menuItemIconStyle}
          menuItemIconMoreStyle={menuItemIconMoreStyle}
        />
      ))}
    </div>
  );
}

function DropDownMenuItemElement({
  item,
  onClose,
  path,
  setPath,
  rootTriggerBox,
  dropDownListStyle,
  menuItemClassName,
  menuItemIconStyle,
  menuItemIconMoreStyle,
}: {
  readonly item: DropDownMenuItem;
  readonly onClose: () => void;
  readonly path: string[];
  readonly setPath: (path: string[]) => void;
  readonly rootTriggerBox: DOMRect | null;
  readonly dropDownListStyle?: React.CSSProperties | undefined;
  readonly menuItemClassName?: string | undefined;
  readonly menuItemIconStyle?: React.CSSProperties | undefined;
  readonly menuItemIconMoreStyle?: React.CSSProperties | undefined;
}) {
  const iconSizeStyle: React.CSSProperties = {
    width: '1.25rem',
    height: '1.25rem',
  };

  const itemRef = useRef<HTMLButtonElement>(null);

  const content = (
    <>
      <Ripple color="var(--color-ripple-button)" />
      {item.icon !== undefined ? (
        <Icon
          name={item.icon}
          style={{
            fill: 'var(--color-tpd)',
            ...iconSizeStyle,
            ...menuItemIconStyle,
          }}
        />
      ) : (
        <div style={iconSizeStyle} />
      )}
      <div className="truncate">{item.title}</div>
      {item.submenu !== undefined ? (
        <Icon
          name="triangleDown"
          style={{
            marginLeft: 'auto',
            width: '1rem',
            height: '1rem',
            transform: 'rotate(-90deg)',
            fill: 'var(--color-tpd)',
            ...menuItemIconMoreStyle,
          }}
        />
      ) : (
        <div className="ml-2 size-4" />
      )}
    </>
  );

  const [triggerBox, setTriggerBox] = useState<DOMRect | null>(null);

  useGranularEffect(
    () => {
      const box = itemRef.current?.getBoundingClientRect() ?? null;

      setTriggerBox(box);
    },
    [rootTriggerBox],
    [],
  );

  const highlighted = compareArrays(path, item.path) === 0;

  return (
    <>
      <button
        ref={itemRef}
        type="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          if (item.submenu === undefined) {
            onClose();
            item.onSelect?.();
          }
        }}
        onMouseEnter={() => setPath(item.path)}
        className={`
          relative w-full flex cursor-pointer items-center gap-2 overflow-hidden rounded-lg border-none p-2 outline-none
          ${highlighted ? 'bg-bse' : ''}
          ${menuItemClassName}
        `}
        data-highlighted={highlighted ? 'true' : undefined}
      >
        {content}
      </button>
      {triggerBox !== null &&
        item.submenu !== undefined &&
        isChildArrayPath(item.path, path) &&
        // We also want the dropdown panels to not overlap with on too small screen size,
        // so we need to ensure they are properly z-indexed.
        createPortal(
          <DropDownMenuPanel
            key={JSON.stringify([triggerBox, rootTriggerBox, item.submenu])}
            onClose={onClose}
            path={path}
            setPath={setPath}
            submenu={item.submenu}
            triggerBox={triggerBox}
            rootTriggerBox={rootTriggerBox}
            dropDownListStyle={dropDownListStyle}
            menuItemClassName={menuItemClassName}
            menuItemIconStyle={menuItemIconStyle}
            menuItemIconMoreStyle={menuItemIconMoreStyle}
          />,
          document.body,
        )}
    </>
  );
}
