// Crash guard and reporter.
import type React from "react";
import {
	Component,
	type ErrorInfo,
	type ReactNode,
	useEffect,
	useState,
} from "react";
import { contacts } from "@/contact";
import {
	getSerializedGlobalState,
	getSerializedLocalStorage,
	getVersionString,
	global,
} from "@/def";
import { emitTypedEvent } from "@/event";
import { tryCatch } from "@/lib/catch";
import { copyToClipboard } from "@/lib/dom";
import { uuidv4 } from "@/lib/uuid";
import { IconButton } from "@/ui/button";

export function AppCrashGuard({
	children,
}: {
	readonly children: React.ReactNode;
}) {
	return (
		<ErrorBoundary FallbackComponent={ErrorGuard}>{children}</ErrorBoundary>
	);
}

function ErrorGuard({
	error,
	componentStack,
}: {
	readonly error: Error;
	readonly componentStack: string;
}) {
	const [crashReport, setCrashReport] = useState<CrashReport | null>(null);

	useEffect(() => {
		const crashReport: CrashReport = {
			reportId: uuidv4(),
			appVersion: getVersionString(),
			appStartDate: global.APP_START_TIME.toISOString(),
			uri: document.location.href,
			userAgent: navigator.userAgent,
			language: navigator.language,
			screenWidth: window.screen.width,
			screenHeight: window.screen.height,
			viewportWidth: window.innerWidth,
			viewportHeight: window.innerHeight,
			cookiesEnabled: navigator.cookieEnabled,
			localStorage: getSerializedLocalStorage(),
			onlineStatus: navigator.onLine,
			timestamp: new Date().toISOString(),
			errorMessage: error.message,
			errorStack: error.stack ?? null,
			componentStack: componentStack,
			globalState: getSerializedGlobalState(),
			memory: {
				// @ts-expect-error
				totalJSHeapSize: window.performance?.memory?.totalJSHeapSize ?? null,
				// @ts-expect-error
				usedJSHeapSize: window.performance?.memory?.usedJSHeapSize ?? null,
				// @ts-expect-error
				jsHeapSizeLimit: window.performance?.memory?.jsHeapSizeLimit ?? null,
			},
		};

		setCrashReport(crashReport);
		emitTypedEvent("NEW_APP_CRASH_REPORT", crashReport);

		console.error(error);
	}, [error, componentStack]);

	const crashReportJSON = JSON.stringify(crashReport);

	return (
		<div className="fixed left-0 top-0 flex h-screen w-screen flex-col gap-8 p-2">
			<h1 className="text-tda text-4xl">App Crashed</h1>
			<div className="flex-grow overflow-auto">
				<p className="text-tok">
					<strong>Crash Report Email:</strong>{" "}
					<a
						className="hover:underline hover:brightness-150"
						href={`mailto:${contacts.bugReportEmail}`}
					>
						{contacts.bugReportEmail}
					</a>
				</p>
				<p className="border-tno text-tno mt-8 border-l-2 pl-2">
					Please provide a step-by-step report of what caused the crash. Attach
					the report context in the box below.
				</p>
				<p className="border-tno text-tno mt-2 border-l-2 pl-2">
					Пожалуйста, предоставьте пошаговый отчет того, что привело к падению
					приложения. Прикрепите контекст отчета в поле внизу.
				</p>
				{crashReport !== null && (
					<div className="mx-auto mt-8 flex max-w-[800px] items-start gap-2">
						<textarea
							className="bg-bin mt-2 h-64 w-full resize-none rounded-lg p-2"
							readOnly
							value={crashReportJSON}
						/>
						<IconButton
							icon="copy"
							className="rounded-full p-2"
							bgClassName="hover:bg-bse"
							iconClassName="fill-tpl size-5"
							rippleColor="var(--color-ripple-icon-button)"
							title="Copy To Clipboard"
							onClick={() => copyToClipboard(crashReportJSON)}
						/>
					</div>
				)}
				<pre className="border-l-bda text-tda ml-2 mt-8 border-l-2 pl-4">
					{`Error: ${error.message} \n${componentStack}`}
				</pre>
			</div>
		</div>
	);
}

interface ErrorBoundaryProperties {
	readonly FallbackComponent: React.ComponentType<{
		error: Error;
		componentStack: string;
	}>;
	readonly children: ReactNode;
}

interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
	componentStack: string | null | undefined;
}

class ErrorBoundary extends Component<
	ErrorBoundaryProperties,
	ErrorBoundaryState
> {
	constructor(properties: ErrorBoundaryProperties) {
		super(properties);

		this.state = { hasError: false, error: null, componentStack: null };
	}

	static override getDerivedStateFromError(error: Error) {
		return { hasError: true, error };
	}

	override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		this.setState({ error, componentStack: errorInfo.componentStack });
	}

	override render() {
		const { FallbackComponent, children } = this.props;

		const { hasError, error, componentStack } = this.state;

		if (!hasError) {
			return children;
		}

		return (
			<FallbackComponent error={error!} componentStack={componentStack!} />
		);
	}
}

const MAX_CACHED_CRASH_REPORTS = 16;
const MAX_CRASH_REPORT_QUEUE = 8;
const DEFAULT_FETCH_TIMEOUT_MILLISECONDS = 5000;

export const lastCrashReportsLocaleStorageKey = "crashReportCache";
export const crashReportQueueLocalStorageKey = "crashReportQueue";

export interface CrashReport {
	reportId: string;
	appVersion: string;
	appStartDate: string;
	uri: string;
	userAgent: string;
	language: string;
	screenWidth: number;
	screenHeight: number;
	viewportWidth: number;
	viewportHeight: number;
	cookiesEnabled: boolean;
	localStorage: string;
	onlineStatus: boolean;
	timestamp: string;
	errorMessage: string;
	errorStack: string | null;
	componentStack: string | null;
	globalState: string;
	memory: {
		totalJSHeapSize: number | null;
		usedJSHeapSize: number | null;
		jsHeapSizeLimit: number | null;
	};
}

type CrashReportQueueType = [string, CrashReport][];

async function sendCrashReportToEndPoint(
	crashReportEndPoint: string,
	crashReport: CrashReport,
	timeout: number = DEFAULT_FETCH_TIMEOUT_MILLISECONDS,
): Promise<true> {
	const controller = new AbortController();
	const { signal } = controller;

	const timeoutPromise = new Promise<never>((_, reject) => {
		setTimeout(() => {
			controller.abort();
			reject(new Error("Fetch request timed out"));
		}, timeout);
	});

	try {
		const response = await Promise.race([
			fetch(crashReportEndPoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(crashReport),
				signal,
			}),
			timeoutPromise,
		]);

		if (!response.ok) {
			console.error("Failed to send crash report:", response.statusText);
			throw new Error(`Failed to send crash report: ${response.statusText}`);
		}

		return true;
	} catch (fetchError) {
		console.error("Error sending crash report:", fetchError);
		throw fetchError;
	}
}

function overwriteCrashReportsCache(crashReports: readonly CrashReport[]) {
	localStorage.setItem(
		lastCrashReportsLocaleStorageKey,
		JSON.stringify(crashReports),
	);
}

function loadCachedCrashReports() {
	const lastCrashReportsJSON = localStorage.getItem(
		lastCrashReportsLocaleStorageKey,
	);

	if (lastCrashReportsJSON === null) {
		return [];
	}

	const [lastCrashReports, parseError] = tryCatch(
		() => JSON.parse(lastCrashReportsJSON) as CrashReport[],
	);

	if (parseError !== null || lastCrashReports === null) {
		console.error("Failed to load crash reports cache");
		overwriteCrashReportsCache([]);
		return [];
	}

	return lastCrashReports;
}

function cacheCrashReport(crashReport: CrashReport) {
	const lastCrashReports = loadCachedCrashReports();

	const newReports = [...lastCrashReports, crashReport].slice(
		-MAX_CACHED_CRASH_REPORTS,
	);

	overwriteCrashReportsCache(newReports);
}

async function sendCachedCrashReports() {
	const lastCrashReports = loadCachedCrashReports();

	if (lastCrashReports.length === 0) {
		return;
	}

	const reportListPromises = await Promise.allSettled(
		lastCrashReports.map((report) => {
			const promises = contacts.crashReportEndPoints.map((endPoint) =>
				sendCrashReportToEndPoint(endPoint, report),
			);
			return Promise.any(promises);
		}),
	);

	const failedToSendReports = lastCrashReports.filter(
		(_, index) => reportListPromises[index]?.status !== "fulfilled",
	);

	const allFailed = failedToSendReports.length === lastCrashReports.length;

	if (allFailed) {
		return;
	}

	overwriteCrashReportsCache(failedToSendReports);
}

function loadQueueEntries() {
	try {
		return JSON.parse(
			localStorage.getItem(crashReportQueueLocalStorageKey) ?? "[]",
		) as CrashReportQueueType;
	} catch (error) {
		console.error(
			"Failed to load crash report queue",
			(error ?? "").toString(),
		);
		return [];
	}
}

function saveQueue(queue: Map<string, CrashReport>) {
	const entries = Array.from(queue.entries());
	const lastEntries = entries.slice(-MAX_CRASH_REPORT_QUEUE);
	const json = JSON.stringify(lastEntries);
	localStorage.setItem(crashReportQueueLocalStorageKey, json);
}

export class CrashReportQueue {
	private queue: Map<string, CrashReport>;
	private nextIdPart: number;
	private processing: boolean;
	private queueLocked: boolean;

	constructor() {
		this.queue = new Map<string, CrashReport>();
		this.nextIdPart = 0;
		this.processing = false;
		this.queueLocked = false;
	}

	private generateQueueId(report: CrashReport) {
		const id = `${uuidv4()}${new Date().toISOString()}${this.nextIdPart}${report.reportId}`;

		const newIdPart = this.nextIdPart + 1;

		if (newIdPart >= Number.MAX_SAFE_INTEGER) {
			this.nextIdPart = 0;
		} else {
			this.nextIdPart = newIdPart;
		}

		return id;
	}

	public add(report: CrashReport) {
		this.queueLocked = true;
		this.queue.set(this.generateQueueId(report), report);
		this.queueLocked = false;
	}

	public load() {
		this.queueLocked = true;
		this.queue = new Map<string, CrashReport>(loadQueueEntries());
		this.queueLocked = false;
	}

	public saveAndLock() {
		this.queueLocked = true;
		saveQueue(this.queue);
	}

	public async process() {
		if (this.processing) {
			return;
		}

		if (this.queueLocked) {
			return;
		}

		this.processing = true;

		try {
			const entries = Array.from(this.queue.entries());

			for (const [reportId, report] of entries) {
				cacheCrashReport(report);

				if (!this.queueLocked) {
					this.queue.delete(reportId);
				}
			}

			if (this.queueLocked) {
				return;
			}

			await sendCachedCrashReports();
		} catch (error) {
			console.error("Error processing crash reports:", error);
		} finally {
			this.processing = false;
		}
	}
}
