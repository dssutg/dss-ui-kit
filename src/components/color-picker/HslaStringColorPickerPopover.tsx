import { useEffect, useState } from 'react';
import { Popover } from '@/components/overlays/Popover';
import { useDebounce } from '@/util/hooks/use_debounce';
import { HslaStringColorPicker } from './HslaStringColorPicker';

/**
 * A colour swatch that opens an `hsla()` picker in a popover, reporting the colour once the operator
 * stops changing it.
 *
 * See {@link HexAlphaColorPickerPopover}: the picker is the same and the only difference is the
 * notation the colour is reported in.
 */
export function HslaStringColorPickerPopover({
  trigger,
  color,
  onChange,
}: {
  readonly trigger: React.ReactNode;
  readonly color: string;
  readonly onChange: (color: string) => void;
}): React.JSX.Element {
  const [hotColor, setHotColor] = useState(color);

  const [open, setOpen] = useState(false);

  useDebounce(
    () => {
      onChange(hotColor);
    },
    500,
    [hotColor],
  );

  useEffect(() => setHotColor(color), [color]);

  return (
    <Popover open={open} onOpenChange={setOpen} hasBackDrop trigger={trigger}>
      <div>
        <HslaStringColorPicker color={hotColor} onChange={setHotColor} />
      </div>
    </Popover>
  );
}
