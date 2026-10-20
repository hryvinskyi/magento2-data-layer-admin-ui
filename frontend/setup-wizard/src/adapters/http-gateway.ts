/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The wizard's endpoints over the JSON client, with the deadline each call class gets. A save writes one
 * configuration save per scope, so it may take a while; previews and product searches are quick reads.
 */
import type { PreviewRequest, SetupGateway } from '../application/ports.ts';
import type { PreviewResponse, ProductHit, SaveResponse } from '../application/responses.ts';
import type { SaveRequest } from '../domain/diff.ts';
import type { ScopeId } from '../domain/scope.ts';
import { parsePreviewResponse, parseProducts, parseSaveResponse } from './contract.ts';
import type { JsonClient } from './json-client.ts';

export const SAVE_DEADLINE_MS = 60_000;
export const READ_DEADLINE_MS = 10_000;

export interface GatewayEndpoints {
    readonly save: string;
    readonly preview: string;
    readonly products: string;
}

/** The endpoints are read for every request, so URLs renewed with the session apply to the next request. */
export function createHttpGateway(endpoints: () => GatewayEndpoints, client: JsonClient): SetupGateway {
    return Object.freeze({
        save: async (request: SaveRequest, signal: AbortSignal): Promise<SaveResponse> =>
            parseSaveResponse(await client.post(endpoints().save, request, { signal, timeoutMs: SAVE_DEADLINE_MS })),
        preview: async (request: PreviewRequest, signal: AbortSignal): Promise<PreviewResponse> =>
            parsePreviewResponse(await client.post(endpoints().preview, request, { signal, timeoutMs: READ_DEADLINE_MS })),
        products: async (store: ScopeId, query: string, signal: AbortSignal): Promise<readonly ProductHit[]> =>
            parseProducts(await client.get(endpoints().products, {
                signal,
                timeoutMs: READ_DEADLINE_MS,
                query: { store, q: query },
            })),
    });
}
