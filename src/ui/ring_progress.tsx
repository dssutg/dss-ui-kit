import { useEffect, useMemo, useRef } from "react";
import { cssColorTo6DigitHex, parseHexColor } from "@/lib/color";
import { getDpr } from "@/lib/dom";
import { cmp, degreesToRadians, lerp } from "@/lib/math";
import { useWindowSize } from "@/lib/use_window_size";

export function RingProgress({
	progress = 100,
	progressMax = 100,
	title = "",
	rotationDegrees = -90,
	backgroundColor = "#a8a8a8",
	titleColor = "#ffffff",
	ringWidth = 15,
	radius = 70,
	titleFontSize = "1rem",
	titleLineHeight = "1.625rem",
	progressSuffix = "%",
	colorBreakPoints = [
		[0, "#a0fb9f"],
		[75, "#ffb66c"],
		[100, "#e55f5f"],
	],
	interpolation = true,
	className,
	titleClassName,
	style,
	titleStyle,
	titlePos = "bottom",
}: {
	readonly progress: number;
	readonly progressMax?: number;
	readonly title?: string;
	readonly rotationDegrees?: number;
	readonly backgroundColor?: string;
	readonly titleColor?: string;
	readonly ringWidth?: number;
	readonly radius?: number;
	readonly titleFontSize?: string;
	readonly titleLineHeight?: string;
	readonly progressSuffix?: string;
	readonly colorBreakPoints?: readonly [number, string][];
	readonly interpolation?: boolean;
	readonly className?: string;
	readonly titleClassName?: string;
	readonly style?: React.CSSProperties;
	readonly titleStyle?: React.CSSProperties;
	readonly titlePos?: "top" | "bottom";
}) {
	useWindowSize();

	const diameter = radius * 2 * getDpr();

	const canvasRef = useRef<HTMLCanvasElement>(null);

	const sortedColorBreakPoints = useMemo(() => {
		return colorBreakPoints
			.map((bp): [number, string] => [bp[0], cssColorTo6DigitHex(bp[1]) ?? ""])
			.sort((a, b) => cmp(a[0], b[0]));
	}, [colorBreakPoints]);

	const intProgress = Math.round(progress);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) {
			return;
		}

		const ctx = canvas.getContext("2d");
		if (!ctx) {
			return;
		}

		// Determine current color
		let color = "";
		{
			let minBreakPointIndex = 0;
			for (let index = sortedColorBreakPoints.length - 1; index >= 0; index--) {
				const breakPoint = sortedColorBreakPoints[index]!;
				if (intProgress >= breakPoint[0]) {
					minBreakPointIndex = index;
					break;
				}
			}

			const bp0 = sortedColorBreakPoints[minBreakPointIndex]!;

			if (interpolation) {
				const nextBreakPointIndex = Math.min(
					minBreakPointIndex + 1,
					sortedColorBreakPoints.length - 1,
				);
				const bp1 = sortedColorBreakPoints[nextBreakPointIndex]!;

				const [min0] = bp0;
				const rgb0 = parseHexColor(bp0[1]);
				const [min1] = bp1;
				const rgb1 = parseHexColor(bp1[1]);

				const range = Math.abs(min1 - min0);

				let weight = 0;
				if (range !== 0) {
					weight = (intProgress - min0) / range;
				}

				const r = Math.trunc(
					Math.min(Math.max(0, lerp(rgb0.r, rgb1.r, weight)), 255),
				);
				const g = Math.trunc(
					Math.min(Math.max(0, lerp(rgb0.g, rgb1.g, weight)), 255),
				);
				const b = Math.trunc(
					Math.min(Math.max(0, lerp(rgb0.b, rgb1.b, weight)), 255),
				);

				color = `rgb(${r} ${g} ${b})`;
			} else {
				const { r, g, b } = parseHexColor(bp0[1]);
				color = `rgb(${r} ${g} ${b})`;
			}
		}

		// Draw the ring progress
		{
			const radius = diameter / 2;
			const ringW = ringWidth * getDpr();
			const cx = canvas.width / 2;
			const cy = canvas.height / 2;

			const normalizedRadius = radius - ringW / 2;

			// Range: [0...progressMax]
			const clampedProgress = Math.min(Math.max(intProgress, 0), progressMax);
			// Range: [0..1]
			const normalizedProgress = clampedProgress / progressMax;
			const normalizedRadiusFactor = 0.031_25;

			// Start drawing from empty canvas
			ctx.clearRect(0, 0, canvas.width, canvas.height);

			// Draw background arc
			ctx.beginPath();
			ctx.arc(cx, cy, radius - ringW, 0, Math.PI * 2);
			ctx.lineWidth = ringW;
			ctx.strokeStyle = backgroundColor;
			ctx.stroke();

			// Draw foreground arc
			if (intProgress > 0) {
				const startAngle = degreesToRadians(rotationDegrees);
				const endAngle = startAngle + Math.PI * 2 * normalizedProgress;

				// Make foreground arc a bit larger to prevent background arc
				// partly visible below the foreground.
				const ringWBias = 2;

				ctx.beginPath();
				ctx.arc(cx, cy, radius - ringW, startAngle, endAngle, false);
				ctx.lineWidth = ringW + ringWBias;
				ctx.lineCap = "round";
				ctx.strokeStyle = color;
				ctx.stroke();
			}

			// Draw progress text in the middle of the ring
			ctx.fillStyle = color;
			ctx.font = `${normalizedRadius * normalizedRadiusFactor}rem Arial`;
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText(`${clampedProgress}${progressSuffix}`, cx, cy);
		}
	}, [
		intProgress,
		progressMax,
		rotationDegrees,
		backgroundColor,
		ringWidth,
		diameter,
		progressSuffix,
		sortedColorBreakPoints,
		interpolation,
	]);

	const titleComponent = (
		<div
			style={{
				width: "100%",
				color: titleColor,
				maxWidth: `${diameter}px`,
				textAlign: "center",
				fontSize: titleFontSize,
				lineHeight: titleLineHeight,
				...titleStyle,
			}}
			className={titleClassName}
		>
			{title}
		</div>
	);

	return (
		<div
			style={{
				position: "relative",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: "8px",
				...style,
			}}
			className={className}
		>
			{titlePos === "top" && titleComponent}
			<canvas
				ref={canvasRef}
				style={{
					width: radius * 2,
					height: radius * 2,
					flexShrink: 0,
					...style,
				}}
				width={diameter}
				height={diameter}
			/>
			{titlePos === "bottom" && titleComponent}
		</div>
	);
}
