/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * JSON requests to the admin, with the rules every wizard request follows — the shell's and every step plugin's.
 *
 * - The admin answers a refused form key or an expired session with a redirect to an HTML page unless the request
 *   says it is AJAX, so every URL carries `isAjax=true`. It reads the form key from the request parameters, never
 *   from a JSON body, so every POST URL carries `form_key`; the body stays JSON.
 * - Every request has a deadline and follows the caller's signal. Aborting is not a failure: the promise rejects
 *   with the signal's own reason, and the caller, who aborted, ignores it.
 * - Failures become a `RequestError` of one kind: `network`, `timeout`, `rejected` (400, with the server's
 *   reason), `forbidden` (403), `expired` (the session or form key is no longer valid — the admin's
 *   `{"ajaxExpired":…}` and `{"error":true,…}` answers, a redirected response, or a body that is not JSON) and
 *   `server` (any other status that is not a success).
 * - Nothing is retried here: a repeated write is the caller's decision.
 *
 * The answer is returned as `unknown`; the caller parses it into its own types.
 */
import { RequestError } from '../application/request-error.ts';

/** The part of a fetch response the client reads. */
export interface HttpResponse {
    readonly status: number;
    readonly redirected: boolean;
    text(): Promise<string>;
}

export type Fetch = (url: string, init: RequestInit) => Promise<HttpResponse>;

export interface JsonClientOptions {
    /** The admin form key valid now; read for every request, so a renewed session applies to the next one. */
    readonly formKey: () => string;
    /** What relative URLs resolve against (the page's base URL). */
    readonly baseUrl: string;
    readonly fetch: Fetch;
}

/** How long a request may take when the caller names no deadline. */
export const DEFAULT_DEADLINE_MS = 10_000;

export interface JsonRequestOptions {
    readonly signal: AbortSignal;
    /** The deadline; DEFAULT_DEADLINE_MS when left out. */
    readonly timeoutMs?: number;
    /** Query parameters added to the URL. */
    readonly query?: Readonly<Record<string, string>>;
}

export interface JsonClient {
    get(url: string, options: JsonRequestOptions): Promise<unknown>;
    post(url: string, body: unknown, options: JsonRequestOptions): Promise<unknown>;
}

type Method = 'GET' | 'POST';

type JsonText = { readonly ok: true; readonly value: unknown } | { readonly ok: false };

function readJson(text: string): JsonText {
    try {
        const value: unknown = JSON.parse(text);
        return { ok: true, value };
    } catch {
        return { ok: false };
    }
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/** The reason a 400 answer gives: `error` as text (the wizard's endpoints), else `message` as text. */
function rejectionReason(body: JsonText): string | null {
    if (!body.ok || !isRecord(body.value)) {
        return null;
    }
    const { error, message } = body.value;
    if (typeof error === 'string' && error.trim() !== '') {
        return error;
    }
    return typeof message === 'string' && message.trim() !== '' ? message : null;
}

/** The admin's answers to an expired session (`ajaxExpired`) and to a refused form key (`error: true`). */
function isExpiredAnswer(value: unknown): boolean {
    if (!isRecord(value)) {
        return false;
    }
    const expired = value['ajaxExpired'];
    return (expired !== undefined && expired !== null && expired !== false && expired !== 0) || value['error'] === true;
}

/** The answer as data, or the failure it stands for. */
function interpret(response: HttpResponse, text: string): unknown {
    if (response.redirected) {
        throw new RequestError('expired');
    }
    const body = readJson(text);
    if (response.status === 400) {
        throw new RequestError('rejected', rejectionReason(body));
    }
    if (response.status === 403) {
        throw new RequestError('forbidden');
    }
    if (response.status < 200 || response.status > 299) {
        throw new RequestError('server');
    }
    if (!body.ok || isExpiredAnswer(body.value)) {
        throw new RequestError('expired');
    }
    return body.value;
}

export function createJsonClient(options: JsonClientOptions): JsonClient {
    const send = async (method: Method, url: string, body: unknown, request: JsonRequestOptions): Promise<unknown> => {
        const target = new URL(url, options.baseUrl);
        for (const [name, value] of Object.entries(request.query ?? {})) {
            target.searchParams.set(name, value);
        }
        target.searchParams.set('isAjax', 'true');
        if (method === 'POST') {
            target.searchParams.set('form_key', options.formKey());
        }

        const deadline = AbortSignal.timeout(request.timeoutMs ?? DEFAULT_DEADLINE_MS);
        const init: RequestInit = {
            method,
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
            },
            signal: AbortSignal.any([request.signal, deadline]),
            ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
        };

        let response: HttpResponse;
        let text: string;
        try {
            response = await options.fetch(target.href, init);
            text = await response.text();
        } catch (error) {
            if (request.signal.aborted) {
                const reason: unknown = request.signal.reason;
                throw reason;
            }
            throw new RequestError(deadline.aborted ? 'timeout' : 'network', null, { cause: error });
        }
        return interpret(response, text);
    };

    return Object.freeze({
        get: (url: string, request: JsonRequestOptions): Promise<unknown> => send('GET', url, null, request),
        post: (url: string, body: unknown, request: JsonRequestOptions): Promise<unknown> => send('POST', url, body, request),
    });
}
