import { useEffect, useState } from 'react';
import { Popover } from '@/components/overlays/Popover';
import { useDebounce } from '@/lib/use_debounce';
import { HexAlphaColorPicker } from './HexAlphaColorPicker';

/**
 * A colour swatch that opens a hex-with-alpha picker in a popover, and reports the colour 500ms after
 * the last change.
 *
 * The debounce is the point of this component rather than a detail: dragging across a colour field
 * fires a change per pointer move, and a caller that re-rendered a whole panel per change could not
 * drag at all. The delay is why `color` is also kept in step with an external change.
 */
export function HexAlphaColorPickerPopover({
  trigger,
  color,
  onChange,
}: {
  readonly trigger: React.ReactNode;
  readonly color: string;
  readonly onChange: (color: string) => void;
}) {
  const [hotColor, setHotColor] = useState(color);

  const [open, setOpen] = useState(false);

  useDebounce(() => onChange(hotColor), 500, [hotColor]);

  useEffect(() => setHotColor(color), [color]);

  return (
    <Popover open={open} onOpenChange={setOpen} hasBackDrop trigger={trigger}>
      <div>
        <HexAlphaColorPicker color={hotColor} onChange={setHotColor} />
      </div>
    </Popover>
  );
}
