import { createPortal, useCallback, useRef, useState } from 'react';
import { areDOMRectsEqual } from '@/lib/dom';
import { clamp } from '@/lib/math';
import { useEventListener } from '@/lib/use_event_listener';
import { useGranularEffect } from '@/lib/use_granular_effect';
import { useInterval } from '@/lib/use_interval';
import { useWindowSize } from '@/lib/use_window_size';

export function Popover({
  open,
  onOpenChange,
  trigger,
  hasBackDrop,
  backDropStyle,
  forceMount = false,
  noAutofocusToPanel = false,
  popoverStyle,
  popoverClassName,
  children,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly trigger?: React.ReactNode | undefined;
  readonly hasBackDrop?: boolean | undefined;
  readonly backDropStyle?: React.CSSProperties | undefined;
  readonly forceMount?: boolean | undefined;
  readonly noAutofocusToPanel?: boolean | undefined;
  readonly popoverStyle?: React.CSSProperties | undefined;
  readonly popoverClassName?: string | undefined;
  readonly children?: React.ReactNode | undefined;
}) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useWindowSize();

  useEventListener('keydown', (event: KeyboardEvent) => {
    if (open && event.code === 'Escape') {
      event.preventDefault();
      onOpenChange(false);
      (triggerRef.current?.childNodes[0] as HTMLElement | undefined)?.focus();
    }
  });

  const [rootTriggerBox, setRootTriggerBox] = useState<DOMRect | null>(null);

  const getTriggerBox = useCallback(() => {
    return (
      (triggerRef.current?.childNodes?.[0] as HTMLElement | undefined)?.getBoundingClientRect() ??
      null
    );
  }, []);

  useGranularEffect(
    () => {
      setRootTriggerBox(getTriggerBox());
    },
    [],
    [getTriggerBox],
  );

  useGranularEffect(
    () => {
      const trigger = triggerRef.current;

      if (trigger === null) {
        return undefined;
      }

      function updateRootTriggerBox() {
        setRootTriggerBox(getTriggerBox());
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
    },
    [],
    [getTriggerBox],
  );

  useInterval(() => {
    if (triggerRef.current === null) {
      return;
    }

    const box = getTriggerBox()!;

    if (rootTriggerBox !== null && areDOMRectsEqual(rootTriggerBox, box)) {
      return;
    }

    setRootTriggerBox(box);
  }, 500);

  return (
    <>
      <div
        ref={triggerRef}
        tabIndex={0}
        style={{ display: 'contents' }}
        onClick={() => onOpenChange(!open)}
        onKeyDown={(e) => {
          if (e.code === 'Space') {
            e.preventDefault();
            onOpenChange(!open);
          }
        }}
      >
        {trigger}
      </div>
      {(open || forceMount) &&
        createPortal(
          <div className="fixed top-0 left-0" style={{ display: open ? 'block' : 'hidden' }}>
            {hasBackDrop && (
              <div
                className="fixed top-0 left-0 w-screen h-screen bg-black opacity-0"
                style={backDropStyle}
                onClick={() => onOpenChange(false)}
              />
            )}
            <PopoverPanel
              panelRef={panelRef}
              rootTriggerBox={rootTriggerBox}
              noAutofocusToPanel={noAutofocusToPanel}
              className={popoverClassName}
              style={popoverStyle}
            >
              {children}
            </PopoverPanel>
          </div>,
          document.body,
        )}
    </>
  );
}

function PopoverPanel({
  panelRef,
  rootTriggerBox,
  noAutofocusToPanel,
  className,
  style,
  children,
}: {
  readonly panelRef: React.MutableRefObject<HTMLDivElement | null>;
  readonly rootTriggerBox: DOMRect | null;
  readonly noAutofocusToPanel: boolean;
  readonly className?: string | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly children?: React.ReactNode | undefined;
}) {
  const [panelPosX, setPanelPosX] = useState<number | null>(null);
  const [panelPosY, setPanelPosY] = useState<number | null>(null);

  const size = useWindowSize();

  const updatePos = useCallback(() => {
    if (rootTriggerBox === null || panelRef.current === null) {
      return;
    }

    const listBox = panelRef.current.getBoundingClientRect();

    const maxX = window.innerWidth - listBox.width;
    const maxY = window.innerHeight - listBox.height;

    const x = clamp(rootTriggerBox.x, 0, maxX);
    const y = clamp(rootTriggerBox.bottom + 3, 0, maxY);

    if (panelPosX === null || panelPosY === null || x !== panelPosX || y !== panelPosY) {
      setPanelPosX(x);
      setPanelPosY(y);
    }
  }, [rootTriggerBox, panelPosX, panelPosY, panelRef.current]);

  useGranularEffect(
    () => {
      updatePos();
    },
    [rootTriggerBox, size.width, size.height],
    [updatePos],
  );

  useGranularEffect(
    () => {
      const resizeObserver = new ResizeObserver(updatePos);
      const mutationObserver = new MutationObserver(updatePos);

      if (panelRef.current) {
        resizeObserver.observe(panelRef.current);
        mutationObserver.observe(panelRef.current, {
          childList: true,
        });
      }

      updatePos();

      if (!noAutofocusToPanel) {
        panelRef.current?.focus();
      }

      return () => {
        if (panelRef.current) {
          resizeObserver.unobserve(panelRef.current);
          mutationObserver.disconnect();
        }
      };
    },
    [],
    [updatePos, noAutofocusToPanel],
  );

  useInterval(() => {
    updatePos();
  }, 500);

  return (
    <div
      ref={panelRef}
      tabIndex={0}
      className={`
        fixed top-0 left-0 shrink-0
        ${panelPosX === null || panelPosY === null ? 'pointer-events-none opacity-0' : ''}
        ${className}
      `}
      style={{
        top: panelPosY ?? 0,
        left: panelPosX ?? 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
