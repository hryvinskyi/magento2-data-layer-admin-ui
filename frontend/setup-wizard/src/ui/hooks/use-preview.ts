/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The event preview and the product search that feeds it, each following its input with the latest-request
 * discipline: debounced, the previous request aborted on change, only the newest answer shown. A renewed admin
 * session asks again, so a request refused for an ended session recovers once the person signed in again.
 */
import { useMemo } from 'preact/hooks';
import type { PreviewRequest } from '../../application/ports.ts';
import { previewEvent, searchProducts } from '../../application/preview.ts';
import type { RequestFailure } from '../../application/request-error.ts';
import type { JsonObject, PreviewResponse, ProductHit } from '../../application/responses.ts';
import type { ScopeId } from '../../domain/scope.ts';
import { useRuntimeValue } from '../../sdk/context.tsx';
import { useLatestRequest, type Remote } from './use-latest-request.ts';
import { useSession } from './use-session.ts';

/** How long the input must stay unchanged before a request goes out. */
export const DEBOUNCE_MS = 300;

export interface RequestTiming {
    readonly debounceMs?: number;
}

export type PreviewState =
    | { readonly status: 'idle' }
    | { readonly status: 'loading' }
    | { readonly status: 'loaded'; readonly event: JsonObject }
    | { readonly status: 'not_sent'; readonly reason: string }
    | { readonly status: 'unavailable'; readonly reason: string }
    | { readonly status: 'failed'; readonly failure: RequestFailure };

/** The server's answer as the preview card shows it: `not_sent` and `unavailable` pass through with their reason. */
function previewStateOf(remote: Remote<PreviewResponse>): PreviewState {
    if (remote.status !== 'loaded') {
        return remote;
    }
    const response = remote.data;
    return response.status === 'sent' ? { status: 'loaded', event: response.event } : response;
}

/** The event the draft would produce for the request; null asks nothing. */
export function usePreview(request: PreviewRequest | null, timing: RequestTiming = {}): PreviewState {
    const { runtime } = useRuntimeValue();
    const { revision } = useSession();
    const run = useMemo(() => previewEvent(runtime.gateway), [runtime]);
    const remote = useLatestRequest({
        input: request,
        key: request === null ? null : `${revision}\n${JSON.stringify(request)}`,
        run,
        debounceMs: timing.debounceMs ?? DEBOUNCE_MS,
        logger: runtime.logger,
        label: 'The event preview',
    });
    return previewStateOf(remote);
}

interface ProductQuery {
    readonly store: ScopeId;
    readonly query: string;
}

/** Products of the store view matching the query; a blank query or no store view asks nothing. */
export function useProductSearch(
    store: ScopeId | null,
    query: string,
    timing: RequestTiming = {},
): Remote<readonly ProductHit[]> {
    const { runtime } = useRuntimeValue();
    const { revision } = useSession();
    const search = useMemo(() => searchProducts(runtime.gateway), [runtime]);
    const trimmed = query.trim();
    const input: ProductQuery | null = store === null || trimmed === '' ? null : { store, query: trimmed };
    return useLatestRequest({
        input,
        key: input === null ? null : `${revision}\n${input.store}\n${input.query}`,
        run: (next: ProductQuery, signal: AbortSignal) => search(next.store, next.query, signal),
        debounceMs: timing.debounceMs ?? DEBOUNCE_MS,
        logger: runtime.logger,
        label: 'The product search',
    });
}
