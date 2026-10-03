import type { ConventionalCommit } from './conventional.ts';
import type { ReleaseType } from './semver.ts';

/**
 * Generates the changelog entry for one release.
 *
 * Breaking changes and the conventional types are grouped into Keep a Changelog sections, ordered
 * so the most important section comes first.
 */
export interface ChangelogSection {
  readonly heading: string;
  readonly entries: readonly string[];
}

/** A rendered changelog section for one released version. */
export interface ChangelogEntry {
  readonly version: string;
  readonly date: string;
  readonly releaseType: ReleaseType;
  readonly compareUrl: string | null;
  readonly sections: readonly ChangelogSection[];
  readonly contributors: readonly string[];
}

/**
 * Heading for a commit whose type has no section of its own.
 *
 * Named so the fallback is a `string` rather than a `string | undefined` index access, and so the
 * heading is written down once instead of in both the map and the order that reads it.
 */
const DEFAULT_SECTION_HEADING = 'Chores';

const SECTION_BY_TYPE: Record<string, string> = {
  feat: 'Features',
  fix: 'Bug Fixes',
  perf: 'Performance',
  refactor: 'Refactoring',
  docs: 'Documentation',
  test: 'Tests',
  build: 'Build',
  ci: 'Continuous Integration',
  style: 'Styling',
  chore: DEFAULT_SECTION_HEADING,
};

const SECTION_ORDER = [
  'Breaking Changes',
  'Features',
  'Bug Fixes',
  'Performance',
  'Refactoring',
  'Documentation',
  'Tests',
  'Build',
  'Continuous Integration',
  'Styling',
  DEFAULT_SECTION_HEADING,
];

const NON_USER_FACING_TYPES = new Set(['chore', 'ci', 'build', 'style', 'test']);

/**
 * Derives the release type from a range of commits.
 *
 * A breaking change gives a major release, a feature a minor one, a fix or a performance change a
 * patch. Anything else does not trigger a release on its own.
 *
 * @param commits - Conventional commits included in the release.
 * @returns The release type to apply.
 */
export function determineReleaseType(commits: readonly ConventionalCommit[]): ReleaseType {
  if (commits.some((commit) => commit.breaking)) {
    return 'major';
  }
  if (commits.some((commit) => commit.type === 'feat')) {
    return 'minor';
  }
  if (commits.some((commit) => commit.type === 'fix' || commit.type === 'perf')) {
    return 'patch';
  }
  return 'none';
}

function formatCommit(commit: ConventionalCommit, commitUrlBase: string | null): string {
  const scope = commit.scope ? `**${commit.scope}:** ` : '';
  const reference = commit.references[0]
    ? ` (${commit.references[0].prefix}#${commit.references[0].issue})`
    : '';
  const referenceLink = commitUrlBase
    ? ` ([${commit.shortHash}](${commitUrlBase}/commit/${commit.hash}))`
    : ` (${commit.shortHash})`;

  return `- ${scope}${commit.description}${reference}${referenceLink}`;
}

/** A commit that carries the description a breaking change is required to state. */
interface BreakingCommit extends ConventionalCommit {
  readonly breakingDescription: string;
}

/**
 * Narrows a commit to one that states what it breaks.
 *
 * The description is mandatory in a breaking change footer, so a commit that lacks it cannot be
 * rendered in the Breaking Changes section and is not reported there at all.
 */
function statesBreakingChange(commit: ConventionalCommit): commit is BreakingCommit {
  return commit.breaking === true && typeof commit.breakingDescription === 'string';
}

/** Builds the Breaking Changes section, or `null` when the range declares no breaking change. */
function breakingSection(commits: readonly ConventionalCommit[]): ChangelogSection | null {
  const entries = commits
    .filter(statesBreakingChange)
    .map((commit) => `- ${commit.breakingDescription}`);

  if (entries.length === 0) return null;
  return { heading: 'Breaking Changes', entries };
}

/**
 * Groups the commits of a range by their changelog heading.
 *
 * Reverts are left out, because the release they describe is never a section of its own, and so are
 * breaking changes to types that never reach the operator — `chore`, `ci`, `build`, `style` and
 * `test` — since those are already covered by the Breaking Changes section.
 */
function groupByHeading(commits: readonly ConventionalCommit[]): Map<string, ConventionalCommit[]> {
  const grouped = new Map<string, ConventionalCommit[]>();

  for (const commit of commits) {
    if (commit.revert) continue;
    if (commit.breaking && NON_USER_FACING_TYPES.has(commit.type)) continue;

    const heading = SECTION_BY_TYPE[commit.type] ?? DEFAULT_SECTION_HEADING;
    const bucket = grouped.get(heading);
    if (bucket) {
      bucket.push(commit);
    } else {
      grouped.set(heading, [commit]);
    }
  }

  return grouped;
}

/** Renders the grouped commits as sections, in the fixed order a changelog is read in. */
function orderedSections(
  grouped: ReadonlyMap<string, readonly ConventionalCommit[]>,
  commitUrlBase: string | null,
): ChangelogSection[] {
  const sections: ChangelogSection[] = [];

  for (const heading of SECTION_ORDER) {
    const bucket = grouped.get(heading);
    if (!bucket || bucket.length === 0) continue;

    sections.push({
      heading,
      entries: bucket.map((commit) => formatCommit(commit, commitUrlBase)),
    });
  }

  return sections;
}

function collectSections(
  commits: readonly ConventionalCommit[],
  commitUrlBase: string | null,
): ChangelogSection[] {
  const sections = orderedSections(groupByHeading(commits), commitUrlBase);
  const breaking = breakingSection(commits);
  if (breaking) sections.unshift(breaking);
  return sections;
}

/**
 * Assembles the changelog entry for a version.
 *
 * @param commits - Conventional commits included in the release.
 * @param version - The version being released, without the leading `v`.
 * @param releaseType - How the version was derived.
 * @param previousTag - The previous release tag, used to build the comparison link.
 * @param urlBase - Repository base URL, or `null` when the remote cannot be resolved.
 * @returns The populated changelog entry.
 */
export function buildChangelogEntry(
  commits: readonly ConventionalCommit[],
  version: string,
  releaseType: ReleaseType,
  previousTag: string | null,
  urlBase: string | null,
): ChangelogEntry {
  const contributors = [...new Set(commits.map((commit) => commit.author))].sort((a, b) =>
    a.localeCompare(b),
  );

  return {
    version,
    date: new Date().toISOString().slice(0, 10),
    releaseType,
    compareUrl: urlBase && previousTag ? `${urlBase}/compare/${previousTag}...v${version}` : null,
    contributors,
    sections: collectSections(commits, urlBase),
  };
}

/**
 * Renders a changelog entry as Markdown.
 *
 * @param entry - The entry to render.
 * @returns Markdown for the section, including its headings and contributor list.
 */
export function renderChangelogEntry(entry: ChangelogEntry): string {
  const lines: string[] = [`[${entry.version}] — ${entry.date}`, ''];

  if (entry.compareUrl) {
    lines.push(`[Full changelog](${entry.compareUrl})`, '');
  }

  for (const section of entry.sections) {
    lines.push(`### ${section.heading}`, '');
    for (const item of section.entries) {
      lines.push(item);
    }
    lines.push('');
  }

  if (entry.contributors.length > 0) {
    lines.push(`**Contributors:** ${entry.contributors.join(', ')}`, '');
  }

  return lines.join('\n');
}
