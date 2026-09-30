import { useCallback, useEffect, useId, useRef, useState } from "react";
import { openFileDialog } from "@/lib/file";
import { clamp } from "@/lib/math";
import { useLocale } from "@/locale";
import { Button } from "./button";
import { Icon, type IconName } from "./icon";

export interface UploadConfigProps {
	/**
	 * The icon shown once a file has been chosen, and the message the button beside the drop area
	 * speaks for.
	 *
	 * A prop rather than a fixed pair of variants, because what is being uploaded — a configuration, a
	 * firmware image, a licence — is the caller's fact and not the component's. The component knows
	 * about a file, and nothing about what kind.
	 */
	readonly icon?: IconName;
	readonly uploadTitle?: string;
	readonly cancelTitle?: string;
	readonly onFileUpload: (file: File) => Promise<void>;
	readonly onFileUploadCancel?: (file: File) => void;
	readonly onFileChange?: (file: File) => void;
	readonly hint?: string;
	readonly style?: React.CSSProperties;
	readonly progress?: number;
	readonly onlyDrop?: boolean;
	readonly uploadedFile?: File;
}

export function UploadConfig({
	icon = "uploadFileText",
	uploadTitle,
	cancelTitle,
	onFileUpload,
	onFileUploadCancel,
	onFileChange,
	hint,
	style,
	progress,
	onlyDrop = false,
	uploadedFile,
}: UploadConfigProps) {
	const needsProgressTracking = progress !== undefined;

	const percent = Math.floor(clamp(progress ?? 100, 0, 100));

	const { t } = useLocale();

	type Status = "empty" | "chosen" | "inProgress" | "complete";

	const id = useId();
	const [status, setStatus] = useState<Status>("empty");
	const [file, setFile] = useState<File>();

	const dropAreaRef = useRef<HTMLDivElement>(null);

	const [hasDragEntered, setHasDragEntered] = useState(false);

	const onDrop = useCallback(
		(event: DragEvent) => {
			event.preventDefault();

			setHasDragEntered(false);

			if (event.dataTransfer === null) {
				return;
			}

			const [droppedFile] = Array.from(event.dataTransfer.files);

			if (droppedFile !== undefined) {
				setFile(droppedFile);
				onFileChange?.(droppedFile);
			}
		},
		[onFileChange],
	);

	useEffect(() => {
		if (file) {
			setStatus("chosen");
		}
	}, [file]);

	useEffect(() => {
		if (uploadedFile !== undefined) {
			setFile(uploadedFile);
		}
	}, [uploadedFile]);

	useEffect(() => {
		if (needsProgressTracking && percent === 100) {
			setStatus("complete");
		}
	}, [percent, needsProgressTracking]);

	const upload = useCallback(async () => {
		if (file) {
			await onFileUpload(file);
		}
		if (needsProgressTracking) {
			setStatus("inProgress");
		} else {
			setStatus("complete");
		}
	}, [file, onFileUpload, needsProgressTracking]);

	const cancelUpload = useCallback(() => {
		setStatus("chosen");
		if (file && onFileUploadCancel) {
			onFileUploadCancel(file);
		}
	}, [file, onFileUploadCancel]);

	const onDragOver = useCallback((event: DragEvent) => {
		event.preventDefault();
		setHasDragEntered(true);
	}, []);

	const onDragEnter = useCallback(() => {
		setHasDragEntered(true);
	}, []);

	const onDragLeave = useCallback((event: DragEvent) => {
		if (!dropAreaRef.current) {
			return;
		}

		if (!dropAreaRef.current.contains(event.relatedTarget as Node)) {
			setHasDragEntered(false);
		}
	}, []);

	const onDropAreaClick = useCallback(() => {
		openFileDialog((file) => {
			onFileChange?.(file);
			setFile(file);
		});
	}, [onFileChange]);

	return (
		<div className="flex flex-col gap-4 p-6" style={style}>
			<div className="flex h-8 items-center justify-center">
				{status === "complete" && (
					<div className="text-tok text-center">{t("UploadConfig.done")}</div>
				)}
				{status === "inProgress" && (
					<div className="relative flex h-6 w-full overflow-hidden rounded-full bg-[#4e7197]">
						<div
							className="flex h-full items-center justify-center overflow-hidden break-all rounded-full bg-[#77bc65] transition-[width_0.5s_ease]"
							style={{ width: `${percent}%` }}
						/>
						<div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-[#ffff00]">
							{percent}%
						</div>
					</div>
				)}
			</div>
			<div
				ref={dropAreaRef}
				className={`
          flex w-60 cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-lg border-2 border-dashed p-4 hover:brightness-150
          ${hasDragEntered || status === "complete" ? "border-tok" : "border-tpl"}
        `}
				onDrop={onDrop}
				onDragOver={onDragOver}
				onDragEnter={onDragEnter}
				onDragLeave={onDragLeave}
				onClick={onDropAreaClick}
				title={file?.name}
			>
				{(status === "empty" || hasDragEntered) && (
					<>
						<Icon
							name="uploadDropZone"
							style={{
								pointerEvents: "none",
								width: "6rem",
								height: "6rem",
								fill: `url(#${id}uploadDropZone)`,
							}}
							prependComponent={
								<defs>
									<linearGradient
										id={`${id}uploadDropZone`}
										x1="1094.4"
										x2="1194.9"
										y1="1250.3"
										y2="1317"
										gradientTransform="matrix(.97935 0 0 1.0418 -1071.4 -1287.3)"
										gradientUnits="userSpaceOnUse"
									>
										<stop
											stopColor={
												hasDragEntered ? "var(--color-tok)" : "#826fc8"
											}
											offset="0"
										/>
										<stop
											stopColor={
												hasDragEntered ? "var(--color-tok)" : "#68326f"
											}
											offset=".96001"
										/>
									</linearGradient>
								</defs>
							}
						/>
						<div
							className={`
                text-tpl pointer-events-none w-full text-center
                ${hasDragEntered ? "text-tok" : ""}
              `}
						>
							{hint ?? t("UploadConfig.hint")}
						</div>
					</>
				)}
				{status !== "empty" && !hasDragEntered && (
					<>
						<Icon
							name={icon}
							style={{
								pointerEvents: "none",
								width: "6rem",
								height: "6rem",
								fill: `url(#${id}uploadFileIcon)`,
							}}
							prependComponent={
								<defs>
									<linearGradient
										id={`${id}uploadFileIcon`}
										x1={964.02}
										x2={1138.3}
										y1={1943.4 - 200 + percent * 3}
										y2={2107.6 - 200 + percent * 3}
										gradientTransform="matrix(.56744 0 0 .60577 -546 -1177.9)"
										gradientUnits="userSpaceOnUse"
									>
										<stop stopColor="#6ec599" offset=".12911" />
										<stop stopColor="#3c4b75" offset=".75074" />
									</linearGradient>
								</defs>
							}
						/>
						<div className="text-tpl pointer-events-none w-full truncate text-center">
							{file?.name}
						</div>
					</>
				)}
			</div>
			{!onlyDrop &&
				(status === "inProgress" ? (
					<Button
						key="cancelButton"
						type="dangerous"
						title={cancelTitle ?? t("UploadConfig.cancel")}
						onClick={cancelUpload}
					/>
				) : (
					<Button
						key="uploadButton"
						type={status === "chosen" ? "regular" : "inactive"}
						title={uploadTitle ?? t("UploadConfig.upload")}
						onClick={() => {
							(async () => {
								await upload();
							})();
						}}
					/>
				))}
		</div>
	);
}
