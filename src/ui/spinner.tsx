export function Spinner({ style }: { readonly style?: React.CSSProperties }) {
	return <WshSpinner style={style} color="var(--color-tpl)" />;
}

export function ContinuousCircleSpinner({
	style,
}: {
	readonly style?: React.CSSProperties;
}) {
	return (
		<div
			className="leading-0 aspect-square size-[2em] animate-spin rounded-full border-[5px] border-[var(--color-loading-spinner-bg)] border-b-[var(--color-loading-spinner-fg)] bg-transparent text-[2rem]"
			style={style}
		/>
	);
}

export function WshSpinner({
	color = "#ddd",
	style,
}: {
	readonly color?: string;
	readonly style?: React.CSSProperties;
}) {
	return (
		<div
			className="opacity-1 flex h-28 w-28 shrink-0 justify-center"
			style={
				{
					"--color": color,
					...style,
				} as React.CSSProperties
			}
		>
			<div className="pointer-events-none relative w-16">
				<div>
					<div className="animate-wsh-spinner-container pointer-events-none absolute left-[50%] top-[50%] -ml-[50%] -mt-[50%] w-full pb-[100%]">
						<div className="animate-wsh-spinner-rotator absolute h-full w-full">
							<div className="absolute bottom-0 left-0 right-[49%] top-0 overflow-hidden">
								<div className="animate-wsh-spinner-left absolute -right-[100%] left-0 box-border h-full w-[200%] rounded-full border-[6px] border-b-[transparent] border-l-[var(--color)] border-r-transparent border-t-[var(--color)]" />
							</div>
							<div className="absolute bottom-0 left-[49%] right-0 top-0 overflow-hidden">
								<div className="animate-wsh-spinner-right absolute -left-[100%] right-0 box-border h-full w-[200%] rounded-full border-[6px] border-b-[transparent] border-l-transparent border-r-[var(--color)] border-t-[var(--color)]" />
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export function DashedCircle({
	active = true,
	title = "Loading...",
}: {
	readonly active?: boolean;
	readonly title?: string;
}) {
	if (!active) {
		return null;
	}

	const size = 200;
	const sizeString = `${size}px`;
	const color = "var(--color-loading-spinner-fg)";
	const style: React.CSSProperties = { background: "none" };

	return (
		<svg
			role="img"
			width={sizeString}
			height={sizeString}
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 100 100"
			preserveAspectRatio="xMidYMid"
			style={style}
			aria-label={title}
		>
			<g transform="rotate(0 50 50)">
				<rect
					x="47"
					y="24"
					rx="9.4"
					ry="4.8"
					width="6"
					height="12"
					fill={color}
				>
					<animate
						attributeName="opacity"
						values="1;0"
						keyTimes="0;1"
						dur="1s"
						begin="-0.9166666666666666s"
						repeatCount="indefinite"
					/>
				</rect>
			</g>
			<g transform="rotate(30 50 50)">
				<rect
					x="47"
					y="24"
					rx="9.4"
					ry="4.8"
					width="6"
					height="12"
					fill={color}
				>
					<animate
						attributeName="opacity"
						values="1;0"
						keyTimes="0;1"
						dur="1s"
						begin="-0.8333333333333334s"
						repeatCount="indefinite"
					/>
				</rect>
			</g>
			<g transform="rotate(60 50 50)">
				<rect
					x="47"
					y="24"
					rx="9.4"
					ry="4.8"
					width="6"
					height="12"
					fill={color}
				>
					<animate
						attributeName="opacity"
						values="1;0"
						keyTimes="0;1"
						dur="1s"
						begin="-0.75s"
						repeatCount="indefinite"
					/>
				</rect>
			</g>
			<g transform="rotate(90 50 50)">
				<rect
					x="47"
					y="24"
					rx="9.4"
					ry="4.8"
					width="6"
					height="12"
					fill={color}
				>
					<animate
						attributeName="opacity"
						values="1;0"
						keyTimes="0;1"
						dur="1s"
						begin="-0.6666666666666666s"
						repeatCount="indefinite"
					/>
				</rect>
			</g>
			<g transform="rotate(120 50 50)">
				<rect
					x="47"
					y="24"
					rx="9.4"
					ry="4.8"
					width="6"
					height="12"
					fill={color}
				>
					<animate
						attributeName="opacity"
						values="1;0"
						keyTimes="0;1"
						dur="1s"
						begin="-0.5833333333333334s"
						repeatCount="indefinite"
					/>
				</rect>
			</g>
			<g transform="rotate(150 50 50)">
				<rect
					x="47"
					y="24"
					rx="9.4"
					ry="4.8"
					width="6"
					height="12"
					fill={color}
				>
					<animate
						attributeName="opacity"
						values="1;0"
						keyTimes="0;1"
						dur="1s"
						begin="-0.5s"
						repeatCount="indefinite"
					/>
				</rect>
			</g>
			<g transform="rotate(180 50 50)">
				<rect
					x="47"
					y="24"
					rx="9.4"
					ry="4.8"
					width="6"
					height="12"
					fill={color}
				>
					<animate
						attributeName="opacity"
						values="1;0"
						keyTimes="0;1"
						dur="1s"
						begin="-0.4166666666666667s"
						repeatCount="indefinite"
					/>
				</rect>
			</g>
			<g transform="rotate(210 50 50)">
				<rect
					x="47"
					y="24"
					rx="9.4"
					ry="4.8"
					width="6"
					height="12"
					fill={color}
				>
					<animate
						attributeName="opacity"
						values="1;0"
						keyTimes="0;1"
						dur="1s"
						begin="-0.3333333333333333s"
						repeatCount="indefinite"
					/>
				</rect>
			</g>
			<g transform="rotate(240 50 50)">
				<rect
					x="47"
					y="24"
					rx="9.4"
					ry="4.8"
					width="6"
					height="12"
					fill={color}
				>
					<animate
						attributeName="opacity"
						values="1;0"
						keyTimes="0;1"
						dur="1s"
						begin="-0.25s"
						repeatCount="indefinite"
					/>
				</rect>
			</g>
			<g transform="rotate(270 50 50)">
				<rect
					x="47"
					y="24"
					rx="9.4"
					ry="4.8"
					width="6"
					height="12"
					fill={color}
				>
					<animate
						attributeName="opacity"
						values="1;0"
						keyTimes="0;1"
						dur="1s"
						begin="-0.16666666666666666s"
						repeatCount="indefinite"
					/>
				</rect>
			</g>
			<g transform="rotate(300 50 50)">
				<rect
					x="47"
					y="24"
					rx="9.4"
					ry="4.8"
					width="6"
					height="12"
					fill={color}
				>
					<animate
						attributeName="opacity"
						values="1;0"
						keyTimes="0;1"
						dur="1s"
						begin="-0.08333333333333333s"
						repeatCount="indefinite"
					/>
				</rect>
			</g>
			<g transform="rotate(330 50 50)">
				<rect
					x="47"
					y="24"
					rx="9.4"
					ry="4.8"
					width="6"
					height="12"
					fill={color}
				>
					<animate
						attributeName="opacity"
						values="1;0"
						keyTimes="0;1"
						dur="1s"
						begin="0s"
						repeatCount="indefinite"
					/>
				</rect>
			</g>
		</svg>
	);
}
