// SPDX-License-Identifier: MIT
// A panel anchored to its trigger, closed from outside or by escape.

import { createPortal, useCallback, useRef, useState } from 'react';
import { useLocale } from '@/locale';
import { cn } from '@/util/cn';
import { areDOMRectsEqual } from '@/util/dom';
import { useEventListener } from '@/util/hooks/use_event_listener';
import { useGranularEffect } from '@/util/hooks/use_granular_effect';
import { useInterval } from '@/util/hooks/use_interval';
import { useWindowSize } from '@/util/hooks/use_window_size';
import { clamp } from '@/util/math';

/**
 * A panel anchored to a trigger, closed by clicking outside or pressing escape.
 *
 * Two details are props because they are decisions a caller has to make. `hasBackDrop` says whether
 * the popover is modal — a picker that must be dismissed before anything else happens needs one, and
 * a tooltip-shaped panel does not. `noAutofocusToPanel` suppresses the focus move, which is what a
 * popover holding a text field needs: focusing the panel would leave the field the caller came to
 * type in un-focused.
 */
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
}): React.JSX.Element {
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useWindowSize();

  useEventListener('keydown', (event: KeyboardEvent) => {
    if (open && event.code === 'Escape') {
      event.preventDefault();
      onOpenChange(false);

      const firstChild = triggerRef.current?.firstElementChild;

      // The trigger holds a control, so the element to give focus back to is a real one; a trigger
      // of plain text has no element to receive focus and nothing else needs doing.
      if (firstChild instanceof HTMLElement) {
        firstChild.focus();
      }
    }
  });

  const { t } = useLocale();

  const [rootTriggerBox, setRootTriggerBox] = useState<DOMRect | null>(null);

  const getTriggerBox = useCallback(() => {
    return triggerRef.current?.firstElementChild?.getBoundingClientRect() ?? null;
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

      // The trigger is there for as long as this effect is: the ref is attached before mount
      // effects run and detached only after the cleanups below have.
      // v8 ignore next
      if (trigger === null) {
        return;
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
    // The trigger is there for as long as this interval is: unmounting clears both together.
    // v8 ignore next
    if (triggerRef.current === null) {
      return;
    }

    const box = getTriggerBox();

    if (box === null) {
      return;
    }

    if (rootTriggerBox !== null && areDOMRectsEqual(rootTriggerBox, box)) {
      return;
    }

    setRootTriggerBox(box);
  }, 500);

  return (
    <>
      {/* biome-ignore lint/a11y/useSemanticElements: this wrapper cannot be a <button>. The trigger is whatever the caller passed in and it is usually already one, so a real <button> here would nest a button inside a button. The wrapper carries the button semantics instead. */}
      <div
        ref={triggerRef}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        style={{ display: 'contents' }}
        onClick={() => onOpenChange(!open)}
        onKeyDown={(e) => {
          if (e.code !== 'Space' && e.key !== 'Enter') {
            return;
          }

          e.preventDefault();
          onOpenChange(!open);
        }}
      >
        {trigger}
      </div>
      {(open || forceMount) &&
        createPortal(
          // The backdrop is a button, because clicking it closes the popover and a keyboard user
          // needs the same. `opacity-0` keeps it in the accessibility tree.
          <div className="fixed top-0 left-0" style={{ display: open ? 'block' : 'hidden' }}>
            {hasBackDrop && (
              <button
                type="button"
                aria-label={t('Modal.close')}
                className="fixed top-0 left-0 h-screen w-screen cursor-default border-none bg-black p-0 opacity-0"
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

      // The panel is attached by the time mount effects run, which is what this effect observes.
      // v8 ignore next
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
        // The panel is still attached here: Preact runs the unmount cleanups before it detaches
        // refs, so the observers can always be told to stop.
        // v8 ignore next
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
    // A dialog: it is the thing that opened. `tabIndex={-1}` makes it focusable by the effect above
    // without putting it in the tab order, which is what a dialog container wants.
    <div
      ref={panelRef}
      role="dialog"
      tabIndex={-1}
      className={cn(
        'fixed top-0 left-0 shrink-0',
        (panelPosX === null || panelPosY === null) && 'pointer-events-none opacity-0',
        className,
      )}
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
