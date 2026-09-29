import { type MouseEventHandler, useCallback, useRef, useState } from "react";
import { copyToClipboard } from "@/lib/dom";
import { wrapIndex } from "@/lib/math";
import { useEventListener } from "@/lib/use_event_listener";
import { useLocale } from "@/locale";
import { routeTo } from "@/routing";
import { FeedbackTooltip, showFeedbackTooltip } from "./feedback_tooltip";
import { Icon, type IconName } from "./icon";
import { Ripple } from "./ripple";

export function PlayPauseButton({
	playing,
	onClick,
	playTitle,
	pauseTitle,
}: {
	readonly playing: boolean;
	readonly onClick: React.MouseEventHandler<HTMLButtonElement>;
	readonly playTitle: string;
	readonly pauseTitle: string;
}) {
	return (
		<IconButton
			icon={playing ? "pause" : "play"}
			title={playing ? pauseTitle : playTitle}
			className="rounded-full p-1"
			iconClassName={`size-6 ${playing ? "fill-tda" : "fill-tok"}`}
			rippleColor="var(--color-ripple-icon-button)"
			onClick={onClick}
		/>
	);
}

export interface ButtonGroupItem<T extends string> {
	readonly id: T;
	readonly title: string;
}

export type ButtonGroupItemChangeHandler<T extends string> = (
	itemId: T,
) => void;

export function ButtonGroup<T extends string>({
	itemId,
	items,
	onItemChange,
	className,
	style,
	buttonStyle,
	transparentBG = false,
}: {
	readonly itemId: T;
	readonly items: readonly ButtonGroupItem<T>[];
	readonly onItemChange: ButtonGroupItemChangeHandler<T>;
	readonly className?: string;
	readonly style?: React.CSSProperties;
	readonly buttonStyle?: React.CSSProperties;
	readonly transparentBG?: boolean;
}) {
	function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
		if (event.code !== "ArrowLeft" && event.code !== "ArrowRight") {
			return;
		}
		if (items.length === 0) {
			return;
		}

		const itemIndex = Math.max(
			0,
			items.findIndex(({ id }) => id === itemId),
		);

		if (event.code === "ArrowLeft") {
			onItemChange(items[wrapIndex(itemIndex - 1, items.length)]?.id ?? itemId);
		} else {
			onItemChange(items[wrapIndex(itemIndex + 1, items.length)]?.id ?? itemId);
		}
	}

	return (
		<div
			tabIndex={0}
			className={`flex ${className}`}
			style={style}
			onKeyDown={onKeyDown}
		>
			{items.map((item) => (
				<button
					key={item.id}
					type="button"
					onClick={() => onItemChange(item.id)}
					className={`
            justify-content relative flex shrink-0 select-none items-center justify-center overflow-hidden border-2 px-4 py-2 outline-2 outline-white transition-colors duration-200 first:rounded-l-lg last:rounded-r-lg hover:brightness-150
            ${transparentBG ? "bg-transparent" : "bg-bpd"}
            ${itemId === item.id ? "border-tli text-tli" : "border-bsp text-tpl"}
          `}
					style={buttonStyle}
				>
					<Ripple color="var(--color-ripple-button)" />
					<div className="max-w-full overflow-x-hidden text-ellipsis">
						{item.title}
					</div>
				</button>
			))}
		</div>
	);
}

export function CopyToClipboardButton({
	contentToCopy = "",
	className,
	style,
	buttonStyle,
	iconStyle,
	title,
}: {
	readonly contentToCopy: string | (() => string);
	readonly className?: string;
	readonly style?: React.CSSProperties;
	readonly buttonStyle?: React.CSSProperties;
	readonly iconStyle?: React.CSSProperties;
	readonly title?: string;
}) {
	const { t } = useLocale();

	const triggerRef = useRef<HTMLButtonElement>(null);

	const [feedbackShown, setFeedbackShown] = useState(false);

	const onClick = useCallback(() => {
		if (typeof contentToCopy === "function") {
			copyToClipboard(contentToCopy());
		} else {
			copyToClipboard(contentToCopy);
		}
		showFeedbackTooltip(setFeedbackShown);
	}, [contentToCopy]);

	return (
		<div
			tabIndex={0}
			role="button"
			className={`relative ${className}`}
			style={style}
		>
			<button
				ref={triggerRef}
				type="button"
				title={title ?? t("actions.copyToClipboard")}
				onClick={onClick}
				className="relative cursor-pointer overflow-hidden rounded-full border-none bg-transparent p-1 hover:brightness-150"
				style={buttonStyle}
			>
				<Ripple color="var(--color-ripple-button)" />
				<Icon
					name="copy"
					style={{
						fill: "var(--color-tpd)",
						width: "1rem",
						height: "1rem",
						...iconStyle,
					}}
				/>
			</button>
			<FeedbackTooltip
				title={t("copied")}
				type="good"
				visible={feedbackShown}
				trigger={triggerRef.current}
			/>
		</div>
	);
}

export function IconButton({
	icon,
	style,
	iconStyle,
	rippleColor = "",
	title = "",
	ariaLabel = "",
	className,
	iconClassName,
	bgClassName,
	inactive = false,
	invisible = false,
	onClick,
	onDblClick,
	buttonRef,
	children,
}: {
	readonly icon: IconName;
	readonly rippleColor?: string;
	readonly title?: string;
	readonly ariaLabel?: string;
	readonly className?: string;
	readonly style?: React.CSSProperties;
	readonly iconClassName?: string;
	readonly bgClassName?: string;
	readonly iconStyle?: React.CSSProperties;
	readonly inactive?: boolean;
	readonly invisible?: boolean;
	readonly onClick?: MouseEventHandler<HTMLButtonElement>;
	readonly onDblClick?: MouseEventHandler<HTMLButtonElement>;
	readonly buttonRef?: React.Ref<HTMLButtonElement> | undefined;
	readonly children?: React.ReactNode;
}) {
	return (
		<button
			ref={buttonRef}
			tabIndex={0}
			type="button"
			title={title}
			aria-label={ariaLabel ?? title}
			onClick={inactive ? undefined : onClick}
			onDblClick={inactive ? undefined : onDblClick}
			className={`
        relative box-border flex aspect-square shrink-0 select-none items-center justify-center overflow-hidden border-none
        ${inactive || invisible ? "cursor-default" : "hover:brightness-150"}
        ${bgClassName ?? "bg-transparent"}
        ${className}
      `}
			style={style}
		>
			{rippleColor !== "" && !inactive && !invisible && (
				<Ripple color={rippleColor} />
			)}
			<Icon
				name={icon}
				style={iconStyle}
				className={iconClassName}
				invisible={invisible}
			/>
			{children}
		</button>
	);
}

export function IconedButtonGroup({
	group,
	value = 0,
	onChange,
	style,
}: {
	readonly group: { icon: IconName; title: string }[];
	readonly value?: number;
	readonly onChange?: (index: number) => void;
	readonly style?: React.CSSProperties;
}) {
	return (
		<div className="flex items-center justify-center" style={style}>
			{group.map((item, index) => (
				<button
					key={index}
					className={`
            relative cursor-pointer overflow-hidden border-none p-2 hover:brightness-150
            ${index === value ? "bg-bse" : "bg-bpd2"}
          `}
					type="button"
					onClick={() => onChange?.(index)}
					title={item.title}
				>
					<Ripple color="var(--color-ripple-button)" />
					<Icon
						name={item.icon}
						style={{
							width: "1.25rem",
							height: "1.25rem",
							fill: "var(--color-tpl)",
						}}
					/>
				</button>
			))}
		</div>
	);
}

export function ToggleMetricDiagramViewButton({
	isChart,
	onChange,
	style,
}: {
	readonly isChart: boolean;
	readonly onChange: (isChart: boolean) => void;
	readonly style?: React.CSSProperties;
}) {
	const { t } = useLocale();

	return (
		<IconButton
			icon={isChart ? "ringProgress" : "lineChart"}
			className="fill-tpd p-2 rounded-full"
			style={style}
			iconClassName="size-6"
			title={
				isChart
					? t("ToggleMetricDiagramViewButton.chooseRingProgress")
					: t("ToggleMetricDiagramViewButton.chooseLineChart")
			}
			rippleColor="var(--color-ripple-icon-button)"
			onClick={() => onChange(!isChart)}
		/>
	);
}

export type ButtonType =
	| "regular"
	| "dangerous"
	| "encouraging"
	| "discouraging"
	| "inactive"
	| "text"
	| "textLink"
	| "discouragingText";

const buttonTypeClasses: Readonly<Record<ButtonType, string>> = {
	regular: "bg-bbp text-tpl px-8 py-1",
	dangerous: "bg-bda text-bdat px-8 py-1",
	encouraging: "bg-bok text-bokt px-8 py-1",
	discouraging:
		"bg-transparent text-tpl border-2 border-tpl hover:bg-bse px-8 py-1",
	inactive: "bg-bin text-tpl px-8 py-1",
	text: "text-tpl hover:bg-bse px-2 py-1",
	textLink: "text-tli hover:underline px-2 py-1",
	discouragingText: "text-tpd hover:bg-bse px-2 py-1",
};

const buttonIconColors: Readonly<Record<ButtonType, string>> = {
	regular: "var(--color-tpl)",
	dangerous: "var(--color-bdat)",
	encouraging: "var(--color-bokt)",
	discouraging: "var(--color-tpl)",
	inactive: "var(--color-tpl)",
	text: "var(--color-tpl)",
	textLink: "var(--color-tli)",
	discouragingText: "var(--color-tpd)",
};

export function Button({
	type = "regular",
	htmlButtonType = "button",
	icon,
	title,
	style,
	buttonRef,
	onClick,
	children,
}: {
	readonly type?: ButtonType;
	readonly htmlButtonType?: "button" | "submit" | "reset";
	readonly icon?: IconName;
	readonly title?: string;
	readonly style?: React.CSSProperties;
	readonly buttonRef?: React.Ref<HTMLButtonElement>;
	readonly onClick?: React.MouseEventHandler<HTMLButtonElement>;
	readonly children?: React.ReactNode;
}) {
	return (
		<button
			ref={buttonRef}
			type={htmlButtonType}
			className={`
        justify-content relative flex shrink-0 select-none items-center justify-center overflow-hidden rounded-lg hover:brightness-150
        ${type === "inactive" ? "pointer-events-none" : ""}
        ${buttonTypeClasses[type]}
      `}
			style={style}
			onClick={onClick}
		>
			<Ripple color="var(--color-ripple-button)" />
			{icon !== undefined && (
				<Icon
					name={icon}
					style={{
						marginRight: "0.5rem",
						width: "1rem",
						height: "1rem",
						fill: buttonIconColors[type],
					}}
				/>
			)}
			<div className="max-w-full overflow-x-hidden text-ellipsis">{title}</div>
			{children}
		</button>
	);
}

export function Link({
	to = "/",
	onClick,
	className,
	style,
	children,
	...properties
}: {
	readonly to: string;
	readonly onClick?: () => void;
	readonly className?: string;
	readonly style?: React.CSSProperties;
	readonly children?: React.ReactNode;
}) {
	return (
		<button
			className={className}
			style={{ fontSize: "inherit", ...style }}
			onClick={() => {
				routeTo(to);
				onClick?.();
			}}
			{...properties}
		>
			{children}
		</button>
	);
}

export function ToTop({
	minAppearanceY = 300,
	style,
}: {
	readonly minAppearanceY?: number;
	readonly style?: React.CSSProperties;
}) {
	const [visible, setVisible] = useState(false);

	useEventListener("scroll", () => {
		setVisible(window.scrollY >= minAppearanceY);
	});

	return (
		visible && (
			<IconButton
				onClick={() => window.scrollTo(0, 0)}
				icon="toTopArrow"
				iconClassName="size-14 fill-[var(--color-to-top-bg)]"
				className="animate-fade-in fixed bottom-20 right-3 [clip-path:circle(50%_at_center)] sm:bottom-12 sm:right-8"
				style={style}
				rippleColor="var(--color-ripple-icon-button)"
			/>
		)
	);
}
