// SPDX-License-Identifier: MIT
/**
 * The file helpers split in two: the name and byte-size arithmetic is pure, and the rest drives
 * browser UI — pickers, downloads, the print window — which needs the document. The suite runs in
 * jsdom for both halves, and where jsdom does not implement the API the source calls
 * (`URL.createObjectURL`, `window.open`, `toDataURL`, form submission), the test stubs exactly that
 * call and asserts the arguments the source passed and the effects it had.
 */
// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  downloadCanvasAsFile,
  downloadStringAsPlainTextFile,
  downloadURLAsFile,
  formatByteSize,
  getFileExtension,
  loadFileContent,
  openFileDialog,
  openPdfExporterForHtml,
  postFormJSONToDownloadFile,
  removeFileExtension,
} from './';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

/** The one element the tested helper created and clicked, failing loudly when it did not. */
function only<T extends HTMLElement>(created: T[]): T {
  const element = created[0];

  if (element === undefined) {
    throw new Error('the helper did not create the element the test expects');
  }

  return element;
}

describe('getFileExtension', () => {
  test('returns the extension after the last dot', () => {
    expect(getFileExtension('archive.tar.gz')).toBe('gz');
  });

  test('returns an empty string for a file without a dot', () => {
    expect(getFileExtension('README')).toBe('');
  });

  test('returns an empty string for a dotfile without an extension', () => {
    // A leading dot names a hidden file, not an extension; `i <= 0` is what rejects it.
    expect(getFileExtension('.gitignore')).toBe('');
  });

  test('returns the extension of a dotfile that has one', () => {
    expect(getFileExtension('.eslintrc.json')).toBe('json');
  });
});

describe('removeFileExtension', () => {
  test('removes the extension after the last dot', () => {
    expect(removeFileExtension('archive.tar.gz')).toBe('archive.tar');
  });

  test('returns the name unchanged without a dot', () => {
    expect(removeFileExtension('README')).toBe('README');
  });

  test('returns a dotfile unchanged', () => {
    expect(removeFileExtension('.gitignore')).toBe('.gitignore');
  });
});

/**
 * Byte sizes are shown to operators next to the values they came from, so the formatting has to be
 * stable: binary units that keep scaling monotonic, zero left unscaled, and clamping at the last
 * unit title the caller supplied rather than rendering a missing one.
 */
describe('formatByteSize', () => {
  test('formats bytes without a fraction', () => {
    expect(formatByteSize(512)).toBe('512 B');
  });

  test('scales to the largest unit that fits', () => {
    expect(formatByteSize(1024)).toBe('1 KB');
    expect(formatByteSize(1536)).toBe('1.5 KB');
    expect(formatByteSize(1024 ** 2)).toBe('1 MB');
    expect(formatByteSize(1024 ** 3)).toBe('1 GB');
  });

  test('formats zero without scaling', () => {
    expect(formatByteSize(0)).toBe('0 B');
  });

  test('honours the requested number of decimals', () => {
    expect(formatByteSize(1536, { decimals: 0 })).toBe('2 KB');
    expect(formatByteSize(1536, { decimals: 1 })).toBe('1.5 KB');
  });

  test('stops at the last unit title the caller supplied', () => {
    // A value far beyond the supplied titles clamps to the last one rather than reading `${n} undefined`.
    expect(formatByteSize(1024 ** 4, { sizeUnitTitles: ['B', 'KB'] })).toBe('1073741824 KB');
  });

  test('takes the unit titles the caller supplies', () => {
    expect(formatByteSize(1024, { sizeUnitTitles: ['byte', 'kibibyte'] })).toBe('1 kibibyte');
  });
});

describe('loadFileContent', () => {
  test('returns the response text for an ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('glsl source', { status: 200 })),
    );

    await expect(loadFileContent('/vertex.glsl')).resolves.toBe('glsl source');
    expect(fetch).toHaveBeenCalledWith('/vertex.glsl');
  });

  test('raises the HTTP status as the error for a response that is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('missing', { status: 404 })),
    );

    await expect(loadFileContent('/missing.txt')).rejects.toThrow('HTTP error. Status: 404');
  });
});

/**
 * The picker is created, clicked and removed around the call, so the test reaches it the same way
 * the source does not have to: through what the click spy sees (`this` is the created element).
 * Dispatching `change` on it afterwards is what the browser does when a file is picked.
 */
describe('openFileDialog', () => {
  test('opens a hidden picker with the accepted types and discards the input', () => {
    const picked: File[] = [];
    const opened: HTMLInputElement[] = [];

    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function capture(
      this: HTMLInputElement,
    ) {
      opened.push(this);
    });

    openFileDialog((file) => picked.push(file), { accept: 'image/*' });

    const input = only(opened);

    expect(input.type).toBe('file');
    expect(input.accept).toBe('image/*');
    expect(input.style.display).toBe('none');
    expect(document.body.contains(input)).toBe(false);

    const file = new File(['x'], 'photo.png');

    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));

    expect(picked).toEqual([file]);
  });

  test('calls nothing when the picker reported no file', () => {
    const picked: File[] = [];
    const opened: HTMLInputElement[] = [];

    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function capture(
      this: HTMLInputElement,
    ) {
      opened.push(this);
    });

    openFileDialog((file) => picked.push(file));

    const input = only(opened);

    Object.defineProperty(input, 'files', { value: [], configurable: true });
    input.dispatchEvent(new Event('change'));

    expect(picked).toEqual([]);
  });

  test('calls nothing when the picker reported no file list at all', () => {
    // A FileList is optional per the platform, and `files?.[0]` is the guard for it.
    const picked: File[] = [];
    const opened: HTMLInputElement[] = [];

    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function capture(
      this: HTMLInputElement,
    ) {
      opened.push(this);
    });

    openFileDialog((file) => picked.push(file));

    const input = only(opened);

    Object.defineProperty(input, 'files', { value: null, configurable: true });
    input.dispatchEvent(new Event('change'));

    expect(picked).toEqual([]);
  });
});

/** The anchor dance every download helper builds on, asserted once in its plainest form. */
describe('downloadURLAsFile', () => {
  test('clicks an anchor under the given file name that points at the URL', () => {
    const clicked: HTMLAnchorElement[] = [];

    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function capture(
      this: HTMLAnchorElement,
    ) {
      clicked.push(this);
    });

    downloadURLAsFile('report.csv', 'blob:stub');

    const anchor = only(clicked);

    expect(anchor.href).toBe('blob:stub');
    expect(anchor.download).toBe('report.csv');
    expect(document.body.contains(anchor)).toBe(false);
  });
});

describe('postFormJSONToDownloadFile', () => {
  test('submits a hidden form carrying the payload as one json field', () => {
    const submitted: HTMLFormElement[] = [];

    vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(function capture(
      this: HTMLFormElement,
    ) {
      submitted.push(this);
    });

    postFormJSONToDownloadFile('/export', { query: 'a', rows: 2 });

    const form = only(submitted);

    expect(form.method.toLowerCase()).toBe('post');
    expect(form.getAttribute('action')).toBe('/export');
    expect(form.style.display).toBe('none');
    expect(document.body.contains(form)).toBe(false);

    const field = form.querySelector('input[name="json"]');

    expect(field?.getAttribute('type')).toBe('hidden');
    expect(field?.getAttribute('value')).toBe(JSON.stringify({ query: 'a', rows: 2 }));
  });
});

describe('downloadCanvasAsFile', () => {
  test('encodes the canvas and downloads the data URL under the file name', () => {
    const canvas = document.createElement('canvas');
    const toDataURL = vi.fn(() => 'data:image/png;base64,AAAA');
    const clicked: HTMLAnchorElement[] = [];

    Object.defineProperty(canvas, 'toDataURL', { value: toDataURL, configurable: true });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function capture(
      this: HTMLAnchorElement,
    ) {
      clicked.push(this);
    });

    downloadCanvasAsFile(canvas, 'chart.png');

    const anchor = only(clicked);

    expect(toDataURL).toHaveBeenCalledWith('image/png');
    expect(anchor.href).toBe('data:image/png;base64,AAAA');
    expect(anchor.download).toBe('chart.png');
  });

  test('encodes as the MIME type the caller names', () => {
    const canvas = document.createElement('canvas');
    const toDataURL = vi.fn(() => 'data:image/jpeg;base64,AAAA');
    const clicked: HTMLAnchorElement[] = [];

    Object.defineProperty(canvas, 'toDataURL', { value: toDataURL, configurable: true });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function capture(
      this: HTMLAnchorElement,
    ) {
      clicked.push(this);
    });

    downloadCanvasAsFile(canvas, 'chart.jpg', { mimeType: 'image/jpeg' });

    const anchor = only(clicked);

    expect(toDataURL).toHaveBeenCalledWith('image/jpeg');
    expect(anchor.href).toBe('data:image/jpeg;base64,AAAA');
    expect(anchor.download).toBe('chart.jpg');
  });
});

describe('downloadStringAsPlainTextFile', () => {
  test('downloads a blob URL built from the content, then revokes that URL', () => {
    const downloaded: { blob: Blob | null } = { blob: null };
    const createObjectURL = vi.fn((blob: Blob): string => {
      downloaded.blob = blob;

      return 'blob:stub';
    });
    const revokeObjectURL = vi.fn(() => {});

    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

    const clicked: HTMLAnchorElement[] = [];

    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function capture(
      this: HTMLAnchorElement,
    ) {
      clicked.push(this);
    });

    downloadStringAsPlainTextFile('notes.txt', 'the content');

    const anchor = only(clicked);

    expect(downloaded.blob?.size).toBe(11);
    expect(downloaded.blob?.type).toBe('text/plain');
    expect(anchor.href).toBe('blob:stub');
    expect(anchor.download).toBe('notes.txt');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:stub');
  });
});

describe('openPdfExporterForHtml', () => {
  test('writes the html into a window sized from the viewport and prints it after a delay', () => {
    vi.useFakeTimers();

    const printWindow = {
      document: { writeln: vi.fn(), close: vi.fn() },
      print: vi.fn(),
      close: vi.fn(),
    };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(printWindow as unknown as Window);

    const result = openPdfExporterForHtml('<p>report</p>', {});

    expect(openSpy).toHaveBeenCalledWith('', '', 'height=768,width=1024');
    expect(printWindow.document.writeln).toHaveBeenCalledWith('<p>report</p>');
    expect(printWindow.document.close).toHaveBeenCalledOnce();
    expect(printWindow.print).not.toHaveBeenCalled();
    expect(result).toBe(printWindow);

    vi.advanceTimersByTime(500);

    expect(printWindow.print).toHaveBeenCalledOnce();
    expect(printWindow.close).toHaveBeenCalledOnce();
  });

  test('sizes the window as the caller asks', () => {
    const printWindow = {
      document: { writeln: vi.fn(), close: vi.fn() },
      print: vi.fn(),
      close: vi.fn(),
    };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(printWindow as unknown as Window);

    openPdfExporterForHtml('<p>report</p>', { width: 300, height: 200 });

    expect(openSpy).toHaveBeenCalledWith('', '', 'height=200,width=300');
  });

  test('answers null when the browser refused to open a window', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    expect(openPdfExporterForHtml('<p>report</p>', {})).toBeNull();
    expect(openSpy).toHaveBeenCalledOnce();
  });
});
