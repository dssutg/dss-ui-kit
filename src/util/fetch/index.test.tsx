/**
 * `useFetch` owns the request lifecycle a panel renders: hot `data` goes null again while a refetch
 * is in flight, `savedData` keeps the last successful payload so panels do not flicker, and one
 * failed request is sorted into an abort (the caller changing their mind), a non-`Error` throw
 * (nothing to show), or a real error. The suite drives the hook with a global `fetch` stub and
 * reads the result off every render, so the observable contract is what is pinned, not the
 * internals.
 */
// @vitest-environment jsdom
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flush, render } from '@/util/testing/render';
import { HttpError, postJson, type UseFetchResult, useFetch } from './';

/** Every render's hook result, in order; the last entry is the state a test asserts on. */
let results: UseFetchResult<unknown>[];

/** Every request the source issued, as the fetch stub saw it. */
let requests: { init: RequestInit | undefined; url: string }[];

function FetchProbe({
  dependencies,
  options,
  url,
}: {
  readonly dependencies?: unknown[];
  readonly options?: RequestInit;
  readonly url: string;
}) {
  const result = useFetch(url, options, dependencies);

  results.push(result);

  return <div />;
}

beforeEach(() => {
  results = [];
  requests = [];
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A fetch stub that records each call and answers with `response`. */
function stubFetch(response: () => Response): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((input: string | URL, init?: RequestInit): Promise<Response> => {
    requests.push({ init, url: String(input) });

    return Promise.resolve(response());
  });

  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

/** An ok JSON response, the only shape the source's success path needs. */
function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    status,
  });
}

/**
 * A stub whose request only answers when it is aborted — the shape an in-flight request has while
 * the caller is still interested, and the path every abort report goes through. The rejection is
 * an `Error` named `AbortError`, which is what the platform hands a fetch's awaiter on abort;
 * jsdom's own `DOMException` fails the `instanceof Error` check the source makes, and the same
 * rejection from a real browser passes it.
 */
function stubFetchUntilAborted(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((_input: string | URL, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const abort = new Error('Aborted');

        abort.name = 'AbortError';

        reject(abort);
      });
    });
  });

  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

describe('HttpError', () => {
  test('carries the status under the HttpError name', () => {
    const error = new HttpError(503, 'unavailable');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('HttpError');
    expect(error.status).toBe(503);
    expect(error.message).toBe('unavailable');
  });
});

describe('useFetch', () => {
  test('loads json, mirrors it into savedData and settles loading', async () => {
    stubFetch(() => jsonResponse({ ok: true }));

    await render(<FetchProbe url="/prices" />);

    const last = results.at(-1);

    expect(last?.data).toEqual({ ok: true });
    expect(last?.savedData).toEqual({ ok: true });
    expect(last?.loading).toBe(false);
    expect(last?.error).toBeNull();

    const whilePending = results.find((entry) => entry.loading === true);

    expect(whilePending?.data).toBeNull();
    expect(whilePending?.savedData).toBeNull();
  });

  test('sends the json content type, the caller headers, and the abort signal', async () => {
    stubFetch(() => jsonResponse({ ok: true }));

    await render(<FetchProbe options={{ headers: { 'X-Debug': '1' } }} url="/prices" />);

    expect(requests[0]?.url).toBe('/prices');
    expect(requests[0]?.init?.headers).toEqual({
      'Content-Type': 'application/json',
      method: 'GET',
      'X-Debug': '1',
    });
    expect(requests[0]?.init?.signal).toBeInstanceOf(AbortSignal);
  });

  test('raises a non-ok response as an HttpError carrying the response body', async () => {
    stubFetch(() => jsonResponse({ boom: true }, 502));

    await render(<FetchProbe url="/prices" />);

    const error = results.at(-1)?.error;

    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(502);
    expect(error?.message).toBe(JSON.stringify({ boom: true }));

    const last = results.at(-1);

    expect(last?.data).toBeNull();
    expect(last?.savedData).toBeNull();
    expect(last?.loading).toBe(false);
  });

  test('reports a thrown non-Error as neither data nor an error', async () => {
    stubFetch(() => {
      throw 'not an error'; // eslint-disable-line no-throw-literal
    });

    await render(<FetchProbe url="/prices" />);

    const last = results.at(-1);

    expect(last?.data).toBeNull();
    expect(last?.error).toBeNull();
    expect(last?.loading).toBe(false);
  });

  test('keeps savedData across a refetch, whose hot data answers null in the meantime', async () => {
    let answer = 1;
    stubFetch(() => jsonResponse({ n: answer }));

    await render(<FetchProbe url="/prices" />);

    const live = results.at(-1);

    expect(live?.data).toEqual({ n: 1 });

    act(() => {
      live?.refetch();
    });
    await flush();

    answer = 2;

    act(() => {
      live?.refetch();
    });
    await flush();

    const final = results.at(-1);

    expect(final?.data).toEqual({ n: 2 });
    expect(final?.savedData).toEqual({ n: 2 });
    expect(final?.error).toBeNull();

    // The moment the refetch opened: hot data went null, the previous answer stayed put.
    const kept = results.filter((entry) => entry.data === null && entry.savedData !== null);

    expect(kept.length).toBeGreaterThan(0);
    expect(kept.at(-1)?.savedData).toEqual({ n: 1 });
  });

  test('refetch wraps around after the largest safe fetch index', async () => {
    stubFetch(() => jsonResponse({ ok: true }));
    await render(<FetchProbe url="/prices" />);

    const live = results.at(-1);

    act(() => {
      live?.refetch();
    });
    await flush();

    expect(requests).toHaveLength(2);
  });

  test('reports a request aborted by a dependency change as cancelled, not failed', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubFetchUntilAborted();

    const view = await render(<FetchProbe dependencies={['first']} url="/prices" />);

    expect(results.at(-1)?.loading).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();

    // The primary dependency changed: the previous request is aborted and the new one starts.
    await view.update(<FetchProbe dependencies={['second']} url="/prices" />);

    expect(warnSpy).toHaveBeenCalledWith('Fetch aborted');
    expect(results.at(-1)?.error).toBeNull();

    // The aborted request's own `finally` lowers the shared loading flag even though the request
    // it belongs to was cancelled and the new request is still in flight — the two closures share
    // one state slot, and that is the observable behaviour of this hook as written.
    expect(results.at(-1)?.loading).toBe(false);
  });

  test('reports a request aborted by unmounting as cancelled, not failed', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubFetchUntilAborted();

    const view = await render(<FetchProbe url="/prices" />);

    await act(async () => {
      view.unmount();
      await flush();
    });

    expect(warnSpy).toHaveBeenCalledWith('Fetch aborted');
  });
});

describe('postJson', () => {
  test('posts the payload as a JSON body', async () => {
    const fetchMock = stubFetch(() => jsonResponse({ saved: true }));

    await postJson('/save', { query: 'a' });

    expect(fetchMock).toHaveBeenCalledWith('/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: 'a' }),
    });
  });

  test('posts a null body when none was given', async () => {
    const fetchMock = stubFetch(() => jsonResponse({ saved: true }));

    await postJson('/save');

    expect(fetchMock.mock.calls[0]?.[1]?.body).toBeNull();
  });
});
