#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env
import {
  buildChangelogEntry,
  type ChangelogEntry,
  determineReleaseType,
  renderChangelogEntry,
} from './util/changelog.ts';
import { type ConventionalCommit, parseConventionalCommit } from './util/conventional.ts';
import {
  type Commit,
  createTag,
  getCommitDate,
  getCommits,
  getCurrentBranch,
  getLatestTag,
  getRemoteUrl,
  getRepositorySlug,
  getTags,
  commit as gitCommit,
  hasCommits,
  hasStagedChanges,
  isGitRepository,
  isWorkingTreeClean,
  type ReleaseTag,
  stageFiles,
  tagExists,
  toTagName,
} from './util/git.ts';
import {
  formatSemVer,
  incrementVersion,
  parseSemVer,
  type ReleaseType,
  type SemVer,
} from './util/semver.ts';

const PACKAGE_JSON = 'package.json';
const CHANGELOG_MD = 'CHANGELOG.md';

const CHANGELOG_HEADER = [
  '# Changelog',
  '',
  'All notable changes to this project are documented in this file.',
  '',
  'The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project',
  'adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Release notes are generated',
  'from [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) by `scripts/release.ts`.',
  '',
  '',
].join('\n');

const MERGE_SUBJECT_PATTERN = /^(Merge |Revert ")/;
const RELEVANT_TYPES = new Set([
  'feat',
  'fix',
  'perf',
  'refactor',
  'docs',
  'test',
  'build',
  'ci',
  'style',
  'chore',
]);

interface Options {
  readonly dryRun: boolean;
  readonly changelogOnly: boolean;
  readonly noTag: boolean;
  readonly noCommit: boolean;
  readonly skipLint: boolean;
  readonly remote: string;
  readonly forceType: ReleaseType | null;
  readonly help: boolean;
}

/**
 * The release types `--type` accepts, in the order the help text lists them.
 *
 * Typed as strings rather than as `ReleaseType[]` so that `includes` can be asked about an
 * arbitrary command-line value; {@link isReleaseType} is what turns that into a `ReleaseType`.
 */
const RELEASE_TYPES: readonly string[] = ['major', 'minor', 'patch', 'prerelease'];

/** Narrows a command-line value to a release type, so `--type` needs no assertion downstream. */
function isReleaseType(value: string): value is ReleaseType {
  return RELEASE_TYPES.includes(value);
}

/**
 * Reads the command line into options.
 *
 * The options are collected into local variables and returned as one object rather than mutated in
 * place, so the shape that comes back is checked against {@link Options} instead of being asserted
 * to it. An unrecognised or incomplete flag is an error: a release tool that silently ignored a
 * mistyped option would be worse than one that stops.
 */
function parseArgs(argv: readonly string[]): Options {
  let dryRun = false;
  let changelogOnly = false;
  let noTag = false;
  let noCommit = false;
  let skipLint = false;
  let remote = 'origin';
  let forceType: ReleaseType | null = null;
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    // A missing argument is not an option, so it falls through to the unknown-option error below
    // rather than needing a branch of its own.
    const arg = argv[index] ?? '';
    switch (arg) {
      case '-n':
      case '--dry-run':
        dryRun = true;
        break;
      case '--changelog-only':
        changelogOnly = true;
        break;
      case '--no-tag':
        noTag = true;
        break;
      case '--no-commit':
        noCommit = true;
        break;
      case '--skip-lint':
        skipLint = true;
        break;
      case '--remote': {
        const value = argv[index + 1];
        if (!value) throw new Error('--remote requires a value');
        remote = value;
        index += 1;
        break;
      }
      case '--type': {
        const value = argv[index + 1];
        if (value === undefined || !isReleaseType(value)) {
          throw new Error(`--type must be one of: ${RELEASE_TYPES.join(', ')}`);
        }
        forceType = value;
        index += 1;
        break;
      }
      case '-h':
      case '--help':
        help = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return { dryRun, changelogOnly, noTag, noCommit, skipLint, remote, forceType, help };
}

function printHelp(): void {
  console.log(`DSS UI Kit release — semantic versioning and changelog from Conventional Commits

Usage:
  deno task release [options]

Options:
  -n, --dry-run          Report the next version and changelog entry without writing anything
      --changelog-only   Rebuild CHANGELOG.md from the existing git history, do not version
      --type <level>     Force the release type (major, minor, patch, prerelease)
      --no-tag           Do not create the annotated git tag
      --no-commit        Do not create the release commit
      --remote <name>    Remote used to derive changelog links (default: origin)
      --skip-lint        Do not run the lint task before releasing
  -h, --help             Show this help

The release type is derived from Conventional Commits since the latest tag:
  breaking change -> major | feat -> minor | fix, perf -> patch | otherwise no release

A breaking change here is a substantial rework of the software or of one of its significant
interfaces; a UI change or an internal rename is a minor, not a break. See README.md.`);
}

function readPackageVersion(): SemVer {
  const pkg = JSON.parse(Deno.readTextFileSync(PACKAGE_JSON)) as { version?: string };
  if (!pkg.version) {
    throw new Error(`No "version" field in ${PACKAGE_JSON}`);
  }
  const version = parseSemVer(pkg.version);
  if (!version) {
    throw new Error(`"${pkg.version}" in ${PACKAGE_JSON} is not a valid semver version`);
  }
  return version;
}

function writePackageVersion(version: SemVer): void {
  const raw = Deno.readTextFileSync(PACKAGE_JSON);
  Deno.writeTextFileSync(
    PACKAGE_JSON,
    raw.replace(/("version"\s*:\s*)"[^"]+"/, `$1"${formatSemVer(version)}"`),
  );
}

function isRelevant(commit: Commit): boolean {
  return !MERGE_SUBJECT_PATTERN.test(commit.subject);
}

function collectCommits(
  fromExclusive: string | null,
  to: string,
): {
  conventional: ConventionalCommit[];
  unparsed: Commit[];
} {
  const conventional: ConventionalCommit[] = [];
  const unparsed: Commit[] = [];

  for (const commit of getCommits(fromExclusive, to)) {
    if (!isRelevant(commit)) continue;

    const parsed = parseConventionalCommit(commit);
    if (parsed) {
      if (RELEVANT_TYPES.has(parsed.type)) {
        conventional.push(parsed);
      }
    } else {
      unparsed.push(commit);
    }
  }

  return { conventional, unparsed };
}

function resolveUrlBase(remote: string): string | null {
  const url = getRemoteUrl(remote);
  if (!url) return null;

  const trimmed = url.replace(/\.git$/, '');

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  const sshMatch = /^(?:ssh:\/\/)?git@([^:/]+)[:/](.+)$/.exec(trimmed);
  if (sshMatch) {
    return `https://${sshMatch[1]}/${sshMatch[2]}`;
  }

  const slug = getRepositorySlug(trimmed);
  return slug ? `https://${trimmed}/${slug}` : null;
}

function buildEntry(
  commits: readonly ConventionalCommit[],
  version: string,
  releaseType: ReleaseType,
  previousTag: string | null,
  date: string,
  urlBase: string | null,
): ChangelogEntry {
  const entry = buildChangelogEntry(commits, version, releaseType, previousTag, urlBase);
  return { ...entry, date };
}

function renderFullChangelog(entries: readonly ChangelogEntry[]): string {
  const body = entries.map((entry) => renderChangelogEntry(entry)).join('\n');
  return `${CHANGELOG_HEADER}${body.trimEnd()}\n`;
}

function prependToChangelog(rendered: string): void {
  let existing = CHANGELOG_HEADER;
  try {
    existing = Deno.readTextFileSync(CHANGELOG_MD);
  } catch {
    /* the changelog is created on first release */
  }

  const body = existing.startsWith(CHANGELOG_HEADER)
    ? existing.slice(CHANGELOG_HEADER.length)
    : existing;
  const merged = `${CHANGELOG_HEADER}${rendered.trimStart()}\n${body.trimStart()}`;
  Deno.writeTextFileSync(CHANGELOG_MD, `${merged.trimEnd()}\n`);
}

function regenerateFullChangelog(urlBase: string | null): ChangelogEntry[] {
  const tags = getTags();
  if (tags.length === 0) {
    return [];
  }

  const ascending = [...tags].reverse();
  const entries: ChangelogEntry[] = [];
  let previousTag: ReleaseTag | null = null;

  for (const tag of ascending) {
    const { conventional } = collectCommits(previousTag?.commit ?? null, tag.commit);
    if (conventional.length > 0) {
      entries.push(
        buildEntry(
          conventional,
          formatSemVer(tag.version),
          determineReleaseType(conventional),
          previousTag?.name ?? null,
          getCommitDate(tag.name),
          urlBase,
        ),
      );
    }
    previousTag = tag;
  }

  return entries;
}

function runLint(): void {
  console.log('› running lint');
  const { code, stdout, stderr } = new Deno.Command('deno', {
    args: ['task', 'lint'],
    stdout: 'piped',
    stderr: 'piped',
  }).outputSync();

  if (code !== 0) {
    console.error(new TextDecoder().decode(stdout));
    console.error(new TextDecoder().decode(stderr));
    throw new Error('Lint failed — aborting the release');
  }
}

async function confirm(question: string): Promise<boolean> {
  console.log(`\n${question}`);
  const buffer = new Uint8Array(8);
  const read = await Deno.stdin.read(buffer);
  const answer = new TextDecoder()
    .decode(buffer.subarray(0, read ?? 0))
    .trim()
    .toLowerCase();
  return answer === 'y' || answer === 'yes';
}

function reportUnparsed(unparsed: readonly Commit[]): void {
  if (unparsed.length === 0) return;

  console.log('Commits that do not follow Conventional Commits (skipped when versioning):');
  for (const commit of unparsed) {
    console.log(`  ${commit.shortHash}  ${commit.subject}`);
  }
  console.log('');
}

/**
 * Everything a release needs once the commits of a range have been read.
 *
 * Bundling it keeps the steps below free of long parameter lists, and makes it obvious that the
 * version, the tag and the changelog are three views of one decision rather than three separate
 * calculations.
 */
interface ReleasePlan {
  readonly currentVersion: SemVer;
  readonly nextVersion: SemVer;
  readonly nextVersionString: string;
  readonly tagName: string;
  readonly releaseType: ReleaseType;
  readonly inferredType: ReleaseType;
  readonly commitCount: number;
  readonly latestTagName: string | null;
  readonly changelog: string;
}

/**
 * Decides what the next release would be.
 *
 * @returns The plan, or `null` when the range holds nothing worth releasing. Both "no commits" and
 * "no releasable types" are reported here, so the caller has a single decision to make.
 */
function planRelease(
  commits: readonly ConventionalCommit[],
  currentVersion: SemVer,
  latestTag: ReleaseTag | null,
  inferredType: ReleaseType,
  releaseType: ReleaseType,
  urlBase: string | null,
): ReleasePlan | null {
  const since = latestTag?.name ?? 'the first commit';

  if (commits.length === 0) {
    console.log('No Conventional Commits since', since, '— nothing to release.');
    return null;
  }
  if (releaseType === 'none') {
    console.log('No releasable changes since', since, '— nothing to release.');
    console.log('Use --type <major|minor|patch> to release anyway.');
    return null;
  }

  const nextVersion = incrementVersion(currentVersion, releaseType);
  const nextVersionString = formatSemVer(nextVersion);
  const entry = buildEntry(
    commits,
    nextVersionString,
    releaseType,
    latestTag?.name ?? null,
    new Date().toISOString().slice(0, 10),
    urlBase,
  );

  return {
    currentVersion,
    nextVersion,
    nextVersionString,
    tagName: toTagName(nextVersion),
    releaseType,
    inferredType,
    commitCount: commits.length,
    latestTagName: latestTag?.name ?? null,
    changelog: renderChangelogEntry(entry),
  };
}

/** Prints what the release would do, so it can be checked before anything is written. */
function printPlan(plan: ReleasePlan): void {
  console.log(`Latest tag:  ${plan.latestTagName ?? '(none)'}`);
  console.log(`Commits:     ${plan.commitCount}`);
  console.log(`Release:     ${plan.releaseType} (inferred: ${plan.inferredType})`);
  console.log(`Version:     ${formatSemVer(plan.currentVersion)} -> ${plan.nextVersionString}`);
  console.log(`Tag:         ${plan.tagName}`);
  console.log('');
  console.log(plan.changelog);
}

/**
 * Refuses to write over work in progress.
 *
 * Both checks are about not losing the operator's changes: a release commits and tags on their
 * behalf, so staged or uncommitted work would be swept into the release commit.
 */
function requireCleanWorktree(options: Options): void {
  if (hasStagedChanges()) {
    throw new Error('Refusing to release: changes are already staged — commit or reset them first');
  }
  if (!options.noCommit && !isWorkingTreeClean()) {
    throw new Error('Working tree is not clean — commit your changes before releasing');
  }
}

/** Writes the new version, commits it and tags it, honouring the --no-commit and --no-tag flags. */
function applyPlan(plan: ReleasePlan, options: Options): void {
  writePackageVersion(plan.nextVersion);
  prependToChangelog(plan.changelog);
  console.log(`Updated ${PACKAGE_JSON} and ${CHANGELOG_MD}`);

  if (!options.noCommit) {
    stageFiles([PACKAGE_JSON, CHANGELOG_MD]);
    gitCommit(`chore(release): ${plan.nextVersionString}`);
    console.log(`Committed release ${plan.nextVersionString}`);
  }

  if (options.noTag) return;
  if (tagExists(plan.tagName)) {
    console.log(`Tag ${plan.tagName} already exists — skipped`);
    return;
  }
  createTag(plan.tagName, `Release ${plan.nextVersionString}`);
  console.log(`Tagged ${plan.tagName}`);
}

/** Prints the command that publishes the release, since the tool deliberately does not push. */
function printNextSteps(remote: string): void {
  const branch = getCurrentBranch() ?? 'HEAD';
  console.log('');
  console.log('Next steps:');
  console.log(`  git push ${remote} ${branch} --follow-tags`);
}

/** Rebuilds CHANGELOG.md from every version tag, for --changelog-only. */
function rebuildChangelog(options: Options, urlBase: string | null): void {
  const entries = regenerateFullChangelog(urlBase);
  if (entries.length === 0) {
    console.log('No version tags found — nothing to regenerate.');
    return;
  }

  const rendered = renderFullChangelog(entries);
  const versions = entries.map((entry) => `v${entry.version}`).join(', ');
  console.log(`Rebuilding ${CHANGELOG_MD} from ${entries.length} tag(s): ${versions}`);

  if (options.dryRun) {
    console.log(rendered);
    return;
  }

  Deno.writeTextFileSync(CHANGELOG_MD, rendered);
  console.log(`Updated ${CHANGELOG_MD}`);
}

/** Derives the next version from the history and, unless this is a dry run, applies it. */
async function releaseNextVersion(options: Options, urlBase: string | null): Promise<void> {
  const latestTag = getLatestTag();
  const { conventional, unparsed } = collectCommits(latestTag?.commit ?? null, 'HEAD');
  reportUnparsed(unparsed);

  const inferredType = determineReleaseType(conventional);
  const releaseType = options.forceType ?? inferredType;

  const plan = planRelease(
    conventional,
    readPackageVersion(),
    latestTag,
    inferredType,
    releaseType,
    urlBase,
  );
  if (!plan) return;

  printPlan(plan);

  if (options.dryRun) {
    console.log('Dry run — nothing was modified.');
    return;
  }
  if (!(await confirm(`Release ${plan.nextVersionString}? [y/N] `))) {
    console.log('Aborted.');
    return;
  }
  if (!options.skipLint) runLint();

  requireCleanWorktree(options);
  applyPlan(plan, options);
  printNextSteps(options.remote);
}

async function main(): Promise<void> {
  const options = parseArgs(Deno.args);

  if (options.help) {
    printHelp();
    return;
  }

  if (!isGitRepository()) {
    throw new Error('Not a git repository — versions are derived from the git history');
  }
  if (!hasCommits()) {
    console.log('This repository has no commits yet — there is nothing to release.');
    console.log('Make the first commit and run the release again.');
    return;
  }

  const urlBase = resolveUrlBase(options.remote);
  if (!urlBase) {
    console.log(
      `Could not resolve the "${options.remote}" remote — changelog links will be omitted.`,
    );
  }

  if (options.changelogOnly) {
    rebuildChangelog(options, urlBase);
    return;
  }

  await releaseNextVersion(options, urlBase);
}

/**
 * The release tool: derives the next semantic version from Conventional Commits and writes the
 * version, changelog, commit and tag in one step.
 *
 * Run it through `deno task release`; see `deno task release --help` for the options.
 */
if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(`\n✖ ${error instanceof Error ? error.message : String(error)}`);
    Deno.exit(1);
  }
}
