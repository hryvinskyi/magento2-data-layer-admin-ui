/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Why a request to the server failed as a whole, as a small set of kinds the page turns into wording:
 *
 * - `network`: nothing came back (offline, DNS, connection reset).
 * - `timeout`: the deadline passed before an answer arrived. The server may still have done the work.
 * - `rejected`: the server refused the request (a malformed body); it carries the server's translated reason.
 * - `forbidden`: the admin user lacks the permission.
 * - `expired`: the admin session or the form key is no longer valid, or the answer was a page instead of data.
 *   The person signs in again (another tab) and repeats the action; nothing typed is lost.
 * - `server`: the server failed (5xx), or answered something that is not the agreed data.
 *
 * A request the caller aborted is none of these: it is not an error to show.
 */
export type RequestErrorKind = 'network' | 'timeout' | 'rejected' | 'forbidden' | 'expired' | 'server';

const KINDS: ReadonlySet<string> = new Set<RequestErrorKind>([
    'network',
    'timeout',
    'rejected',
    'forbidden',
    'expired',
    'server',
]);

export const isRequestErrorKind = (raw: string): raw is RequestErrorKind => KINDS.has(raw);

/** What the page shows about a failed request: the kind, and the server's own reason when it gave one. */
export interface RequestFailure {
    readonly kind: RequestErrorKind;
    readonly serverMessage: string | null;
}

export const REQUEST_ERROR = 'RequestError';

export class RequestError extends Error {
    readonly kind: RequestErrorKind;
    /** Translated by the server; only a `rejected` request carries one. */
    readonly serverMessage: string | null;

    constructor(kind: RequestErrorKind, serverMessage: string | null = null, options?: ErrorOptions) {
        super(`Request failed: ${kind}${serverMessage === null ? '' : ` (${serverMessage})`}`, options);
        this.name = REQUEST_ERROR;
        this.kind = kind;
        this.serverMessage = serverMessage;
    }
}

/**
 * Whether a thrown value is a request failure. Matched by name and shape rather than `instanceof`: the shell and
 * each step plugin are separate bundles, so a class from one is not the class another sees.
 */
export function isRequestError(error: unknown): error is RequestError {
    if (!(error instanceof Error) || error.name !== REQUEST_ERROR) {
        return false;
    }
    const kind: unknown = Reflect.get(error, 'kind');
    const message: unknown = Reflect.get(error, 'serverMessage');
    return typeof kind === 'string' && isRequestErrorKind(kind) && (message === null || typeof message === 'string');
}

/**
 * The failure to show for anything a request threw. A thrown value that is not a request failure (an answer of
 * the wrong shape, a bug) is reported as `server`: the outcome is unknown, so nothing may be treated as saved.
 */
export function failureOf(error: unknown): RequestFailure {
    return isRequestError(error)
        ? { kind: error.kind, serverMessage: error.serverMessage }
        : { kind: 'server', serverMessage: null };
}
