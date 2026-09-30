import { useEffect, useRef, useState } from 'react';
import { useGranularEffect } from '@/lib/use_granular_effect';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

interface UseFetchResult<T> {
  data: T | null; // hot data (null on refetch)
  savedData: T | null; // data since latest fetch (not null on refetch)
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useFetch<T = unknown>(
  url: string,
  options: RequestInit = {},
  dependencies: unknown[] = [],
): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [savedData, setSavedData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [fetchIndex, setFetchIndex] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (data !== null) {
      setSavedData(data);
    }
  }, [data]);

  function refetch() {
    setFetchIndex((prev) => (prev + 1) % Number.MAX_SAFE_INTEGER);
  }

  useGranularEffect(
    () => {
      const abortController = new AbortController();

      abortControllerRef.current = abortController;

      const defaultHeaders: HeadersInit = {
        'Content-Type': 'application/json',
        method: 'GET',
      };

      const mergedHeaders = {
        ...defaultHeaders,
        ...options.headers,
      };

      async function fetchData() {
        setLoading(true);
        setError(null);
        setData(null);

        try {
          const response = await fetch(url, {
            ...options,
            headers: mergedHeaders,
            signal: abortController.signal,
          });

          const json: T = await response.json();

          if (!response.ok) {
            throw new HttpError(response.status, JSON.stringify(json));
          }

          setData(json);
        } catch (error: unknown) {
          if (error instanceof Error && error.name === 'AbortError') {
            console.warn('Fetch aborted');
          } else if (error instanceof Error) {
            setError(error);
            setData(null);
          }
        } finally {
          setLoading(false);
        }
      }

      fetchData();

      return () => {
        abortController.abort();
      };
    },
    [url, fetchIndex, ...dependencies],
    [refetch],
  );

  return { data, savedData, loading, error, refetch };
}

export async function postJson<T>(input: string | URL | globalThis.Request, body?: T) {
  const response = await fetch(input, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  return response;
}
