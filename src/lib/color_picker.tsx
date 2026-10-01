import { type JSX, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { clamp } from '@/lib/math';

interface AlphaColorPickerProperties<T extends AnyColor>
  extends Partial<ColorPickerBaseProperties<T>> {
  readonly colorModel: ColorModel<T>;
}

function AlphaColorPicker<T extends AnyColor>({
  className,
  colorModel,
  color = colorModel.defaultColor,
  onChange,
  ...rest
}: AlphaColorPickerProperties<T>): JSX.Element {
  const nodeRef = useRef<HTMLDivElement>(null);

  const [hsva, updateHsva] = useColorManipulation<T>(colorModel, color, onChange);

  const nodeClassName = formatClassName(['color-picker-cn', className]);

  return (
    <div {...rest} ref={nodeRef} className={nodeClassName}>
      <Saturation hsva={hsva} onChange={updateHsva} />
      <Hue hue={hsva.h} onChange={updateHsva} />
      <Alpha hsva={hsva} onChange={updateHsva} className="color-picker-cn__last-control" />
    </div>
  );
}

interface AlphaProperties {
  readonly className?: string | undefined;
  readonly hsva: HsvaColor;
  readonly onChange: (newAlpha: { a: number }) => void;
}

function Alpha({ className, hsva, onChange }: AlphaProperties): JSX.Element {
  const handleMove = (interaction: Interaction) => {
    onChange({ a: interaction.left });
  };

  const handleKey = (offset: Interaction) => {
    // Alpha always fit into [0, 1] range
    onChange({ a: clamp(hsva.a + offset.left, 0, 1) });
  };

  // We use `Object.assign` instead of the spread operator
  // to prevent adding the polyfill (about 150 bytes gzipped)
  const colorFrom = hsvaToHslaString({ ...hsva, a: 0 });
  const colorTo = hsvaToHslaString({ ...hsva, a: 1 });

  const gradientStyle = {
    backgroundImage: `linear-gradient(90deg, ${colorFrom}, ${colorTo})`,
  };

  const nodeClassName = formatClassName(['color-picker-cn__alpha', className]);
  const ariaValue = round(hsva.a * 100);

  return (
    <div className={nodeClassName}>
      <div className="color-picker-cn__alpha-gradient" style={gradientStyle} />
      <Interactive
        onMove={handleMove}
        onKey={handleKey}
        aria-label="Alpha"
        aria-valuetext={`${ariaValue}%`}
        ariaValueNow={ariaValue}
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <Pointer
          className="color-picker-cn__alpha-pointer"
          left={hsva.a}
          color={hsvaToHslaString(hsva)}
        />
      </Interactive>
    </div>
  );
}

interface ColorInputProperties extends ColorInputBaseProperties {
  /** Blocks typing invalid characters and limits string length */
  readonly escape: (value: string) => string;

  /** Checks that value is valid color string */
  readonly validate: (value: string) => boolean;

  /** Processes value before displaying it in the input */
  readonly format?: ((value: string) => string) | undefined;

  /** Processes value before sending it in `onChange` */
  readonly process?: ((value: string) => string) | undefined;
}

function ColorInput(properties: ColorInputProperties): JSX.Element {
  const {
    color = '',
    onChange,
    onBlur,
    escape: escapeLocal,
    validate,
    format,
    process,
    ...rest
  } = properties;
  const [value, setValue] = useState(() => escapeLocal(color));
  const onChangeCallback = useEventCallback<string>(onChange);
  const onBlurCallback = useEventCallback<React.FocusEvent<HTMLInputElement>>(onBlur);

  // Trigger `onChange` handler only if the input value is a valid color
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = escapeLocal(e.currentTarget.value);

      setValue(inputValue);
      if (validate(inputValue)) {
        onChangeCallback(process ? process(inputValue) : inputValue);
      }
    },
    [escapeLocal, process, validate, onChangeCallback],
  );

  // Take the color from props if the last typed color (in local state) is not valid
  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      if (!validate(e.currentTarget.value)) {
        setValue(escapeLocal(color));
      }
      onBlurCallback(e);
    },
    [color, escapeLocal, validate, onBlurCallback],
  );

  // Update the local state when `color` property value is changed
  useEffect(() => {
    setValue(escapeLocal(color));
  }, [color, escapeLocal]);

  return (
    <input
      {...rest}
      value={format ? format(value) : value}
      spellcheck={false} // The element should not be checked for spelling errors
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}

interface ColorPickerProperties<T extends AnyColor> extends Partial<ColorPickerBaseProperties<T>> {
  readonly colorModel: ColorModel<T>;
}

function ColorPicker<T extends AnyColor>({
  className,
  colorModel,
  color = colorModel.defaultColor,
  onChange,
  ...rest
}: ColorPickerProperties<T>): JSX.Element {
  const nodeRef = useRef<HTMLDivElement>(null);

  const [hsva, updateHsva] = useColorManipulation<T>(colorModel, color, onChange);

  const nodeClassName = formatClassName(['color-picker-cn', className]);

  return (
    <div {...rest} ref={nodeRef} className={nodeClassName}>
      <Saturation hsva={hsva} onChange={updateHsva} />
      <Hue hue={hsva.h} onChange={updateHsva} className="color-picker-cn__last-control" />
    </div>
  );
}

function equalColorObjects(first: ObjectColor, second: ObjectColor): boolean {
  if (first === second) {
    return true;
  }

  for (const property in first) {
    // The following allows for a type-safe calling of this function (first & second have to be HSL, HSV, or RGB)
    // with type-unsafe iterating over object keys. TS does not allow this without an index (`[key: string]: number`)
    // on an object to define how iteration is normally done. To ensure extra keys are not allowed on our types,
    // we must cast our object to unknown (as RGB demands `r` be a key, while `Record<string, x>` does not care if
    // there is or not), and then as a type TS can iterate over.
    if (
      (first as unknown as Record<string, number>)[property] !==
      (second as unknown as Record<string, number>)[property]
    ) {
      return false;
    }
  }

  return true;
}

function equalColorString(first: string, second: string): boolean {
  return first.replace(/\s/g, '') === second.replace(/\s/g, '');
}

function equalHex(first: string, second: string): boolean {
  if (first.toLowerCase() === second.toLowerCase()) {
    return true;
  }

  // To compare colors like `#FFF` and `ffffff` we convert them into RGB objects
  return equalColorObjects(hexToRgba(first), hexToRgba(second));
}

// Valid CSS <angle> units.
// https://developer.mozilla.org/en-US/docs/Web/CSS/angle
const angleUnits: Record<string, number> = {
  grad: 360 / 400,
  turn: 360,
  rad: 360 / (Math.PI * 2),
};

function hexToHsva(hex: string): HsvaColor {
  return rgbaToHsva(hexToRgba(hex));
}

function hexToRgba(hex: string): RgbaColor {
  const digits = hex.startsWith('#') ? hex.slice(1) : hex;

  if (digits.length < 6) {
    // Shorthand: `#abc` is `#aabbcc`, so each digit is doubled before it is read. A shorter string
    // than that is not a colour at all, and `charAt` reports the absence as an empty string, which
    // `parseInt` turns into 0 rather than into a crash.
    const doubled = (index: number) => {
      const digit = digits.charAt(index);

      return parseInt(digit + digit, 16);
    };

    return {
      r: doubled(0),
      g: doubled(1),
      b: doubled(2),
      a: digits.length === 4 ? round(doubled(3) / 255, 2) : 1,
    };
  }

  return {
    r: parseInt(digits.slice(0, 2), 16),
    g: parseInt(digits.slice(2, 4), 16),
    b: parseInt(digits.slice(4, 6), 16),
    a: digits.length === 8 ? round(parseInt(digits.slice(6, 8), 16) / 255, 2) : 1,
  };
}

function parseHue(value: string, unit?: string): number {
  return Number(value) * (angleUnits[unit ?? 'deg'] || 1);
}

function hslaStringToHsva(hslString: string): HsvaColor {
  const matcher =
    /hsla?\(?\s*(-?\d*\.?\d+)(deg|rad|grad|turn)?[\s,]+(-?\d*\.?\d+)%?[\s,]+(-?\d*\.?\d+)%?,?\s*[\s/]*(-?\d*\.?\d+)?(%)?\s*\)?/i;
  const match = matcher.exec(hslString);

  if (!match) {
    return { h: 0, s: 0, v: 0, a: 1 };
  }

  return hslaToHsva({
    h: parseHue(match[1] ?? '0', match[2]),
    s: Number(match[3]),
    l: Number(match[4]),
    a: match[5] === undefined ? 1 : Number(match[5]) / (match[6] ? 100 : 1),
  });
}

function hslaToHsva({ h, s, l, a }: HslaColor): HsvaColor {
  s *= (l < 50 ? l : 100 - l) / 100;

  return {
    h,
    s: s > 0 ? ((2 * s) / (l + s)) * 100 : 0,
    v: l + s,
    a,
  };
}

function hsvaToHex(hsva: HsvaColor): string {
  return rgbaToHex(hsvaToRgba(hsva));
}

function hsvaToHsla({ h, s, v, a }: HsvaColor): HslaColor {
  const hh = ((200 - s) * v) / 100;

  return {
    h: round(h),
    s: round(hh > 0 && hh < 200 ? ((s * v) / 100 / (hh <= 100 ? hh : 200 - hh)) * 100 : 0),
    l: round(hh / 2),
    a: round(a, 2),
  };
}

function hsvaToHslString(hsva: HsvaColor): string {
  const { h, s, l } = hsvaToHsla(hsva);

  return `hsl(${h}, ${s}%, ${l}%)`;
}

function hsvaToHslaString(hsva: HsvaColor): string {
  const { h, s, l, a } = hsvaToHsla(hsva);

  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

function hsvaToRgba({ h, s, v, a }: HsvaColor): RgbaColor {
  h = (h / 360) * 6;
  s = s / 100;
  v = v / 100;

  const hh = Math.floor(h);
  const b = v * (1 - s);
  const c = v * (1 - (h - hh) * s);
  const d = v * (1 - (1 - h + hh) * s);
  // Six sectors, one per 60 degrees of hue, and each channel takes its value from the sector's own
  // column. The sector is wrapped into range because a hue of 360 or -30 is the same colour as one
  // inside the circle, and picking a sector outside the table would have no value to read.
  const sector = ((hh % 6) + 6) % 6;

  const channel = (values: readonly number[]) => round((values[sector] ?? 0) * 255);

  return {
    r: channel([v, c, b, b, d, v]),
    g: channel([d, v, v, c, b, b]),
    b: channel([b, b, d, v, v, c]),
    a: round(a, 2),
  };
}

function hsvaToRgbaString(hsva: HsvaColor): string {
  const { r, g, b, a } = hsvaToRgba(hsva);

  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function rgbaStringToHsva(rgbaString: string): HsvaColor {
  const matcher =
    /rgba?\(?\s*(-?\d*\.?\d+)(%)?[\s,]+(-?\d*\.?\d+)(%)?[\s,]+(-?\d*\.?\d+)(%)?,?\s*[\s/]*(-?\d*\.?\d+)?(%)?\s*\)?/i;
  const match = matcher.exec(rgbaString);

  if (!match) {
    return { h: 0, s: 0, v: 0, a: 1 };
  }

  return rgbaToHsva({
    r: Number(match[1]) / (match[2] ? 100 / 255 : 1),
    g: Number(match[3]) / (match[4] ? 100 / 255 : 1),
    b: Number(match[5]) / (match[6] ? 100 / 255 : 1),
    a: match[7] === undefined ? 1 : Number(match[7]) / (match[8] ? 100 : 1),
  });
}

function format(number: number) {
  const hex = number.toString(16);

  return hex.length < 2 ? `0${hex}` : hex;
}

function rgbaToHex({ r, g, b, a }: RgbaColor): string {
  const alphaHex = a < 1 ? format(round(a * 255)) : '';

  return `#${format(r)}${format(g)}${format(b)}${alphaHex}`;
}

function rgbaToHsva({ r, g, b, a }: RgbaColor): HsvaColor {
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);

  // Which of the six hue sectors the colour falls in, named after the channel that is largest.
  let sector = 0;
  if (delta !== 0) {
    if (max === r) {
      sector = (g - b) / delta;
    } else if (max === g) {
      sector = 2 + (b - r) / delta;
    } else {
      sector = 4 + (r - g) / delta;
    }
  }
  const hh = sector;

  return {
    h: round(60 * (hh < 0 ? hh + 6 : hh)),
    s: round(max ? (delta / max) * 100 : 0),
    v: round((max / 255) * 100),
    a,
  };
}

function formatClassName(names: unknown[]): string {
  return names.filter(Boolean).join(' ');
}

const colorModelHexAlphaColorPicker: ColorModel<string> = {
  defaultColor: '0001',
  toHsva: hexToHsva,
  fromHsva: hsvaToHex,
  equal: equalHex,
};

export function HexAlphaColorPicker(
  properties: Partial<ColorPickerBaseProperties<string>>,
): JSX.Element {
  return <AlphaColorPicker {...properties} colorModel={colorModelHexAlphaColorPicker} />;
}

interface HexColorInputProperties extends ColorInputBaseProperties {
  /** Enables `#` prefix displaying */
  readonly prefixed?: boolean | undefined;

  /** Allows `#rgba` and `#rrggbbaa` color formats */
  readonly alpha?: boolean | undefined;
}

/** Adds "#" symbol to the beginning of the string */
const prefixHexColorInput = (value: string) => `#${value}`;

export function HexColorInput(properties: HexColorInputProperties): JSX.Element {
  const { prefixed, alpha, ...rest } = properties;

  /** Escapes all non-hexadecimal characters including "#" */
  const escapeLocal = useCallback(
    (value: string) => value.replace(/([^\da-f]+)/gi, '').slice(0, Math.max(0, alpha ? 8 : 6)),
    [alpha],
  );

  /** Validates hexadecimal strings */
  const validate = useCallback((value: string) => validHex(value, alpha), [alpha]);

  return (
    <ColorInput
      {...rest}
      escape={escapeLocal}
      format={prefixed ? prefixHexColorInput : undefined}
      process={prefixHexColorInput}
      validate={validate}
    />
  );
}

const colorModelHexColorPicker: ColorModel<string> = {
  defaultColor: '000',
  toHsva: hexToHsva,
  fromHsva: ({ h, s, v }) => hsvaToHex({ h, s, v, a: 1 }),
  equal: equalHex,
};

export function HexColorPicker(
  properties: Partial<ColorPickerBaseProperties<string>>,
): JSX.Element {
  return <ColorPicker {...properties} colorModel={colorModelHexColorPicker} />;
}

const colorModelHslaColorPicker: ColorModel<HslaColor> = {
  defaultColor: { h: 0, s: 0, l: 0, a: 1 },
  toHsva: hslaToHsva,
  fromHsva: hsvaToHsla,
  equal: equalColorObjects,
};

export function HslaColorPicker(properties: Partial<ColorPickerBaseProperties<HslaColor>>) {
  return <AlphaColorPicker {...properties} colorModel={colorModelHslaColorPicker} />;
}

const colorModelHslaStringColorPicker: ColorModel<string> = {
  defaultColor: 'hsla(0, 0%, 0%, 1)',
  toHsva: hslaStringToHsva,
  fromHsva: hsvaToHslaString,
  equal: equalColorString,
};

export function HslaStringColorPicker(
  properties: Partial<ColorPickerBaseProperties<string>>,
): JSX.Element {
  return <AlphaColorPicker {...properties} colorModel={colorModelHslaStringColorPicker} />;
}

interface HueBaseProperties {
  readonly className?: string | undefined;
  readonly hue: number;
  readonly onChange: (newHue: { h: number }) => void;
}

function HueBase({ className, hue, onChange }: HueBaseProperties) {
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

const Hue = memo(HueBase);

interface Interaction {
  left: number;
  top: number;
}

/** The position reported for a pointer event that carries no usable coordinates. */
const NO_INTERACTION: Interaction = { left: 0, top: 0 };

// Check if an event was triggered by touch
function isTouch(event: MouseEvent | TouchEvent): event is TouchEvent {
  return 'touches' in event;
}

/**
 * The touch carrying `touchId`, or the first touch when none does.
 *
 * A drag can start on one finger and continue with another still resting on the panel, so the touch
 * that began it is tracked by identifier rather than assumed to still be the one moving. Returning
 * `null` when the list is empty lets the caller skip a move rather than read a coordinate from
 * nothing; every move handler here already has to tolerate a touch ending under it.
 */
function getTouchPoint(touches: TouchList, touchId: null | number): Touch | null {
  for (const touch of touches) {
    if (touch.identifier === touchId) {
      return touch;
    }
  }

  return touches.item(0);
}

/** How far one arrow-key press moves the handle, as a fraction of the handle's track. */
const ARROW_KEY_DELTA = 0.05;

/**
 * How far an arrow key moves the handle along one axis: `negativeKeyCode` moves it back, the
 * positive one forward, and any other key moves it not at all.
 */
function getAxisDelta(keyCode: number, negativeKeyCode: number, positiveKeyCode: number): number {
  if (keyCode === positiveKeyCode) {
    return ARROW_KEY_DELTA;
  }

  if (keyCode === negativeKeyCode) {
    return -ARROW_KEY_DELTA;
  }

  return 0;
}

// Finds the proper window object to fix iframe embedding issues
function getParentWindow(node?: HTMLDivElement | null): Window {
  return node?.ownerDocument.defaultView || self;
}

// Returns a relative position of the pointer inside the node's bounding box
const getRelativePosition = (
  node: HTMLDivElement,
  event: MouseEvent | TouchEvent,
  touchId: null | number,
): Interaction => {
  const rect = node.getBoundingClientRect();

  // Get user's pointer position from `touches` array if it's a `TouchEvent`
  const pointer = isTouch(event) ? getTouchPoint(event.touches, touchId) : event;

  // A move with no touch to read is a touch that ended between events. There is no position to
  // report, and returning the last one would drag the handle to where the finger left off.
  if (pointer === null) {
    return NO_INTERACTION;
  }

  const parent = getParentWindow(node);

  return {
    left: clamp((pointer.pageX - (rect.left + parent.scrollX)) / rect.width, 0, 1),
    top: clamp((pointer.pageY - (rect.top + parent.scrollY)) / rect.height, 0, 1),
  };
};

// Browsers introduced an intervention, making touch events passive by default.
// This workaround removes `preventDefault` call from the touch handlers.
// https://github.com/facebook/react/issues/19651
const preventDefaultMove = (event: MouseEvent | TouchEvent): void => {
  !isTouch(event) && event.preventDefault();
};

// Prevent mobile browsers from handling mouse events (conflicting with touch ones).
// If we detected a touch interaction before, we prefer reacting to touch events only.
const isInvalid = (event: MouseEvent | TouchEvent, hasTouch: boolean): boolean => {
  return hasTouch && !isTouch(event);
};

interface InteractiveBaseProperties {
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

        const changedTouches = e.changedTouches || [];

        const changedTouch = changedTouches.item(0);

        if (changedTouch !== null) {
          touchId.current = changedTouch.identifier;
        }
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
      const keyCode = event.which || event.keyCode;

      // Ignore all keys except arrow ones
      if (keyCode < 37 || keyCode > 40) {
        return;
      }
      // Do not scroll page by arrow keys when document is focused on the element
      event.preventDefault();
      // Send a relative offset to the parent component. Key codes (37 left, 38 up, 39 right,
      // 40 down) are used instead of key names ('ArrowRight', 'ArrowDown', and so on) to reduce
      // the size of the library.
      const leftDelta = getAxisDelta(keyCode, 37, 39);
      const topDelta = getAxisDelta(keyCode, 38, 40);
      onKeyCallback({
        left: leftDelta,
        top: topDelta,
      });
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

const Interactive = memo(InteractiveBase);

interface PointerProperties {
  readonly className?: string | undefined;
  readonly top?: number | undefined;
  readonly left: number;
  readonly color: string;
}

const Pointer = ({ className, color, left, top = 0.5 }: PointerProperties): JSX.Element => {
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

const colorModelRgbaColorPicker: ColorModel<RgbaColor> = {
  defaultColor: { r: 0, g: 0, b: 0, a: 1 },
  toHsva: rgbaToHsva,
  fromHsva: hsvaToRgba,
  equal: equalColorObjects,
};

export function RgbaColorPicker(properties: Partial<ColorPickerBaseProperties<RgbaColor>>) {
  return <AlphaColorPicker {...properties} colorModel={colorModelRgbaColorPicker} />;
}

const colorModelRgbaStringColorPicker: ColorModel<string> = {
  defaultColor: 'rgba(0, 0, 0, 1)',
  toHsva: rgbaStringToHsva,
  fromHsva: hsvaToRgbaString,
  equal: equalColorString,
};

export function RgbaStringColorPicker(properties: Partial<ColorPickerBaseProperties<string>>) {
  return <AlphaColorPicker {...properties} colorModel={colorModelRgbaStringColorPicker} />;
}

const round = (number: number, digits = 0, base = 10 ** digits): number => {
  return Math.round(base * number) / base;
};

interface SaturationBaseProperties {
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

const Saturation = memo(SaturationBase);

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

interface RgbaColor extends RgbColor {
  a: number;
}

interface HslColor {
  h: number;
  s: number;
  l: number;
}

interface HslaColor extends HslColor {
  a: number;
}

interface HsvColor {
  h: number;
  s: number;
  v: number;
}

interface HsvaColor extends HsvColor {
  a: number;
}

type ObjectColor = RgbColor | HslColor | HsvColor | RgbaColor | HslaColor | HsvaColor;

type AnyColor = string | ObjectColor;

interface ColorModel<T extends AnyColor> {
  defaultColor: T;
  toHsva: (defaultColor: T) => HsvaColor;
  fromHsva: (hsva: HsvaColor) => T;
  equal: (first: T, second: T) => boolean;
}

type ColorPickerHTMLAttributes = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'color' | 'onChange' | 'onChangeCapture'
>;

interface ColorPickerBaseProperties<T extends AnyColor> extends ColorPickerHTMLAttributes {
  color: T;
  onChange: (newColor: T) => void;
}

type ColorInputHTMLAttributes = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value'
>;

interface ColorInputBaseProperties extends ColorInputHTMLAttributes {
  color?: string | undefined;
  onChange?: (newColor: string) => void;
}

function useColorManipulation<T extends AnyColor>(
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

// Saves incoming handler to the ref in order to avoid "useCallback hell"
function useEventCallback<T>(handler?: (value: T) => void): (value: T) => void {
  const callbackRef = useRef(handler);
  const callback = useRef((value: T) => {
    callbackRef.current?.(value);
  });

  callbackRef.current = handler;

  return callback.current;
}

function validHex(value: string, alpha?: boolean): boolean {
  const match = /^#?([\da-f]{3,8})$/i.exec(value);
  // No match means no capture, which is the same as a length no format accepts.
  const length = match?.[1]?.length ?? 0;

  return (
    // '#rgb' format
    length === 3 ||
    // '#rrggbb' format
    length === 6 ||
    // '#rgba' format
    (Boolean(alpha) && length === 4) ||
    // '#rrggbbaa' format
    (Boolean(alpha) && length === 8)
  );
}
