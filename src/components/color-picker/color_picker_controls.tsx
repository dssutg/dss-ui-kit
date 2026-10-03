/**
 * The pieces a colour picker is built from: the saturation field, the hue bar, the alpha bar, the
 * pointer each of them drags, and the shared HSVA state.
 *
 * They are private to the picker family — `ColorPicker`, `AlphaColorPicker` and `ColorInput` are the
 * components a consumer uses — so this module holds what would otherwise be duplicated across two
 * files that differ only in which bars they draw.
 *
 * Every bar is a `role="slider"` div that answers to pointer drags and arrow keys, which is what makes
 * the picker operable without a mouse and reachable by keyboard.
 */

import { type JSX, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clamp } from '@/lib/math';
import { equalColorObjects, hsvaToHslString, round } from './color_picker_conversion';
import {
  getArrowKeyInteraction,
  getParentWindow,
  getRelativePosition,
  getTouchId,
  isInvalid,
  isTouch,
  preventDefaultMove,
} from './color_picker_interaction';
import type { AnyColor, ColorModel, HsvaColor, Interaction } from './color_picker_types';

export function formatClassName(names: unknown[]): string {
  return names.filter(Boolean).join(' ');
}

export interface HueBaseProperties {
  readonly className?: string | undefined;
  readonly hue: number;
  readonly onChange: (newHue: { h: number }) => void;
}

export function HueBase({ className, hue, onChange }: HueBaseProperties) {
  const handleMove = (interaction: Interaction) => {
    onChange({ h: 360 * interaction.left });
  };

  const handleKey = (offset: Interaction) => {
    // Hue measured in degrees of the color circle ranging from 0 to 360
    onChange({
      h: clamp(hue + offset.left * 360, 0, 360),
    });
  };

  const nodeClassName = formatClassName(['color-picker-cn__hue', className]);

  return (
    <div className={nodeClassName}>
      <Interactive
        onMove={handleMove}
        onKey={handleKey}
        aria-label="Hue"
        ariaValueNow={round(hue)}
        aria-valuemax="360"
        aria-valuemin="0"
      >
        <Pointer
          className="color-picker-cn__hue-pointer"
          left={hue / 360}
          color={hsvaToHslString({ h: hue, s: 100, v: 100, a: 1 })}
        />
      </Interactive>
    </div>
  );
}

export const Hue = memo(HueBase);
export interface InteractiveBaseProperties {
  readonly onMove: (interaction: Interaction) => void;
  readonly onKey: (offset: Interaction) => void;
  readonly ariaValueNow?: number | undefined;
  readonly children: React.ReactNode;
}

const InteractiveBase = ({ onMove, onKey, ariaValueNow, ...rest }: InteractiveBaseProperties) => {
  const container = useRef<HTMLDivElement>(null);
  const onMoveCallback = useEventCallback<Interaction>(onMove);
  const onKeyCallback = useEventCallback<Interaction>(onKey);
  const touchId = useRef<null | number>(null);
  const hasTouch = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: dependency list intentionally keeps stable callback identity
  const [handleMoveStart, handleKeyDown, toggleDocumentEvents] = useMemo(() => {
    const handleMoveStart = (e: MouseEvent | TouchEvent) => {
      const element = container.current;

      if (!element) {
        return;
      }

      // Prevent text selection
      preventDefaultMove(e);

      if (isInvalid(e, hasTouch.current) || !element) {
        return;
      }

      if (isTouch(e)) {
        hasTouch.current = true;
        touchId.current = getTouchId(e);
      }

      element.focus();
      onMoveCallback(getRelativePosition(element, e, touchId.current));
      toggleDocumentEvents(true);
    };

    const handleMove = (event: MouseEvent | TouchEvent) => {
      // Prevent text selection
      preventDefaultMove(event);

      // If user moves the pointer outside of the window or iframe bounds and release it there,
      // `mouseup`/`touchend` won't be fired. In order to stop the picker from following the cursor
      // after the user has moved the mouse/finger back to the document, we check `event.buttons`
      // and `event.touches`. It allows us to detect that the user is just moving his pointer
      // without pressing it down
      const isDown = isTouch(event) ? event.touches.length > 0 : event.buttons > 0;

      if (isDown && container.current) {
        onMoveCallback(getRelativePosition(container.current, event, touchId.current));
      } else {
        toggleDocumentEvents(false);
      }
    };

    const handleMoveEnd = () => toggleDocumentEvents(false);

    const handleKeyDown = (event: KeyboardEvent) => {
      const interaction = getArrowKeyInteraction(event);

      if (interaction !== null) {
        onKeyCallback(interaction);
      }
    };

    function toggleDocumentEvents(state?: boolean) {
      const touch = hasTouch.current;
      const element = container.current;
      const parentWindow = getParentWindow(element);

      // Add or remove additional pointer event listeners
      const toggleEvent = state ? parentWindow.addEventListener : parentWindow.removeEventListener;

      toggleEvent(touch ? 'touchmove' : 'mousemove', handleMove);
      toggleEvent(touch ? 'touchend' : 'mouseup', handleMoveEnd);
    }

    return [handleMoveStart, handleKeyDown, toggleDocumentEvents];
  }, [onKeyCallback, onMoveCallback]);

  // Remove window event listeners before unmounting
  useEffect(() => toggleDocumentEvents, [toggleDocumentEvents]);

  return (
    <div
      {...rest}
      onTouchStart={handleMoveStart}
      onMouseDown={handleMoveStart}
      className="color-picker-cn__interactive"
      ref={container}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="slider"
      aria-valuenow={ariaValueNow}
    />
  );
};

export const Interactive = memo(InteractiveBase);
export interface PointerProperties {
  readonly className?: string | undefined;
  readonly top?: number | undefined;
  readonly left: number;
  readonly color: string;
}

export const Pointer = ({ className, color, left, top = 0.5 }: PointerProperties): JSX.Element => {
  const nodeClassName = formatClassName(['color-picker-cn__pointer', className]);

  const style = {
    top: `${top * 100}%`,
    left: `${left * 100}%`,
  };

  return (
    <div className={nodeClassName} style={style}>
      <div className="color-picker-cn__pointer-fill" style={{ backgroundColor: color }} />
    </div>
  );
};

export interface SaturationBaseProperties {
  readonly hsva: HsvaColor;
  readonly onChange: (newColor: { s: number; v: number }) => void;
}

const SaturationBase = ({ hsva, onChange }: SaturationBaseProperties) => {
  const handleMove = (interaction: Interaction) => {
    onChange({
      s: interaction.left * 100,
      v: 100 - interaction.top * 100,
    });
  };

  const handleKey = (offset: Interaction) => {
    // Saturation and brightness always fit into [0, 100] range
    onChange({
      s: clamp(hsva.s + offset.left * 100, 0, 100),
      v: clamp(hsva.v - offset.top * 100, 0, 100),
    });
  };

  const containerStyle = {
    backgroundColor: hsvaToHslString({ h: hsva.h, s: 100, v: 100, a: 1 }),
  };

  return (
    <div className="color-picker-cn__saturation" style={containerStyle}>
      <Interactive
        onMove={handleMove}
        onKey={handleKey}
        aria-label="Color"
        aria-valuetext={`Saturation ${round(hsva.s)}%, Brightness ${round(hsva.v)}%`}
      >
        <Pointer
          className="color-picker-cn__saturation-pointer"
          top={1 - hsva.v / 100}
          left={hsva.s / 100}
          color={hsvaToHslString(hsva)}
        />
      </Interactive>
    </div>
  );
};

export const Saturation = memo(SaturationBase);
export function useColorManipulation<T extends AnyColor>(
  colorModel: ColorModel<T>,
  color: T,
  onChange?: (color: T) => void,
): [HsvaColor, (color: Partial<HsvaColor>) => void] {
  // Save onChange callback in the ref for avoiding "useCallback hell"
  const onChangeCallback = useEventCallback<T>(onChange);

  // No matter which color model is used (HEX, RGB(A) or HSL(A)),
  // all internal calculations are based on HSVA model
  const [hsva, updateHsva] = useState<HsvaColor>(() => colorModel.toHsva(color));

  // By using this ref we're able to prevent extra updates
  // and the effects recursion during the color conversion
  const cache = useRef({ color, hsva });

  // Update local HSVA-value if `color` property value is changed,
  // but only if that's not the same color that we just sent to the parent
  useEffect(() => {
    if (!colorModel.equal(color, cache.current.color)) {
      const newHsva = colorModel.toHsva(color);

      cache.current = { hsva: newHsva, color };
      updateHsva(newHsva);
    }
  }, [color, colorModel]);

  // Trigger `onChange` callback only if an updated color is different from cached one;
  // save the new color to the ref to prevent unnecessary updates
  useEffect(() => {
    if (equalColorObjects(hsva, cache.current.hsva)) {
      return;
    }

    const newColor = colorModel.fromHsva(hsva);

    if (colorModel.equal(newColor, cache.current.color)) {
      return;
    }

    cache.current = { hsva, color: newColor };
    onChangeCallback(newColor);
  }, [hsva, colorModel, onChangeCallback]);

  // Merge the current HSVA color object with updated params.
  // For example, when a child component sends `h` or `s` only
  const handleChange = useCallback((parameters: Partial<HsvaColor>) => {
    updateHsva((current) => ({ ...current, ...parameters }));
  }, []);

  return [hsva, handleChange];
}
/**
 * Saves the incoming handler in a ref and returns a stable callback that calls it.
 *
 * The alternative is a `useCallback` in every consumer of a handler that changes every render, which is
 * what this avoids; the cost is that the returned identity never changes.
 */
export function useEventCallback<T>(handler?: (value: T) => void): (value: T) => void {
  const callbackRef = useRef(handler);
  const callback = useRef((value: T) => {
    callbackRef.current?.(value);
  });

  callbackRef.current = handler;

  return callback.current;
}
