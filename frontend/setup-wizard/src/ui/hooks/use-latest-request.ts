/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * A read that follows its input: it waits for the input to settle (debounce), aborts the previous request when the
 * input changes or the component unmounts, and lets only the latest request's answer through — an older answer
 * arriving late never overwrites a newer one. A null input asks nothing.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Logger } from '../../application/ports.ts';
import { failureOf, isRequestError, type RequestFailure } from '../../application/request-error.ts';

export type Remote<T> =
    | { readonly status: 'idle' }
    | { readonly status: 'loading' }
    | { readonly status: 'loaded'; readonly data: T }
    | { readonly status: 'failed'; readonly failure: RequestFailure };

const IDLE = { status: 'idle' } as const;
const LOADING = { status: 'loading' } as const;

export interface LatestRequest<I, T> {
    /** What to ask; null asks nothing. */
    readonly input: I | null;
    /** Identifies the input: a new key starts a new request. */
    readonly key: string | null;
    readonly run: (input: I, signal: AbortSignal) => Promise<T>;
    readonly debounceMs: number;
    readonly logger: Logger;
    /** Names the request in the log. */
    readonly label: string;
}

export function useLatestRequest<I, T>(request: LatestRequest<I, T>): Remote<T> {
    const [result, setResult] = useState<Remote<T>>(IDLE);
    const latest = useRef(request);
    latest.current = request;
    const { key, debounceMs } = request;

    useEffect(() => {
        const { input, run, logger, label } = latest.current;
        if (key === null || input === null) {
            setResult(IDLE);
            return undefined;
        }
        const controller = new AbortController();
        setResult(LOADING);
        const timer = setTimeout(() => {
            run(input, controller.signal).then(
                (data) => {
                    if (!controller.signal.aborted) {
                        setResult({ status: 'loaded', data });
                    }
                },
                (error: unknown) => {
                    if (controller.signal.aborted) {
                        return;
                    }
                    if (!isRequestError(error)) {
                        logger.error(`${label} failed`, error);
                    }
                    setResult({ status: 'failed', failure: failureOf(error) });
                },
            );
        }, debounceMs);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [key, debounceMs]);

    return result;
}
