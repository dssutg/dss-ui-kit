import { describe, expect, test } from 'vitest';
import { formatByteSize, getFileExtension, removeFileExtension } from './';

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
