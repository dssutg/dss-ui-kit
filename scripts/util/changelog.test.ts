import { describe, expect, it } from 'vitest';
import { buildChangelogEntry } from './changelog';
import type { ConventionalCommit } from './conventional';
import type { ReleaseType } from './semver';

/** A conventional commit with only the fields the changelog rendering reads. */
function commit(overrides: Partial<ConventionalCommit> = {}): ConventionalCommit {
  return {
    hash: '9a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b',
    shortHash: '9a1b2c3',
    author: 'Author',
    date: '2026-10-05T00:00:00Z',
    subject: 'feat: subject',
    body: '',
    type: 'feat',
    scope: null,
    description: 'subject',
    breaking: false,
    breakingDescription: null,
    references: [],
    revert: false,
    ...overrides,
  };
}

/** The release type a single `feat` commit infers. */
const RELEASE_TYPE: ReleaseType = 'minor';

describe('buildChangelogEntry', () => {
  it('strips an access token embedded before the host of the url base', () => {
    const entry = buildChangelogEntry(
      [commit()],
      '1.1.0',
      RELEASE_TYPE,
      'v1.0.0',
      'https://ghp_token1234567890@github.com/owner/repo',
    );

    expect(entry.compareUrl).toBe('https://github.com/owner/repo/compare/v1.0.0...v1.1.0');
    expect(JSON.stringify(entry.sections)).not.toContain('ghp_token1234567890');
  });

  it('strips a user-and-password userinfo, the form CI remotes use', () => {
    const entry = buildChangelogEntry(
      [commit()],
      '1.1.0',
      RELEASE_TYPE,
      'v1.0.0',
      'https://x-access-token:ghs_token1234567890@github.com/owner/repo',
    );

    expect(entry.compareUrl).toBe('https://github.com/owner/repo/compare/v1.0.0...v1.1.0');
  });

  it('leaves a url base without credentials alone', () => {
    const entry = buildChangelogEntry(
      [commit()],
      '1.1.0',
      RELEASE_TYPE,
      'v1.0.0',
      'https://github.com/owner/repo',
    );

    expect(entry.compareUrl).toBe('https://github.com/owner/repo/compare/v1.0.0...v1.1.0');
    expect(entry.sections[0]?.entries[0]).toContain(
      '(https://github.com/owner/repo/commit/9a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b)',
    );
  });

  it('does not treat a slash in the path as part of the userinfo', () => {
    const entry = buildChangelogEntry(
      [commit()],
      '1.1.0',
      RELEASE_TYPE,
      null,
      'https://github.com/owner/repo',
    );

    // No previous tag means no comparison link; the path has to survive untouched.
    expect(entry.compareUrl).toBeNull();
    expect(entry.sections[0]?.entries[0]).toContain('https://github.com/owner/repo/commit/');
  });
});
