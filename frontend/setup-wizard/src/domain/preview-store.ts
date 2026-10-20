/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Which store view an event preview is built for. The server builds an event as one store view's pages would, so a
 * preview needs a store view: the scope itself when it is one, else the first store view beneath it.
 */
import type { ScopeId, ScopeTree } from './scope.ts';

/** The store view to preview for the scope; null when no store view sits under it. */
export function previewStoreOf(tree: ScopeTree, scope: ScopeId): ScopeId | null {
    const store = tree.scopes.find((candidate) => candidate.type === 'store' && tree.chain(candidate.id).includes(scope));
    return store?.id ?? null;
}
