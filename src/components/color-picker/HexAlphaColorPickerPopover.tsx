import { useEffect, useState } from 'react';
import { Popover } from '@/components/overlays/Popover';
import { useDebounce } from '@/lib/use_debounce';
import { HexAlphaColorPicker } from './HexAlphaColorPicker';

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
