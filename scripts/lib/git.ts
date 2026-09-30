import { compareSemVer, formatSemVer, parseSemVer, type SemVer } from './semver.ts';

const FIELD = '\u001f';
const RECORD = '\u001e';
const GIT_LOG_FORMAT = `${FIELD}%H${FIELD}%h${FIELD}%an${FIELD}%aI${FIELD}%s${FIELD}%B${RECORD}`;
const TAG_PATTERN = /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/;

export interface Commit {
  readonly hash: string;
  readonly shortHash: string;
  readonly author: string;
  readonly date: string;
  readonly subject: string;
  readonly body: string;
}

/** A version tag reachable in the repository. */
export interface ReleaseTag {
  readonly name: string;
  readonly commit: string;
  readonly date: string;
  readonly version: SemVer;
}

function run(args: readonly string[]): string {
  const command = new Deno.Command('git', { args: [...args], stdout: 'piped', stderr: 'piped' });
  const { code, stdout, stderr } = command.outputSync();

  if (code !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${new TextDecoder().decode(stderr).trim()}`);
  }

  return new TextDecoder().decode(stdout);
}

function tryRun(args: readonly string[]): string | null {
  try {
    return run(args);
  } catch {
    return null;
  }
}

export function isGitRepository(): boolean {
  return tryRun(['rev-parse', '--is-inside-work-tree'])?.trim() === 'true';
}

export function hasCommits(): boolean {
  return tryRun(['rev-parse', '--verify', '--quiet', 'HEAD']) !== null;
}

export function getCommits(fromExclusive: string | null, to = 'HEAD'): Commit[] {
  const range = fromExclusive ? `${fromExclusive}..${to}` : to;
  const raw = run(['log', range, `--format=${GIT_LOG_FORMAT}`]);

  return raw
    .split(RECORD)
    .map((record) => record.replace(/^\n+/, ''))
    .filter((record) => record.length > 0)
    .map((line) => {
      const record = line.startsWith(FIELD) ? line.slice(FIELD.length) : line;
      const [hash, shortHash, author, date, subject, rest = ''] = record.split(FIELD);
      return {
        hash: hash ?? '',
        shortHash: shortHash ?? '',
        author: author ?? '',
        date: date ?? '',
        subject: subject ?? '',
        body: (rest ?? '').replace(/\n+$/, ''),
      };
    });
}

export function getCommitDate(ref: string): string {
  return (tryRun(['log', '-1', '--format=%aI', ref])?.trim() ?? '').slice(0, 10);
}

export function getTags(): ReleaseTag[] {
  const raw = tryRun([
    'for-each-ref',
    `--format=%(refname:short)${FIELD}%(objectname)${FIELD}%(creatordate:iso-strict)`,
    'refs/tags',
  ]);

  if (!raw) {
    return [];
  }

  const tags: ReleaseTag[] = [];
  for (const line of raw.split('\n')) {
    const [name, commit, date] = line.split(FIELD);
    if (!name) continue;

    const match = TAG_PATTERN.exec(name);
    if (!match) continue;

    const version = parseSemVer(match[1] as string);
    if (!version) continue;

    tags.push({ name, commit: commit ?? '', date: date ?? '', version });
  }

  return tags.sort((a, b) => compareSemVer(b.version, a.version));
}

export function getLatestTag(): ReleaseTag | null {
  const output = tryRun(['describe', '--tags', '--abbrev=0', '--match', 'v*']);
  if (!output) {
    return null;
  }

  const name = output.trim();
  const version = parseSemVer(name.replace(/^v/, ''));
  if (!version) {
    return null;
  }

  return {
    name,
    version,
    commit: run(['rev-list', '-n', '1', name]).trim(),
    date: tryRun(['log', '-1', '--format=%aI', name])?.trim() ?? '',
  };
}

export function getRemoteUrl(remote: string): string | null {
  return tryRun(['remote', 'get-url', remote])?.trim() ?? null;
}

export function getRepositorySlug(remoteUrl: string): string | null {
  const sshPattern = /^(?:ssh:\/\/)?git@[^:]+[:/](.+?)(?:\.git)?$/;
  const httpPattern = /^(?:https?:\/\/)?[^/]+\/(.+?)(?:\.git)?$/;

  const match = sshPattern.exec(remoteUrl) ?? httpPattern.exec(remoteUrl);
  if (!match) {
    return null;
  }

  return match[1] as string;
}

export function getCurrentBranch(): string | null {
  return tryRun(['rev-parse', '--abbrev-ref', 'HEAD'])?.trim() ?? null;
}

export function isWorkingTreeClean(): boolean {
  return tryRun(['status', '--porcelain'])?.trim() === '';
}

export function hasStagedChanges(): boolean {
  const status = tryRun(['status', '--porcelain']);
  if (status === null) {
    return false;
  }
  return status
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .some((line) => line.startsWith('M ') || line.startsWith('A ') || line.startsWith('R '));
}

export function stageFiles(paths: readonly string[]): void {
  run(['add', '--', ...paths]);
}

export function commit(message: string): void {
  run(['commit', '-m', message]);
}

export function createTag(name: string, message: string): void {
  run(['tag', '-a', name, '-m', message]);
}

export function tagExists(name: string): boolean {
  return tryRun(['rev-parse', '--verify', '--quiet', `refs/tags/${name}`]) !== null;
}

export function toTagName(version: SemVer): string {
  return `v${formatSemVer(version)}`;
}
