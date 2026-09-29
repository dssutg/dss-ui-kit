import { useDocumentScrollPercentage } from "@/lib/use_document_scroll_percentage";

export function ScrollProgressBar() {
	const percent = useDocumentScrollPercentage();

	return (
		<div className="bg-bpd h-[2px] w-full">
			<div
				className="h-full w-0 bg-[var(--color-scroll-progress-bar)]"
				style={{ width: `${percent}%` }}
			/>
		</div>
	);
}
