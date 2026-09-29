import { useEffect, useState } from "react";
import { HexAlphaColorPicker, HslaStringColorPicker } from "@/lib/color_picker";
import { useDebounce } from "@/lib/use_debounce";
import { Popover } from "./popover";

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

export function HslaStringColorPickerPopover({
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
