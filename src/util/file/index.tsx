/**
 * The extension of a filename, without the dot, as the caller would type it in a filter.
 *
 * The leading dot of a dotfile is not an extension, and a name with no dot has an empty one — so the
 * answers are '' for `README`, `Makefile` and `.gitignore` alike. Case is kept, not folded, so a
 * comparison a caller does on it is a case-sensitive one.
 */
export function getFileExtension(filename: string) {
  const i = filename.lastIndexOf('.');

  if (i <= 0) {
    return '';
  }

  return filename.slice(i + 1);
}

/**
 * The filename with its extension removed, dot and all; the name unchanged when there is none.
 *
 * The counterpart of {@link getFileExtension}, with the same rule: the dot of a dotfile is not an
 * extension, so `.gitignore` comes back whole.
 */
export function removeFileExtension(filename: string) {
  const i = filename.lastIndexOf('.');

  if (i <= 0) {
    return filename;
  }

  return filename.slice(0, i);
}

/**
 * Fetches a URL as text, raising the HTTP status as the error when the response is not ok.
 *
 * A non-response is left to `fetch` to throw, so a network failure and a bad status are distinguishable
 * by the error the caller sees. This is for static assets packaged with an application — a GLSL
 * source, a data file — and not for an API call, which wants the hooks in `util/fetch`.
 */
export async function loadFileContent(url: string): Promise<string> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP error. Status: ${response.status}`);
  }

  return response.text();
}

/**
 * Opens the browser's file picker and hands the one chosen file to `callback`.
 *
 * The input is created, clicked and discarded around the call, so nothing is left in the DOM and no
 * component has to own a hidden `<input>` to offer a picker. No filtering beyond `accept`, and no
 * callback on cancel — the browser gives nothing to report for a closed dialog.
 */
export function openFileDialog(
  callback: (file: File) => void,
  {
    accept,
  }: {
    readonly accept?: string | undefined;
  } = {},
) {
  const fileInput = document.createElement('input');

  fileInput.type = 'file';
  fileInput.style.display = 'none';

  if (accept !== undefined) {
    fileInput.accept = accept;
  }

  fileInput.addEventListener('change', (event: Event) => {
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

/**
 * Downloads whatever a URL already points at, under a filename of the caller's choosing.
 *
 * The anchor's `download` attribute is what names the file; the URL may be anything the browser
 * fetches — a `blob:` URL, a `data:` URL, a server route. The other `download*` helpers here build on
 * this one rather than each application repeating the anchor dance.
 */
export function downloadURLAsFile(filename: string, url: string) {
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Posts a JSON payload to a server that answers with a file download, as a form submission.
 *
 * A form POST is what makes the browser save the answer itself: a `fetch` would only hand the bytes to
 * JavaScript, and a GET cannot carry a payload this large. The payload travels as one hidden `json`
 * field, which is a shape the receiving endpoint has to agree to.
 */
export function postFormJSONToDownloadFile<T>(url: string, payload: T) {
  const form = document.createElement('form');

  form.method = 'POST';
  form.action = url;
  form.style.display = 'none';

  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = 'json';
  input.value = JSON.stringify(payload);

  form.appendChild(input);

  document.body.appendChild(form);

  form.submit();
  form.remove();
}

/**
 * Saves what a canvas has drawn as an image file, PNG unless another MIME type is named.
 *
 * The canvas is encoded through `toDataURL`, so everything about the encoding — including losing any
 * alpha the MIME type cannot carry — is the browser's doing, and a tainted canvas throws rather than
 * producing a file.
 */
export function downloadCanvasAsFile(
  canvas: HTMLCanvasElement,
  filename: string,
  {
    mimeType = 'image/png',
  }: {
    readonly mimeType?: string | undefined;
  } = {},
) {
  downloadURLAsFile(filename, canvas.toDataURL(mimeType));
}

/**
 * Saves text as a file the browser downloads.
 *
 * An object URL and a synthetic click rather than a `data:` URL, because a large `data:` URL is a
 * string the browser has to copy and a `blob:` one is not. The URL is revoked afterwards; leaving it
 * alive pins the content in memory for the life of the document.
 */
export function downloadStringAsPlainTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);

  downloadURLAsFile(filename, url);

  URL.revokeObjectURL(url);
}

/**
 * Opens a window that renders HTML and starts its print dialog, which is how "export as PDF" is done
 * without a PDF library: the browser's own print-to-PDF writes the file.
 *
 * Returns the window rather than awaiting the print, because the browser gives no event for a finished
 * print job to await; the fixed delay before `print` is there for the document to finish loading and
 * is a heuristic, not a guarantee. `null` when the browser refused to open the window — a popup
 * blocker is the usual reason.
 */
export function openPdfExporterForHtml(
  html: string,
  {
    width = window.innerWidth,
    height = window.innerHeight,
  }: {
    readonly width?: number | undefined;
    readonly height?: number | undefined;
  },
) {
  const printWindow = window.open('', '', `height=${height},width=${width}`);

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

const defaultSizeUnitTitles = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

/**
 * A byte count as a human-readable size, scaled to the largest unit that fits.
 *
 * Two decimals by default, which is what a file size in a panel wants, and the unit titles are the
 * caller's because the suffixes are language — a locale shipping `Ko` and `kB` passes its own.
 */
export function formatByteSize(
  bytes: number,
  {
    decimals = 2,
    sizeUnitTitles = defaultSizeUnitTitles,
  }: {
    readonly decimals?: number | undefined;
    readonly sizeUnitTitles?: string[] | undefined;
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
