// SPDX-License-Identifier: MIT
/**
 * The feedback group's contract, split the way the components are built: `Spinner`,
 * `ContinuousCircleSpinner`, `Ripple` and `ScrollProgressBar` are self-contained decoration that
 * must work without any provider around them; `DashedCircle` is the one feedback control that carries
 * an accessible name; and the `LogWidget` family is controlled — it reports play/pause and clear and
 * never holds output or playing state of its own. `CommandConsole` is the one group member with a shell
 * of its own: the commands are the caller's, and what the console owes them is a prompt, a history and
 * the two commands a shell cannot do without.
 */
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AppCrashGuard,
  type CrashGuardProps,
  type CrashReport,
  CrashReportQueue,
  clearCachedCrashReports,
  crashReportCacheKey,
  crashReportQueueKey,
  readCachedCrashReports,
} from '@/components/feedback/AppCrashGuard';
import {
  CommandConsole,
  type CommandConsoleCommand,
  type CommandConsoleContext,
  type CommandConsoleProps,
} from '@/components/feedback/CommandConsole';
import { ContinuousCircleSpinner } from '@/components/feedback/ContinuousCircleSpinner';
import { DashedCircle } from '@/components/feedback/DashedCircle';
import { LogOutputTextArea } from '@/components/feedback/LogOutputTextArea';
import { LogWidget } from '@/components/feedback/LogWidget';
import { Ripple } from '@/components/feedback/Ripple';
import { ScrollProgressBar } from '@/components/feedback/ScrollProgressBar';
import { Spinner } from '@/components/feedback/Spinner';
import { act, click, render, type } from '@/util/testing/render';

describe('AppCrashGuard', () => {
  /** Throws during render, which is the only way a boundary has anything to catch. */
  function Exploding({ explode }: { readonly explode: boolean }): React.JSX.Element {
    if (explode) {
      throw new Error('component exploded');
    }
    return <p>intact</p>;
  }

  /** Throws an error that has lost its stack, the way an engine without stack traces reports one. */
  function ExplodesWithoutAStack(): React.JSX.Element {
    const error = new Error('component exploded');

    Object.defineProperty(error, 'stack', { value: undefined });

    throw error;
  }

  it('renders its children while nothing has thrown', async () => {
    const { find } = await render(
      <AppCrashGuard version="1.0.0">
        <p>application</p>
      </AppCrashGuard>,
    );

    expect(find('p').textContent).toBe('application');
  });

  it('shows the default fallback in place of the subtree that threw', async () => {
    const { find, textContent } = await render(
      <AppCrashGuard version="1.0.0">
        <Exploding explode={true} />
      </AppCrashGuard>,
    );

    // The crashed subtree is gone rather than left on screen next to the report.
    expect(textContent()).not.toContain('intact');
    expect(find('pre').textContent).toContain('component exploded');
  });

  it('renders the fallback the caller supplied, rather than the default one', async () => {
    // The bug this pins down: `fallback` was spread into the boundary as a prop named `fallback`,
    // which nothing read, so the default fallback rendered whatever the caller passed.
    const { find, query } = await render(
      <AppCrashGuard version="1.0.0" fallback={({ error }) => <p>handled: {error.message}</p>}>
        <Exploding explode={true} />
      </AppCrashGuard>,
    );

    expect(find('p').textContent).toBe('handled: component exploded');
    expect(query('pre')).toBeNull();
  });

  it("hands the caller's fallback the report it built for the crash", async () => {
    const { find } = await render(
      <AppCrashGuard
        version="2.3.4"
        getContext={() => ({ screen: 'devices' })}
        fallback={({ report }) => <p>report: {report?.errorMessage ?? 'none'}</p>}
      >
        <Exploding explode={true} />
      </AppCrashGuard>,
    );

    // The report arrives rather than staying `null`: `t()` and the rest of the contract say a caller
    // that replaces the fallback is still given the report, so it does not have to rebuild one.
    expect(find('p').textContent).toBe('report: component exploded');
  });

  it('calls onCrash once with the report, whichever fallback renders', async () => {
    const onCrash = vi.fn();

    await render(
      <AppCrashGuard version="1.0.0" onCrash={onCrash} fallback={() => <p>handled</p>}>
        <Exploding explode={true} />
      </AppCrashGuard>,
    );

    expect(onCrash).toHaveBeenCalledTimes(1);
    expect(onCrash.mock.calls[0]?.[0]).toMatchObject({
      appVersion: '1.0.0',
      errorMessage: 'component exploded',
    });
  });

  it('does not let a throwing onCrash replace the crash the operator is looking at', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { find } = await render(
      <AppCrashGuard
        version="1.0.0"
        onCrash={() => {
          throw new Error('the handler failed');
        }}
      >
        <Exploding explode={true} />
      </AppCrashGuard>,
    );

    expect(find('pre').textContent).toContain('component exploded');
    consoleError.mockRestore();
  });

  it("merges a className over the fallback's own", async () => {
    const { find } = await render(
      <AppCrashGuard version="1.0.0" className="h-12 border border-red-500">
        <Exploding explode={true} />
      </AppCrashGuard>,
    );

    // The fallback root is the one covering the viewport it replaced. `h-12` has to beat its own
    // `h-screen`, which is what `cn` merging rather than concatenating means; a class that does not
    // conflict would survive either way and prove nothing.
    const fallbackRoot = find('div.fixed');
    expect(fallbackRoot.className).toContain('h-12');
    expect(fallbackRoot.className).not.toContain('h-screen');
    expect(fallbackRoot.className).toContain('flex');
  });

  /** Renders the guard over a subtree that throws and returns every report `onCrash` received. */
  async function crashWith(props: Partial<CrashGuardProps>): Promise<readonly CrashReport[]> {
    const reports: CrashReport[] = [];

    await render(
      <AppCrashGuard
        version="1.0.0"
        onCrash={(report) => {
          reports.push(report);
        }}
        {...props}
      >
        <Exploding explode={true} />
      </AppCrashGuard>,
    );

    return reports;
  }

  it('offers the contact email when the caller gave one', async () => {
    const { find, query } = await render(
      <AppCrashGuard version="1.0.0" contact={{ email: 'ops@example.com' }}>
        <Exploding explode={true} />
      </AppCrashGuard>,
    );

    const emailLink = find('a[href^="mailto:"]');

    expect(emailLink.textContent).toBe('ops@example.com');
    // The report is there for the operator to copy, whatever contact is offered.
    expect(find<HTMLTextAreaElement>('textarea').value).toContain('"appVersion": "1.0.0"');
    expect(query('a[rel="noreferrer"]')).toBeNull();
  });

  it('offers the issue tracker link when the caller gave one', async () => {
    const { find, query } = await render(
      <AppCrashGuard version="1.0.0" contact={{ issueUrl: 'https://example.com/issues' }}>
        <Exploding explode={true} />
      </AppCrashGuard>,
    );

    const issueLink = find('a[rel="noreferrer"]');

    expect(issueLink.textContent).toBe('https://example.com/issues');
    // The link opens in a tab an operator can keep; the mail link is not rendered beside it.
    expect(issueLink.getAttribute('target')).toBe('_blank');
    expect(query('a[href^="mailto:"]')).toBeNull();
  });

  it('records a context a getContext that returns nothing as null, rather than the string "undefined"', async () => {
    const reports = await crashWith({ getContext: () => undefined });

    expect(reports[0]?.context).toBeNull();
  });

  it('keeps a crash reportable even when getContext itself throws', async () => {
    const reports = await crashWith({
      getContext: () => {
        throw new Error('the context blew up');
      },
    });

    // The failure of the context is the context, and the original crash is beside it unchanged.
    expect(reports[0]?.context).toContain('the context blew up');
    expect(reports[0]?.errorMessage).toBe('component exploded');
  });

  it('reports the application start date the caller gives it', async () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const reports = await crashWith({ startDate });

    expect(reports[0]?.appStartDate).toBe('2026-01-01T00:00:00.000Z');
  });

  it('records an absent error stack as null, for engines that do not carry one', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const reports: CrashReport[] = [];

      await render(
        <AppCrashGuard
          version="1.0.0"
          onCrash={(report) => {
            reports.push(report);
          }}
        >
          <ExplodesWithoutAStack />
        </AppCrashGuard>,
      );

      expect(reports[0]?.errorStack).toBeNull();
      expect(reports[0]?.errorMessage).toBe('component exploded');
    } finally {
      consoleError.mockRestore();
    }
  });

  it('records the environment there is nothing to ask for, from a page with no browser around it', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const originals = [
      'location',
      'navigator',
      'performance',
      'screen',
      'innerWidth',
      'innerHeight',
    ].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);

    try {
      for (const [key] of originals) {
        Object.defineProperty(globalThis, key, { value: undefined, configurable: true });
      }

      const reports = await crashWith({});

      // Every field the report carries about the machine is the neutral one, so the report has the
      // same shape as one taken where the browser answered.
      expect(reports[0]?.uri).toBe('');
      expect(reports[0]?.userAgent).toBe('');
      expect(reports[0]?.language).toBe('');
      expect(reports[0]?.screenWidth).toBe(0);
      expect(reports[0]?.screenHeight).toBe(0);
      expect(reports[0]?.viewportWidth).toBe(0);
      expect(reports[0]?.viewportHeight).toBe(0);
      expect(reports[0]?.cookiesEnabled).toBe(false);
      expect(reports[0]?.onlineStatus).toBe(true);
      expect(reports[0]?.memory).toEqual({
        totalJSHeapSize: null,
        usedJSHeapSize: null,
        jsHeapSizeLimit: null,
      });
    } finally {
      for (const [key, descriptor] of originals) {
        if (descriptor !== undefined) {
          Object.defineProperty(globalThis, key, descriptor);
        }
      }

      consoleError.mockRestore();
    }
  });

  it('copies the report to the clipboard when its icon button is clicked', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const writeText = vi.fn<(text: string) => Promise<void>>();
    writeText.mockResolvedValue(undefined);

    const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

    try {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      });

      const { find } = await render(
        <AppCrashGuard version="1.0.0" contact={{ email: 'ops@example.com' }}>
          <Exploding explode={true} />
        </AppCrashGuard>,
      );

      // The copy button belongs to the fallback the operator is reading the report on.
      const copyButton = find('button[title="Copy the report"]');

      await click(copyButton);

      expect(copyButton.getAttribute('aria-label')).toBe('Copy the report');
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(writeText.mock.calls[0]?.[0]).toContain('"errorMessage": "component exploded"');
    } finally {
      if (clipboardDescriptor === undefined) {
        Reflect.deleteProperty(navigator, 'clipboard');
      } else {
        Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
      }

      consoleError.mockRestore();
    }
  });
});

/** A crash report with only its identity filled in, enough for a queue or a cache round trip. */
function sampleReport(id: string): CrashReport {
  return {
    reportId: id,
    appVersion: '1.0.0',
    appStartDate: '2026-01-01T00:00:00.000Z',
    uri: 'https://example.com/chart',
    userAgent: 'jsdom',
    language: 'en',
    screenWidth: 1024,
    screenHeight: 768,
    viewportWidth: 1024,
    viewportHeight: 768,
    cookiesEnabled: false,
    onlineStatus: true,
    timestamp: '2026-01-01T00:00:01.000Z',
    errorMessage: id,
    errorStack: null,
    componentStack: null,
    context: null,
    memory: { totalJSHeapSize: null, usedJSHeapSize: null, jsHeapSizeLimit: null },
  };
}

/** The count of entries under the queue key, for an assertion about how much storage holds. */
function storedQueueEntries(): readonly unknown[] {
  const raw = localStorage.getItem(crashReportQueueKey);

  if (raw === null) {
    return [];
  }

  const entries: unknown = JSON.parse(raw);

  if (!Array.isArray(entries)) {
    throw new Error('the queue storage did not hold an array');
  }

  return entries;
}

describe('the crash report cache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns nothing while there is nothing cached', () => {
    expect(readCachedCrashReports()).toEqual([]);
  });

  it('returns the cached reports newest first and never past its sixteen', () => {
    for (let added = 1; added <= 20; added++) {
      const queue = new CrashReportQueue();
      queue.add(sampleReport(`crash ${added}`));
    }

    const cached = readCachedCrashReports();

    expect(cached).toHaveLength(16);
    expect(cached[0]?.errorMessage).toBe('crash 20');
    expect(cached.at(-1)?.errorMessage).toBe('crash 5');
  });

  it('forgets every cached report when cleared', () => {
    const queue = new CrashReportQueue();
    queue.add(sampleReport('crash 1'));

    clearCachedCrashReports();

    expect(readCachedCrashReports()).toEqual([]);
  });

  it('discards storage another application put under the same key, rather than reading it', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      localStorage.setItem(crashReportCacheKey, '{ this is not a list of reports');

      expect(readCachedCrashReports()).toEqual([]);
      expect(consoleWarn).toHaveBeenCalledWith(
        `Discarding unreadable contents of ${crashReportCacheKey}.`,
      );
    } finally {
      consoleWarn.mockRestore();
    }
  });

  it('keeps working when storage is unavailable, and reports nothing cached', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

    try {
      if (storageDescriptor === undefined) {
        throw new Error('the test environment left localStorage undefined');
      }

      const unavailableStorage = {
        getItem: () => {
          throw new Error('storage is unavailable');
        },
        setItem: () => {
          throw new Error('storage is unavailable');
        },
      };

      Object.defineProperty(globalThis, 'localStorage', {
        value: unavailableStorage,
        configurable: true,
      });

      const queue = new CrashReportQueue();

      // A report that cannot be cached is not a reason for adding one to fail.
      expect(() => {
        queue.add(sampleReport('crash 1'));
      }).not.toThrow();
      expect(queue.size).toBe(1);
      expect(readCachedCrashReports()).toEqual([]);
      expect(consoleWarn).not.toHaveBeenCalled();
    } finally {
      if (storageDescriptor !== undefined) {
        Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
      }

      consoleWarn.mockRestore();
    }
  });
});

describe('CrashReportQueue', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('caches a report the moment it is added, so a crash is not lost before delivery', () => {
    const queue = new CrashReportQueue();
    const report = sampleReport('crash 1');

    queue.add(report);

    expect(queue.size).toBe(1);
    expect(readCachedCrashReports().map((cached) => cached.errorMessage)).toEqual(['crash 1']);
  });

  it('delivers every queued report and returns what it could not deliver, which is nothing', async () => {
    const queue = new CrashReportQueue();
    queue.add(sampleReport('first'));
    queue.add(sampleReport('second'));

    const delivered: string[] = [];
    const remaining = await queue.process(async (report) => {
      delivered.push(report.errorMessage);
      await Promise.resolve();
    });

    expect(delivered).toEqual(['first', 'second']);
    expect(remaining).toEqual([]);
    expect(queue.size).toBe(0);
    expect(storedQueueEntries()).toEqual([]);
  });

  it('stops delivering at the first failure and keeps the rest queued for the next run', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const queue = new CrashReportQueue();
      queue.add(sampleReport('first'));
      queue.add(sampleReport('second'));

      const submitted: string[] = [];
      const remaining = await queue.process(async (report) => {
        submitted.push(report.errorMessage);

        if (report.errorMessage === 'first') {
          // A transport that is down rejects what it was handed.
          await Promise.reject(new Error('the backend is down'));
        }
      });

      expect(submitted).toEqual(['first']);
      expect(remaining.map((report) => report.errorMessage)).toEqual(['first', 'second']);
      expect(consoleError).toHaveBeenCalledTimes(1);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('answers a call that arrives while a delivery is still in flight, without starting another', async () => {
    const queue = new CrashReportQueue();
    queue.add(sampleReport('in flight'));

    let releaseDelivery: () => void = () => undefined;
    const deliveryGate = new Promise<void>((resolve) => {
      releaseDelivery = resolve;
    });

    const inFlight = queue.process(async () => {
      await deliveryGate;
    });

    // The reentrant call reads the queue it finds instead of a second drain.
    const reentrant = await queue.process(async () => undefined);

    expect(reentrant.map((report) => report.errorMessage)).toEqual(['in flight']);

    releaseDelivery();
    expect(await inFlight).toEqual([]);
  });

  it('keeps the last eight in storage, so a queue that never drains stays restorable', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const queue = new CrashReportQueue();
      for (let added = 1; added <= 10; added++) {
        queue.add(sampleReport(`crash ${added}`));
      }

      // A submit that always fails leaves the queue as it is; the save at the end of a run is what
      // gets it into storage.
      await queue.process(async () => {
        await Promise.reject(new Error('the backend is down'));
      });

      const entries = storedQueueEntries();
      expect(entries).toHaveLength(8);

      // The last eight are what a next run picks up, oldest of the eight first.
      const restored = new CrashReportQueue();
      restored.load();

      expect(restored.size).toBe(8);

      const delivered: string[] = [];
      await restored.process(async (report) => {
        delivered.push(report.errorMessage);
        await Promise.resolve();
      });

      expect(delivered).toEqual([
        'crash 3',
        'crash 4',
        'crash 5',
        'crash 6',
        'crash 7',
        'crash 8',
        'crash 9',
        'crash 10',
      ]);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('loads whatever a previous run left behind', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const queue = new CrashReportQueue();
      queue.add(sampleReport('first'));
      queue.add(sampleReport('second'));

      // A run that cannot deliver leaves its queue in storage for the next one.
      await queue.process(async () => {
        await Promise.reject(new Error('the backend is down'));
      });

      const nextRun = new CrashReportQueue();
      expect(nextRun.size).toBe(0);

      nextRun.load();
      expect(nextRun.size).toBe(2);

      const delivered: string[] = [];
      await nextRun.process(async (report) => {
        delivered.push(report.errorMessage);
        await Promise.resolve();
      });

      expect(delivered).toEqual(['first', 'second']);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('loads nothing when there is nothing in storage', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const queue = new CrashReportQueue();

      queue.load();

      expect(queue.size).toBe(0);
      expect(consoleWarn).not.toHaveBeenCalled();
    } finally {
      consoleWarn.mockRestore();
    }
  });
});

describe('Spinner', () => {
  it('renders without a provider, a theme or a locale', async () => {
    const { find } = await render(<Spinner />);

    expect(find('div')).toBeDefined();
  });
});

describe('ContinuousCircleSpinner', () => {
  it('is indeterminate: it takes no percentage and only draws a rotating ring', async () => {
    const { container } = await render(<ContinuousCircleSpinner />);

    const spinner = container.querySelector('div');

    expect(spinner?.className).toContain('animate-spin');
    expect(spinner?.getAttribute('role')).toBeNull();
  });
});

describe('DashedCircle', () => {
  it('is named by its title rather than by its shape', async () => {
    const { container } = await render(<DashedCircle title="Connected" />);

    const svg = container.querySelector('svg');

    if (svg === null) {
      throw new Error('DashedCircle rendered no svg.');
    }

    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Connected');
  });

  it('draws no ring while inactive', async () => {
    const { container } = await render(<DashedCircle active={false} title="Connected" />);

    expect(container.querySelector('animate')).toBeNull();
  });
});

describe('Ripple', () => {
  it('is decorative, so it takes no place in the accessibility tree', async () => {
    const { container } = await render(<Ripple color="#fff" />);

    expect(container.querySelector('span')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps one circle per click while each is still running', async () => {
    const { container } = await render(
      <button type="button" className="relative overflow-hidden">
        <Ripple color="#fff" />
      </button>,
    );

    const button = container.querySelector('button');

    if (button === null) {
      throw new Error('Ripple rendered no button to sit in.');
    }

    click(button);
    click(button);

    expect(container.querySelectorAll('.animate-ripple').length).toBe(2);
  });

  it('renders nothing when its colour is empty, so a caller can turn the effect off', async () => {
    const { container } = await render(<Ripple color="" />);

    expect(container.querySelector('span')).toBeNull();
  });

  it('leaves the ripple off when its host has no parent yet, rather than throwing', async () => {
    const { container, update } = await render(<Ripple color="#fff" duration={600} />);

    const host = container.querySelector('span');

    if (host === null) {
      throw new Error('Ripple rendered no host span.');
    }

    // An ancestor outside React can detach the host while the tree stays mounted, so the effect runs
    // again with nowhere to attach its listener.
    host.remove();
    await update(<Ripple color="#fff" duration={700} />);

    container.appendChild(host);
    click(host);

    expect(container.querySelectorAll('.animate-ripple').length).toBe(0);
  });
});

describe('ScrollProgressBar', () => {
  it('renders the track it fills', async () => {
    const { container } = await render(<ScrollProgressBar />);

    expect(container.querySelectorAll('div').length).toBeGreaterThan(1);
  });
});

/**
 * A log output an operator reads while something streams: read-only so a caret cannot sit in it, and
 * wrapping only as asked, since a log the operator lines up by column breaks under soft wrapping.
 */
describe('LogOutputTextArea', () => {
  it('shows the output and refuses to be typed into', async () => {
    const { find } = await render(<LogOutputTextArea output={'first line\nsecond line'} />);

    const textarea = find<HTMLTextAreaElement>('textarea');

    expect(textarea.value).toBe('first line\nsecond line');
    expect(textarea.readOnly).toBe(true);
  });

  it('stops wrapping long lines only when asked', async () => {
    const { find, update } = await render(<LogOutputTextArea output="x" />);

    expect(find('textarea').className).not.toContain('whitespace-pre');

    await update(<LogOutputTextArea output="x" dontWrapLongLines={true} />);

    expect(find('textarea').className).toContain('whitespace-pre');
  });

  it('follows the end on an update when the caller asked it to', async () => {
    const { find, update } = await render(
      <LogOutputTextArea output="first" shouldScrollToEndOnUpdate={true} />,
    );

    await update(<LogOutputTextArea output={'first\nsecond'} shouldScrollToEndOnUpdate={true} />);

    expect(find<HTMLTextAreaElement>('textarea').value).toBe('first\nsecond');
  });

  it('holds the position of a reader who is scrolled back, rather than dragging them to the end', async () => {
    const { find, update } = await render(<LogOutputTextArea output="first" />);

    const textarea = find<HTMLTextAreaElement>('textarea');
    let scrollTop = 0;

    // jsdom does no layout, so the geometry the follow test reads is stubbed here: a tall scrollback
    // whose top the caret is at is a reader who has deliberately scrolled away from the end.
    Object.defineProperty(textarea, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(textarea, 'clientHeight', { value: 0, configurable: true });
    Object.defineProperty(textarea, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });

    await update(<LogOutputTextArea output={'first\nsecond'} />);

    expect(textarea.scrollTop).toBe(0);
  });
});

/**
 * The widget is controlled throughout: `playing` decides which action the button reports, and the
 * output is only ever displayed, never cleared by the widget itself.
 */
describe('LogWidget', () => {
  it('reports play or pause depending on what it is doing, rather than toggling itself', async () => {
    const onPlayClick = vi.fn();
    const onPauseClick = vi.fn();
    const { find, findByText, update } = await render(
      <LogWidget
        title="Output"
        playing={true}
        output="ready"
        onPlayClick={onPlayClick}
        onPauseClick={onPauseClick}
        onClearClick={() => undefined}
      />,
    );

    expect(findByText('Output')).toBeDefined();
    expect(find<HTMLTextAreaElement>('textarea').value).toBe('ready');

    await click(find<HTMLButtonElement>('button'));

    expect(onPauseClick).toHaveBeenCalledTimes(1);
    expect(onPlayClick).not.toHaveBeenCalled();

    await update(
      <LogWidget
        title="Output"
        playing={false}
        output="ready"
        onPlayClick={onPlayClick}
        onPauseClick={onPauseClick}
        onClearClick={() => undefined}
      />,
    );

    await click(find<HTMLButtonElement>('button'));

    expect(onPlayClick).toHaveBeenCalledTimes(1);
  });

  it('reports a request to clear without clearing the output itself', async () => {
    const onClearClick = vi.fn();
    const { findAll, find } = await render(
      <LogWidget
        title="Output"
        playing={false}
        output="still here"
        onPlayClick={() => undefined}
        onPauseClick={() => undefined}
        onClearClick={onClearClick}
      />,
    );

    await click(findAll<HTMLButtonElement>('button')[1] as HTMLButtonElement);

    expect(onClearClick).toHaveBeenCalledTimes(1);
    expect(find<HTMLTextAreaElement>('textarea').value).toBe('still here');
  });
});

describe('CommandConsole', () => {
  /**
   * A console with a few commands of the caller's, the way an application would supply them: each one
   * says what it does and echoes what it was given.
   */
  const commands: Record<string, CommandConsoleCommand> = {
    echo: {
      about: 'Echo the arguments back',
      usage: ({ commandName }) => [`${commandName} <text>`],
      execute: ({ args, echo: echoFromCommand }) => {
        echoFromCommand(`echoed: ${args.slice(1).join(' ')}`);
      },
    },
    count: {
      about: 'Report how many lines have been run',
      execute: ({ history, echo: echoFromCommand }) => {
        echoFromCommand(`run before this one: ${history.length}`);
      },
    },
    rename: {
      about: 'Say something else',
      usage: ['rename <text>'],
      execute: ({ args, echo: echoFromCommand }) => {
        echoFromCommand(`renamed to: ${args.slice(1).join(' ')}`);
      },
    },
    secret: {
      about: 'Do something only a developer may',
      requiresDeveloper: true,
      execute: ({ echo: echoFromCommand }) => {
        echoFromCommand('the secret');
      },
    },
    quiet: {
      about: 'Do nothing anyone should see listed',
      hidden: true,
      execute: ({ echo: echoFromCommand }) => {
        echoFromCommand('quietly done');
      },
    },
  };

  /** A console with the caller's commands registered, plus whatever a test changes about it. */
  function console(props: Partial<CommandConsoleProps> = {}) {
    return (
      <CommandConsole open={true} onOpenChange={() => undefined} commands={commands} {...props} />
    );
  }

  /** The output pane, which is where everything a command said ends up. */
  function output() {
    return document.body.querySelector('textarea')?.value ?? '';
  }

  /** Types a line and presses Enter, which is the whole interaction. */
  async function run(line: string) {
    const input = document.body.querySelector('input') as HTMLInputElement;

    await type(input, line);
    pressKey(input, 'Enter');
  }

  /** Presses a key at the prompt, with a modifier where one is named. */
  function pressKey(input: HTMLInputElement, key: string, ctrlKey = false) {
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { code: key, ctrlKey, bubbles: true }));
    });
  }

  it('renders nothing at all while closed', async () => {
    const { container } = await render(
      <CommandConsole open={false} onOpenChange={() => undefined} commands={commands} />,
    );

    expect(container.textContent).toBe('');
  });

  it('asks to close on Escape, because the caller owns what is open', async () => {
    const onOpenChange = vi.fn();
    await render(<CommandConsole open={true} onOpenChange={onOpenChange} commands={commands} />);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('runs the command the caller registered and echoes what it said', async () => {
    await render(console());

    await run('echo hello');

    // The line is echoed before the output, because a console that ran something the operator cannot
    // see is a console they cannot trust.
    expect(output()).toBe('> echo hello\nechoed: hello');
  });

  it('reports a name it does not hold, rather than doing nothing', async () => {
    await render(console());

    await run('nope');

    expect(output()).toContain('nope');
  });

  it('lists what the caller registered, and not what it hid', async () => {
    await render(console());

    await run('help');

    const help = output();

    expect(help).toContain('echo');
    expect(help).toContain('Echo the arguments back');
    expect(help).not.toContain('quiet');
  });

  it('lists its own shortcuts, so a command that cannot be found is still usable', async () => {
    await render(console());

    await run('help');

    expect(output()).toContain('Ctrl+L');
  });

  it("prints one command's usage, under the name it was called by", async () => {
    await render(console());

    await run('help rename');

    expect(output()).toContain('rename <text>');
  });

  it('empties the output when the built-in clear command runs', async () => {
    await render(console());

    await run('echo hello');
    await run('clear');

    expect(output()).toBe('');
  });

  it("lets a caller's command take a built-in name, because the caller knows what the name means", async () => {
    await render(console({ commands: { clear: { about: 'Nothing', execute: () => undefined } } }));

    await run('clear');

    expect(output()).toBe('> clear');
  });

  it('refuses a developer-only command and does not list it, rather than failing in front of the operator', async () => {
    await render(console());

    await run('secret');
    await run('help');

    expect(output()).not.toContain('the secret');
    expect(output()).not.toContain('Do something only a developer may');
  });

  it('runs and lists a developer-only command once the caller grants the right', async () => {
    await render(console({ developerMode: true }));

    await run('secret');
    await run('help');

    expect(output()).toContain('the secret');
    expect(output()).toContain('secret');
  });

  it('remembers a line and recalls it, then comes back to what was being typed', async () => {
    await render(console());
    const input = document.body.querySelector('input') as HTMLInputElement;

    await run('echo one');
    await type(input, 'half-typed');

    pressKey(input, 'ArrowUp');
    expect(input.value).toBe('echo one');

    pressKey(input, 'ArrowDown');
    expect(input.value).toBe('half-typed');
  });

  it('recalls the last line first, so a command run twice needs one key', async () => {
    await render(console());
    const input = document.body.querySelector('input') as HTMLInputElement;

    await run('echo one');
    await run('echo two');

    pressKey(input, 'ArrowUp');
    expect(input.value).toBe('echo two');

    pressKey(input, 'ArrowUp');
    expect(input.value).toBe('echo one');
  });

  it('hands the history to a command, with the line about to run not yet in it', async () => {
    await render(console());

    await run('count');
    await run('echo one');
    await run('count');

    expect(output()).toContain('run before this one: 2');
  });

  it('remembers a line repeated in a row once, because that is one thing to recall', async () => {
    await render(console());

    await run('count');
    await run('count');
    await run('count');

    expect(output()).toContain('run before this one: 1');
  });

  it('runs an alias for the command it stands for, with its arguments in place', async () => {
    const aliased: CommandConsoleCommand = {
      about: 'Set an alias',
      execute: ({ args, setAlias }: CommandConsoleContext) => {
        const name = args[1];

        if (name === undefined) {
          return;
        }

        setAlias(name, args.slice(2).join(' '));
      },
    };

    await render(
      <CommandConsole
        open={true}
        onOpenChange={() => undefined}
        commands={{ ...commands, alias: aliased }}
      />,
    );

    await run('alias e echo $$');
    await run('e through the alias');

    expect(output()).toContain('echoed: through the alias');
  });

  it('never lets an alias shadow a command, because a name means one thing', async () => {
    const aliased: CommandConsoleCommand = {
      about: 'Set an alias',
      execute: ({ setAlias }: CommandConsoleContext) => {
        setAlias('echo', 'count');
      },
    };

    await render(
      <CommandConsole
        open={true}
        onOpenChange={() => undefined}
        commands={{ ...commands, alias: aliased }}
      />,
    );

    await run('alias echo count');
    await run('echo hello');

    expect(output()).toContain('echoed: hello');
  });

  it('cuts a line at the console line length, because an unbroken line is unreadable', async () => {
    await render(
      <CommandConsole
        open={true}
        onOpenChange={() => undefined}
        commands={commands}
        initialMaxLineLength={6}
      />,
    );

    await run('echo abcdefgh');

    expect(output()).toBe('> echo\nechoed');
  });

  it('keeps the newest output when there is more of it than the console holds', async () => {
    await render(
      <CommandConsole
        open={true}
        onOpenChange={() => undefined}
        commands={commands}
        maxOutputLength={20}
      />,
    );

    await run('echo one');
    await run('echo two');

    expect(output()).toContain('echo two');
    expect(output().length).toBeLessThanOrEqual(20);
  });

  it('wraps long output unless the caller started it unwrapped', async () => {
    await render(console());

    expect(document.body.querySelector('textarea')?.className).not.toContain('whitespace-pre');

    await render(console({ initialWrapLines: false }));

    const textareas = [...document.body.querySelectorAll('textarea')];

    expect(textareas.at(-1)?.className).toContain('whitespace-pre');
  });

  it('clears the output on Ctrl+L, the way every log does', async () => {
    await render(console());

    await run('echo hello');
    pressKey(document.body.querySelector('input') as HTMLInputElement, 'KeyL', true);

    expect(output()).toBe('');
  });

  it('removes the text after the caret on Ctrl+K, and leaves the rest of the line', async () => {
    await render(console());
    const input = document.body.querySelector('input') as HTMLInputElement;

    await type(input, 'keep drop');
    input.setSelectionRange(4, 4);

    pressKey(input, 'KeyK', true);

    expect(input.value).toBe('keep');
  });

  it('removes the text before the caret on Ctrl+U, and leaves the rest of the line', async () => {
    await render(console());
    const input = document.body.querySelector('input') as HTMLInputElement;

    await type(input, 'keep drop');
    input.setSelectionRange(4, 4);

    pressKey(input, 'KeyU', true);

    expect(input.value).toBe(' drop');
  });

  it('leaves a key it does not bind to the browser', async () => {
    await render(console());
    const input = document.body.querySelector('input') as HTMLInputElement;

    await type(input, 'echo hello');

    let defaultPrevented = true;

    act(() => {
      const event = new KeyboardEvent('keydown', { code: 'KeyH', bubbles: true, cancelable: true });
      input.dispatchEvent(event);
      defaultPrevented = event.defaultPrevented;
    });

    expect(defaultPrevented).toBe(false);
  });

  // A Ctrl+press of something the console does not bind is a key the page gets: the combination is
  // looked up in the table at all only because a Ctrl key could be bound.
  it('leaves a Ctrl combination it does not bind to the browser as well', async () => {
    await render(console());
    const input = document.body.querySelector('input') as HTMLInputElement;

    await type(input, 'echo hello');

    let defaultPrevented = true;

    act(() => {
      const event = new KeyboardEvent('keydown', {
        code: 'KeyJ',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      input.dispatchEvent(event);
      defaultPrevented = event.defaultPrevented;
    });

    expect(defaultPrevented).toBe(false);
    expect(output()).toBe('');
  });

  it('echoes nothing for a blank line, and recalls nothing when there is no history', async () => {
    await render(console());
    const input = document.body.querySelector('input') as HTMLInputElement;

    await type(input, '   ');
    pressKey(input, 'Enter');

    expect(output()).toBe('');
    expect(input.value).toBe('   ');

    pressKey(input, 'ArrowUp');

    // No line has run yet, so there is nothing to walk back to.
    expect(input.value).toBe('   ');
  });

  it('runs a line pressed on the numpad Enter, not the keyboard one', async () => {
    await render(console());
    const input = document.body.querySelector('input') as HTMLInputElement;

    await type(input, 'echo hello');
    pressKey(input, 'NumpadEnter');

    expect(output()).toBe('> echo hello\nechoed: hello');
  });

  it('moves the caret to the end of the line on Ctrl+E, keeping the prompt focused', async () => {
    await render(console());
    const input = document.body.querySelector('input') as HTMLInputElement;

    await type(input, 'echo hello');
    input.setSelectionRange(0, 0);

    pressKey(input, 'KeyE', true);

    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe('echo hello'.length);
  });

  it('reads a caret the element cannot report as the start of the line', async () => {
    await render(console());
    const input = document.body.querySelector('input') as HTMLInputElement;

    await type(input, 'keep drop');

    // jsdom reports a caret as a number always; the fallback is for an element that has none.
    Object.defineProperty(input, 'selectionEnd', { configurable: true, value: null });
    pressKey(input, 'KeyU', true);

    expect(input.value).toBe('keep drop');

    Object.defineProperty(input, 'selectionStart', { configurable: true, value: null });
    pressKey(input, 'KeyK', true);

    expect(input.value).toBe('');
  });

  it('walks forward through the history it has walked back through', async () => {
    await render(console());
    const input = document.body.querySelector('input') as HTMLInputElement;

    await run('echo one');
    await run('echo two');

    // Nothing has been recalled yet, so walking forward stays on the empty draft.
    pressKey(input, 'ArrowDown');
    expect(input.value).toBe('');

    pressKey(input, 'ArrowUp');
    pressKey(input, 'ArrowUp');
    pressKey(input, 'ArrowDown');

    expect(input.value).toBe('echo two');
  });

  it('says when a command asked for by name is not one it holds', async () => {
    await render(console());

    await run('help echo');
    await run('help ghost');

    // The name a command was called by is the name its page prints, and a name the console does
    // not hold gets the line that says so.
    expect(output()).toContain('usage: echo <text>');
    expect(output()).toContain(
      "Error: bad command `ghost'. Enter `help` for the list of commands.",
    );
  });

  it('prints the help page of a command that has none', async () => {
    await render(console());

    await run('help count');

    expect(output()).toContain('`count` has no help page.');
  });

  it('prints the usage a command asks for when it runs, or the line that says it has none', async () => {
    const selfDocumenting: CommandConsoleCommand = {
      about: 'Print its own usage',
      usage: ['describe <text>'],
      execute: ({ usage }: CommandConsoleContext) => {
        usage();
      },
    };

    await render(console({ commands: { ...commands, describe: selfDocumenting } }));

    await run('describe mine');

    expect(output()).toContain('usage: describe <text>');
  });

  it('answers a command that asks for usage it does not have, with the line that says so', async () => {
    const silent: CommandConsoleCommand = {
      about: 'Has no usage',
      execute: ({ usage }: CommandConsoleContext) => {
        usage();
      },
    };

    await render(console({ commands: { ...commands, silent } }));

    await run('silent');

    expect(output()).toContain('`silent` has no help page.');
  });

  it('appends the arguments of an alias that does not name a place for them', async () => {
    const aliased: CommandConsoleCommand = {
      about: 'Set an alias',
      execute: ({ args, setAlias }: CommandConsoleContext) => {
        const name = args[1];

        if (name === undefined) {
          return;
        }

        setAlias(name, args.slice(2).join(' '));
      },
    };

    await render(
      <CommandConsole
        open={true}
        onOpenChange={() => undefined}
        commands={{ ...commands, alias: aliased }}
      />,
    );

    await run('alias e echo');
    await run('e hello');

    expect(output()).toContain('echoed: hello');
  });

  it('removes an alias it is told to forget', async () => {
    const aliased: CommandConsoleCommand = {
      about: 'Set an alias',
      execute: ({ args, setAlias }: CommandConsoleContext) => {
        const name = args[1];

        if (name === undefined) {
          return;
        }

        setAlias(name, args.slice(2).join(' '));
      },
    };
    const forget: CommandConsoleCommand = {
      about: 'Remove an alias',
      execute: ({ args, setAlias }: CommandConsoleContext) => {
        const name = args[1];

        if (name === undefined) {
          return;
        }

        setAlias(name, undefined);
      },
    };

    await render(
      <CommandConsole
        open={true}
        onOpenChange={() => undefined}
        commands={{ ...commands, alias: aliased, forget: forget }}
      />,
    );

    await run('alias e echo $$');
    await run('e hello');
    expect(output()).toContain('echoed: hello');

    await run('forget e');
    await run('e hello');

    // With no alias behind it, the name is one the console does not hold.
    expect(output()).toContain("Error: bad command `e'.");
  });

  it('lets an alias stand for nothing, which runs nothing', async () => {
    const aliased: CommandConsoleCommand = {
      about: 'Set an alias',
      execute: ({ args, setAlias }: CommandConsoleContext) => {
        const name = args[1];

        if (name === undefined) {
          return;
        }

        setAlias(name, args.slice(2).join(' '));
      },
    };

    await render(
      <CommandConsole
        open={true}
        onOpenChange={() => undefined}
        commands={{ ...commands, alias: aliased }}
      />,
    );

    await run('alias z');
    await run('z');

    expect(output()).toBe('> alias z\n> z');
  });
});
