export interface Commit {
  readonly hash: string;
  readonly shortHash: string;
  readonly subject: string;
  readonly body: string;
  readonly author: string;
  readonly date: string;
}

export interface ConventionalCommit extends Commit {
  readonly type: string;
  readonly scope: string | null;
  readonly description: string;
  readonly breaking: boolean;
  readonly breakingDescription: string | null;
  readonly references: readonly { readonly prefix: string; readonly issue: string }[];
  readonly revert: boolean;
}

const HEADER_PATTERN =
  /^(?<type>[a-zA-Z][a-zA-Z0-9]*)(\((?<scope>[^()\r\n]*)\))?(?<breaking>!)?: (?<subject>.+)$/;

const BREAKING_FOOTER_PATTERN = /^BREAKING[ -]CHANGE:\s*(?<description>.+)$/i;
const REFERENCE_PATTERN = /(?<prefix>[\w-]+)#(?<issue>\d+)/g;
const REVERT_PATTERN = /^Reverts\s+([\da-f]{7,40})\s+(?<subject>.+)$/i;

/**
 * Reads one named group out of a regular expression match.
 *
 * `RegExpExecArray.groups` is an index signature, so reading a named group with dot access is a
 * type error under `noPropertyAccessFromIndexSignature`, and reaching for a cast to silence it
 * would also hide the part that matters: a group is optional, because the pattern may not have
 * participated. This helper names both — the group, and its absence.
 *
 * @param match - The match to read, or `null` when the pattern did not match.
 * @param name - The group name as written in the pattern.
 * @returns The captured text, or `undefined` when the group is absent or did not participate.
 */
function namedGroup(match: RegExpExecArray | null, name: string): string | undefined {
  return match?.groups?.[name];
}

export function parseConventionalCommit(commit: Commit): ConventionalCommit | null {
  if (REVERT_PATTERN.test(commit.subject)) {
    return {
      ...commit,
      type: 'revert',
      scope: null,
      description: commit.subject,
      breaking: false,
      breakingDescription: null,
      references: [],
      revert: true,
    };
  }

  const match = HEADER_PATTERN.exec(commit.subject);
  if (!match) {
    return null;
  }

  const type = namedGroup(match, 'type') ?? '';
  const scope = namedGroup(match, 'scope');
  const breaking = namedGroup(match, 'breaking');
  const subject = namedGroup(match, 'subject') ?? '';

  const breakingFooter = commit.body
    .split('\n')
    .map((line) => namedGroup(BREAKING_FOOTER_PATTERN.exec(line.trim()), 'description'))
    .find((description): description is string => description !== undefined);

  const references = [...commit.body.matchAll(REFERENCE_PATTERN)].map((reference) => ({
    prefix: namedGroup(reference, 'prefix') ?? '',
    issue: namedGroup(reference, 'issue') ?? '',
  }));

  return {
    ...commit,
    type: type.toLowerCase(),
    scope: scope && scope.length > 0 ? scope : null,
    description: subject.trim(),
    breaking: Boolean(breaking) || breakingFooter !== undefined,
    breakingDescription: breakingFooter ?? null,
    references,
    revert: false,
  };
}

export function validateCommitMessage(rawMessage: string): string[] {
  const problems: string[] = [];
  const message = rawMessage.trim();

  if (message.length === 0) {
    return ['Commit message must not be empty.'];
  }

  const subject = message.split('\n')[0] ?? '';
  const match = HEADER_PATTERN.exec(subject);

  if (!match) {
    problems.push(
      `Subject "${subject}" does not follow Conventional Commits.`,
      'Expected: <type>(<scope>)!: <description>',
      'Types: build, chore, ci, docs, feat, fix, perf, refactor, revert, style, test',
    );
    return problems;
  }

  const type = (namedGroup(match, 'type') ?? '').toLowerCase();
  const allowed = [
    'build',
    'chore',
    'ci',
    'docs',
    'feat',
    'fix',
    'perf',
    'refactor',
    'revert',
    'style',
    'test',
  ];

  if (!allowed.includes(type)) {
    problems.push(`Unknown type "${type}". Allowed types: ${allowed.join(', ')}.`);
  }

  const description = namedGroup(match, 'subject') ?? '';
  if (description.length > 0 && description.endsWith('.')) {
    problems.push('Subject must not end with a period.');
  }

  const breakingFooter = message
    .split('\n')
    .filter((line) => /^BREAKING[ -]CHANGE:/i.test(line.trim()));
  const breakingMarker = namedGroup(match, 'breaking') !== undefined;

  if (breakingMarker && breakingFooter.length > 0) {
    problems.push('Use either the "!" marker or the BREAKING CHANGE footer, not both.');
  }

  return problems;
}
