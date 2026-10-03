import type { ComponentType, ReactNode } from 'react';
import { Component, type ErrorInfo, useEffect, useState } from 'react';
import { IconButton } from '@/components/buttons/IconButton';
import { useLocale } from '@/locale';
import { tryCatch } from '@/util/catch';
import { copyToClipboard } from '@/util/dom';
import { uuidv4 } from '@/util/uuid';

/**
 * A crash report.
 *
 * The fields a library can know about the browser are filled in here. Everything specific to the
 * application — its version, its configuration, the state an operator was looking at — comes from the
 * caller through {@link CrashGuardProps.getContext}, because a library cannot know any of it and a
 * report that omits the operator's context is rarely worth reading.
 */
export interface CrashReport {
  /** Unique per crash, so two reports for the same error are not deduplicated into one. */
  readonly reportId: string;
  /** The application version, as the caller reports it. */
  readonly appVersion: string;
  /** When the application started, so a report can be placed in a session. */
  readonly appStartDate: string;
  /** The page the crash happened on. */
  readonly uri: string;
  readonly userAgent: string;
  readonly language: string;
  readonly screenWidth: number;
  readonly screenHeight: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly cookiesEnabled: boolean;
  readonly onlineStatus: boolean;
  readonly timestamp: string;
  readonly errorMessage: string;
  readonly errorStack: string | null;
  readonly componentStack: string | null;
  /** The caller's own context. Serialized as JSON when the report is copied or submitted. */
  readonly context: string | null;
  readonly memory: {
    readonly totalJSHeapSize: number | null;
    readonly usedJSHeapSize: number | null;
    readonly jsHeapSizeLimit: number | null;
  };
}

/** The non-standard `performance.memory` extension, narrowed to the three fields read here. */
interface PerformanceMemory {
  readonly totalJSHeapSize: number;
  readonly usedJSHeapSize: number;
  readonly jsHeapSizeLimit: number;
}

/** Where an operator should send a report. Supplied by the caller; the library has no address. */
export interface CrashReportContact {
  readonly email?: string | undefined;
  /** An alternative destination, such as an issue tracker URL. Rendered as a second link. */
  readonly issueUrl?: string | undefined;
}

/**
 * Delivers a crash report.
 *
 * The library does not choose a transport: there is no endpoint, no protocol and no idea whether a
 * report should be posted, queued, mailed or logged. The caller returns a promise that resolves when
 * the report is safely delivered, and rejects to have it retried.
 */
export type CrashReportSubmitter = (report: CrashReport) => Promise<void>;

/**
 * What {@link AppCrashGuard} takes.
 *
 * Every prop is optional except `version` and `children`, because a guard with no destination still
 * has to work: with no `contact` the fallback shows the report and the operator copies it.
 */
export interface CrashGuardProps {
  readonly children: ReactNode;
  /** The application version, included in the report. */
  readonly version: string;
  /** When the application started. Defaults to now, which is only right for a report taken at once. */
  readonly startDate?: Date | undefined;
  /** Where the operator should send the report. Without it the fallback shows the report only. */
  readonly contact?: CrashReportContact | undefined;
  /**
   * The caller's own context for the report.
   *
   * Return a value that survives `JSON.stringify`. This is where an application puts the screen the
   * operator was on, the record they had selected, or whatever else makes a report actionable. It
   * is called once per crash, so it may be expensive; anything that throws is caught and recorded as
   * the context rather than being allowed to mask the original crash.
   */
  readonly getContext?: () => unknown;
  /** Called for every crash, before the fallback renders. Use it to submit or log the report. */
  readonly onCrash?: (report: CrashReport) => void;
  /** Replaces the whole fallback. Receives the report, which is `null` before the first effect runs. */
  readonly fallback?:
    | ComponentType<{
        error: Error;
        componentStack: string | null;
        report: CrashReport | null;
      }>
    | undefined;
}

/**
 * Catches a render error anywhere below it and shows a fallback instead of a blank page.
 *
 * This does not recover the application: the subtree is unmounted and the fallback replaces it, so
 * the operator has to reload. A crash guard that tried to keep the application running would leave it in
 * a state where the next interaction crashes somewhere else, which is harder to report than one honest
 * failure.
 *
 * A consumer that wants to send reports somewhere supplies `onCrash`; the library has no opinion where.
 */
/**
 * Wraps an application so an uncaught render error is reported instead of blanking the page.
 *
 * It does not rethrow, and it does not report to anywhere: the report is rendered, cached and handed
 * to `onCrash`, and {@link CrashReportQueue} is there to deliver it when the network works. What it
 * deliberately does not do is recover — an error boundary that swallowed the error and kept the
 * application running would be hiding a broken component from the operator who has to fix it.
 */
export function AppCrashGuard(props: CrashGuardProps) {
  return <ErrorBoundary fallbackComponent={DefaultCrashFallback} {...props} />;
}

function DefaultCrashFallback({
  contact,
  getContext,
  onCrash,
  startDate,
  version,
  error,
  componentStack,
}: DefaultCrashFallbackProps) {
  const { t } = useLocale();
  const [report, setReport] = useState<CrashReport | null>(null);

  // The effect runs once per crash, and the report describes the crash rather than the current
  // render: `version` and `startDate` are the facts of the session that failed, and `getContext` and
  // `onCrash` are caller callbacks that are new functions on every render. Depending on any of them
  // would rebuild and re-report a report that has not changed, so the dependency list is the crash
  // itself.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the effect reports one crash, keyed by the error it was handed.
  useEffect(() => {
    const built = buildCrashReport({ error, componentStack, version, startDate, getContext });
    setReport(built);

    if (onCrash !== undefined) {
      // A crash handler that throws must not replace the crash the operator is looking at with
      // a different one, so the failure is reported and swallowed.
      const [, handlerError] = tryCatch(() => {
        onCrash(built);
      });

      if (handlerError !== null) {
        console.error('The onCrash handler threw:', handlerError);
      }
    }

    console.error(error);
  }, [error, componentStack]);

  const reportJson = report === null ? '' : JSON.stringify(report, null, 2);

  return (
    <div className="fixed left-0 top-0 flex h-screen w-screen flex-col gap-8 p-2">
      <h1 className="text-tda text-4xl">{t('CrashGuard.title')}</h1>

      <div className="flex-grow overflow-auto">
        {contact?.email !== undefined && (
          <p className="text-tok">
            <strong>{t('CrashGuard.contactLabel')}:</strong>{' '}
            <a className="hover:underline hover:brightness-150" href={`mailto:${contact.email}`}>
              {contact.email}
            </a>
          </p>
        )}

        {contact?.issueUrl !== undefined && (
          <p className="text-tok">
            <strong>{t('CrashGuard.issueLabel')}:</strong>{' '}
            <a
              className="hover:underline hover:brightness-150"
              href={contact.issueUrl}
              rel="noreferrer"
              target="_blank"
            >
              {contact.issueUrl}
            </a>
          </p>
        )}

        <p className="border-tno text-tno mt-8 border-l-2 pl-2">
          {t('CrashGuidance.instructions')}
        </p>

        {report !== null && (
          <div className="mx-auto mt-8 flex max-w-[800px] items-start gap-2">
            <textarea
              className="bg-bin mt-2 h-64 w-full resize-none rounded-lg p-2"
              readOnly
              value={reportJson}
            />
            <IconButton
              icon="copy"
              className="rounded-full p-2"
              bgClassName="hover:bg-bse"
              iconClassName="fill-tpl size-5"
              rippleColor="var(--color-ripple-icon-button)"
              title={t('CrashGuard.copyReport')}
              onClick={() => copyToClipboard(reportJson)}
            />
          </div>
        )}

        <pre className="border-l-bda text-tda ml-2 mt-8 border-l-2 pl-4">
          {`${error.name}: ${error.message}\n${componentStack ?? ''}`}
        </pre>
      </div>
    </div>
  );
}

function buildCrashReport({
  error,
  componentStack,
  version,
  startDate,
  getContext,
}: {
  readonly error: Error;
  readonly componentStack: string | null;
  readonly version: string;
  readonly startDate: Date | undefined;
  readonly getContext: (() => unknown) | undefined;
}): CrashReport {
  // A `getContext` that throws still yields a report: the failure becomes part of the context
  // rather than costing the operator the whole thing.
  const [contextValue, contextError] = tryCatch(() =>
    getContext === undefined ? null : (JSON.stringify(getContext()) ?? null),
  );

  const context =
    contextError === null ? contextValue : JSON.stringify({ error: String(contextError) });

  return {
    reportId: uuidv4(),
    appVersion: version,
    appStartDate: (startDate ?? new Date()).toISOString(),
    timestamp: new Date().toISOString(),
    errorMessage: error.message,
    errorStack: error.stack ?? null,
    componentStack,
    context,
    memory: readHeapSize(),
    ...readEnvironment(),
  };
}

/**
 * What the browser could be asked about the machine the crash happened on.
 *
 * Every field is optional-chained and defaulted, because none of these globals exists outside a
 * browser: the report is built from a Node process during a test, and from a worker that has no
 * `screen`. An absent value is recorded as the neutral one rather than omitted, so a report always
 * has the same shape for whatever reads it.
 */
function readEnvironment() {
  const { location, navigator, screen, innerWidth, innerHeight } = globalThis;

  return {
    uri: location?.href ?? '',
    userAgent: navigator?.userAgent ?? '',
    language: navigator?.language ?? '',
    screenWidth: screen?.width ?? 0,
    screenHeight: screen?.height ?? 0,
    viewportWidth: innerWidth ?? 0,
    viewportHeight: innerHeight ?? 0,
    cookiesEnabled: navigator?.cookieEnabled ?? false,
    onlineStatus: navigator?.onLine ?? true,
  };
}

/** The heap figures the browser offers, or three nulls where the extension is not present. */
function readHeapSize(): CrashReport['memory'] {
  // `performance.memory` is a non-standard extension, so it is read through a narrowing cast rather
  // than by declaring the property exists.
  const memory = (globalThis.performance as { memory?: PerformanceMemory } | undefined)?.memory;

  return {
    totalJSHeapSize: memory?.totalJSHeapSize ?? null,
    usedJSHeapSize: memory?.usedJSHeapSize ?? null,
    jsHeapSizeLimit: memory?.jsHeapSizeLimit ?? null,
  };
}

/**
 * What the boundary hands the default fallback.
 *
 * The boundary always knows `version` — it is a required prop of the guard and is spread straight
 * through — so it is required here too, which is what lets the fallback put it in the report
 * without re-deriving it.
 */
type DefaultCrashFallbackProps = CrashGuardProps & {
  readonly error: Error;
  readonly componentStack: string | null;
};

interface ErrorBoundaryProps {
  readonly fallbackComponent: ComponentType<DefaultCrashFallbackProps>;
  readonly children: ReactNode;
  readonly version: string;
  readonly startDate?: Date | undefined;
  readonly contact?: CrashReportContact | undefined;
  readonly getContext?: () => unknown;
  readonly onCrash?: (report: CrashReport) => void;
  readonly fallback?: CrashGuardProps['fallback'] | undefined;
}

interface ErrorBoundaryState {
  readonly error: Error | null;
  readonly componentStack: string | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(properties: ErrorBoundaryProps) {
    super(properties);
    this.state = { error: null, componentStack: null };
  }

  static override getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error, componentStack: null };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ error, componentStack: errorInfo.componentStack ?? null });
  }

  override render(): ReactNode {
    const { error, componentStack } = this.state;
    if (error === null) {
      return this.props.children;
    }

    const { fallbackComponent: Fallback, ...fallbackProps } = this.props;
    return <Fallback error={error} componentStack={componentStack} {...fallbackProps} />;
  }
}

const MAX_CACHED_CRASH_REPORTS = 16;
const MAX_CRASH_REPORT_QUEUE = 8;

/** Where the last reports are cached, so they survive a reload that follows a crash. */
export const crashReportCacheKey = 'ui-kit.crashReports';
/** Where reports waiting to be delivered are held. */
export const crashReportQueueKey = 'ui-kit.crashReportQueue';

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // Storage being unavailable means reports cannot be cached. Delivering them live still works,
    // so this is not worth failing the crash over.
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // As above: a report that cannot be cached is a report that is not retried, not a crash.
  }
}

function readJson<T>(key: string): T | null {
  const raw = readStorage(key);
  if (raw === null) {
    return null;
  }

  // Cached data is whatever was in storage last time, so it is parsed defensively rather than
  // trusted: a truncated write or a value another application put under the same key is not this
  // module's to interpret.
  try {
    return JSON.parse(raw) as T;
  } catch {
    console.warn(`Discarding unreadable contents of ${key}.`);
    return null;
  }
}

/** Drops the oldest reports so the cache stays a fixed size. */
function cacheCrashReport(report: CrashReport): readonly CrashReport[] {
  const existing = readJson<CrashReport[]>(crashReportCacheKey) ?? [];
  const kept = [report, ...existing].slice(0, MAX_CACHED_CRASH_REPORTS);
  writeStorage(crashReportCacheKey, JSON.stringify(kept));
  return kept;
}

/**
 * The reports cached from earlier crashes, newest first.
 *
 * Read them from a fallback the operator is looking at to recover the detail of a crash that has
 * already happened, which is the case a crash report has to survive: the page that crashed is gone.
 */
export function readCachedCrashReports(): readonly CrashReport[] {
  return readJson<CrashReport[]>(crashReportCacheKey) ?? [];
}

/** Forgets every cached report. Reports not yet delivered by a {@link CrashReportQueue} are lost. */
export function clearCachedCrashReports(): void {
  writeStorage(crashReportCacheKey, JSON.stringify([]));
}

/**
 * An offline-tolerant queue of crash reports.
 *
 * A crash is exactly when the network is least likely to be working, so a report that is only sent
 * live is a report that is lost precisely when it matters. Each report is cached the moment it is
 * added, and delivery is retried for whatever is left over on the next run.
 *
 * The queue is deliberately not wired to anything: the caller supplies the transport, and decides when
 * to drain the queue. Nothing here runs on a timer or on application start.
 */
export class CrashReportQueue {
  private readonly queue = new Map<string, CrashReport>();
  private processing = false;

  /** Adds a report. It is cached immediately, whether or not it is ever delivered. */
  public add(report: CrashReport): void {
    this.queue.set(uuidv4(), report);
    cacheCrashReport(report);
  }

  /** The reports still waiting, oldest first. */
  public get size(): number {
    return this.queue.size;
  }

  /** Loads whatever a previous run left behind. */
  public load(): void {
    this.queue.clear();
    for (const [id, report] of readJson<[string, CrashReport][]>(crashReportQueueKey) ?? []) {
      this.queue.set(id, report);
    }
  }

  private save(): void {
    const entries = [...this.queue].slice(-MAX_CRASH_REPORT_QUEUE);
    writeStorage(crashReportQueueKey, JSON.stringify(entries));
  }

  /**
   * Delivers every queued report, stopping at the first failure.
   *
   * A partial drain is deliberate: the reports that failed stay queued in order for the next attempt,
   * so a backend that is down produces one failed run rather than a burst of retries. Returns the
   * reports that were not delivered.
   */
  public async process(submit: CrashReportSubmitter): Promise<readonly CrashReport[]> {
    if (this.processing) {
      return [...this.queue.values()];
    }

    this.processing = true;

    try {
      for (const [id, report] of this.queue) {
        try {
          await submit(report);
          this.queue.delete(id);
        } catch (submitError) {
          console.error('Could not deliver a crash report:', submitError);
          break;
        }
      }
    } finally {
      this.processing = false;
      this.save();
    }

    return [...this.queue.values()];
  }
}
