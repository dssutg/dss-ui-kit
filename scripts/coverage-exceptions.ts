/**
 * The code the coverage gate does not require.
 *
 * The gate holds the whole published source — `src/util/`, `src/components/` and the infrastructure
 * modules beside them — to a full 100%, every statement, branch, function and line, and an exception
 * here is the only way a published file leaves that requirement. It is deliberately a list of
 * named files with a stated reason rather than a percentage: a number can be met by covering the
 * easy half, while a name has to be justified, and the justification is what the next reader checks
 * when they wonder why a file is missing from the report.
 *
 * `scripts/coverage-exceptions.test.ts` reads this list and fails on an entry that names no file or
 * gives no reason, so an exception cannot be added quietly and cannot outlive the reason.
 */
export interface CoverageException {
  /** A repository-relative glob naming the code the gate does not read. */
  readonly path: string;
  /** Why the code cannot be held to the gate, in a sentence a reviewer can disagree with. */
  readonly reason: string;
}

export const COVERAGE_EXCEPTIONS: readonly CoverageException[] = [
  {
    path: 'src/util/testing/**',
    reason:
      'Test-only infrastructure, not library code: it renders a tree for a component test and ' +
      'installs the browser APIs jsdom omits. It is excluded from the published JSR source and ' +
      'reached only through the `dss-ui-kit/testing` subpath for npm. Its setup guards run only when ' +
      'a real browser already provides the API, which neither the node nor the jsdom test runtime ' +
      'does, and its error branches describe a failed render that a passing suite never produces.',
  },
];
