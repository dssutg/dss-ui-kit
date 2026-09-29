import { contacts } from "@/contact";
import { getResponsiveSize } from "@/lib/dom";
import { useWindowSize } from "@/lib/use_window_size";
import { useLocale } from "@/locale";
import { Icon } from "@/ui/icon";

export function Logo({
	scale = 1,
	imageScale = 1,
}: {
	readonly scale?: number;
	readonly imageScale?: number;
}) {
	const { t } = useLocale();

	const size = useWindowSize();

	const minDesktopWidth = 600;

	return (
		<a
			target="_blank"
			href={`https://${contacts.companySite}`}
			className="flex max-w-full cursor-pointer select-none items-center"
			style={{ textDecoration: "none" }}
			rel="noopener"
		>
			<Icon
				name="logo"
				style={{
					maxWidth: "100%",
					fill: "var(--color-brand)",
					width: `${(size.width >= minDesktopWidth ? 18.75 : 10) * scale * imageScale}rem`,
					height: `${(size.width >= minDesktopWidth ? 15 : 8) * scale * imageScale}rem`,
				}}
			/>
			<div
				className="max-w-full select-none font-bold italic text-[var(--color-brand)]"
				style={{
					fontSize: `${getResponsiveSize(1, 10 * scale, 4, size.width, minDesktopWidth)}rem`,
				}}
			>
				{t("developerName")}
			</div>
		</a>
	);
}
