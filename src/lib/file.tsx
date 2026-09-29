export function getFileExtension(filename: string) {
	const i = filename.lastIndexOf(".");

	if (i <= 0) {
		return "";
	}

	return filename.slice(i + 1);
}

export function removeFileExtension(filename: string) {
	const i = filename.lastIndexOf(".");

	if (i <= 0) {
		return filename;
	}

	return filename.slice(0, i);
}

export async function loadFileContent(url: string): Promise<string> {
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`HTTP error. Status: ${response.status}`);
	}

	return response.text();
}

export function openFileDialog(
	callback: (file: File) => void,
	{
		accept,
	}: {
		readonly accept?: string;
	} = {},
) {
	const fileInput = document.createElement("input");

	fileInput.type = "file";
	fileInput.style.display = "none";

	if (accept !== undefined) {
		fileInput.accept = accept;
	}

	fileInput.addEventListener("change", (event: Event) => {
		const target = event.target as HTMLInputElement;

		if (target === null) {
			return;
		}

		const file = target.files?.[0];

		if (file) {
			callback(file);
		}
	});

	document.body.appendChild(fileInput);
	fileInput.click();
	fileInput.remove();
}

export function downloadURLAsFile(filename: string, url: string) {
	const link = document.createElement("a");

	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	link.remove();
}

export function postFormJSONToDownloadFile<T>(url: string, payload: T) {
	const form = document.createElement("form");

	form.method = "POST";
	form.action = url;
	form.style.display = "none";

	const input = document.createElement("input");
	input.type = "hidden";
	input.name = "json";
	input.value = JSON.stringify(payload);

	form.appendChild(input);

	document.body.appendChild(form);

	form.submit();
	form.remove();
}

export function downloadCanvasAsFile(
	canvas: HTMLCanvasElement,
	filename: string,
	{
		mimeType = "image/png",
	}: {
		readonly mimeType?: string;
	} = {},
) {
	downloadURLAsFile(filename, canvas.toDataURL(mimeType));
}

export function downloadStringAsPlainTextFile(
	filename: string,
	content: string,
): void {
	const blob = new Blob([content], { type: "text/plain" });
	const url = URL.createObjectURL(blob);

	downloadURLAsFile(filename, url);

	URL.revokeObjectURL(url);
}

export function openPdfExporterForHtml(
	html: string,
	{
		width = window.innerWidth,
		height = window.innerHeight,
	}: {
		readonly width?: number;
		readonly height?: number;
	},
) {
	const printWindow = window.open("", "", `height=${height},width=${width}`);

	if (printWindow === null) {
		return null;
	}

	printWindow.document.writeln(html);
	printWindow.document.close();

	setTimeout(() => {
		printWindow.print();
		printWindow.close();
	}, 500);

	return printWindow;
}

const defaultSizeUnitTitles = [
	"B",
	"KB",
	"MB",
	"GB",
	"TB",
	"PB",
	"EB",
	"ZB",
	"YB",
];

export function formatByteSize(
	bytes: number,
	{
		decimals = 2,
		sizeUnitTitles = defaultSizeUnitTitles,
	}: {
		readonly decimals?: number;
		readonly sizeUnitTitles?: string[];
	} = {},
): string {
	if (bytes === 0) {
		return `0 ${sizeUnitTitles[0]}`;
	}

	const k = 1024;
	const maxIndex = sizeUnitTitles.length - 1;

	const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), maxIndex);

	const converted = parseFloat((bytes / k ** i).toFixed(decimals));

	return `${converted} ${sizeUnitTitles[i]}`;
}
