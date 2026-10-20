/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Asking the server what the draft would do: the event a store view's page would push, and the products to
 * preview it with. Both are reads, so a newer request simply replaces an older one; neither retries on its own
 * (the person's next change asks again).
 */
import type { ScopeId } from '../domain/scope.ts';
import type { PreviewRequest, SetupGateway } from './ports.ts';
import type { PreviewResponse, ProductHit } from './responses.ts';

export const previewEvent = (gateway: SetupGateway) =>
    (request: PreviewRequest, signal: AbortSignal): Promise<PreviewResponse> => gateway.preview(request, signal);

/** Products of a store view whose name or SKU contains the query; a blank query asks nothing and finds nothing. */
export const searchProducts = (gateway: SetupGateway) =>
    async (store: ScopeId, query: string, signal: AbortSignal): Promise<readonly ProductHit[]> => {
        const trimmed = query.trim();
        return trimmed === '' ? [] : gateway.products(store, trimmed, signal);
    };
