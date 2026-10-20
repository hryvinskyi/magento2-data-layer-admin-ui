/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * What the wizard's use cases need from the outside world. Adapters implement these; the composition root wires
 * them; tests pass fakes.
 *
 * Every gateway method takes the caller's signal and rejects with the signal's reason once it is aborted; any
 * other failure is a `RequestError` (or a contract error when the answer has the wrong shape).
 */
import type { SaveRequest, WireEventSelection } from '../domain/diff.ts';
import type { ScopeId } from '../domain/scope.ts';
import type { PreviewResponse, ProductHit, SaveResponse } from './responses.ts';

/** A draft value as a request carries it: a flag, text (a secret's replacement included), or an event selection. */
export type WireDraftValue = boolean | string | WireEventSelection;

export type PreviewKind = 'view_item' | 'purchase';

export interface PreviewRequest {
    /** A store view: the event is built as that store view's pages would build it. */
    readonly store: ScopeId;
    readonly kind: PreviewKind;
    /** The product to preview; null before one is chosen. */
    readonly product: number | null;
    /** Whether the visitor sees prices. */
    readonly priceVisible: boolean;
    /** Setting key (or `events`) → the draft value that applies at the store view. */
    readonly settings: Readonly<Record<string, WireDraftValue>>;
}

export interface SetupGateway {
    save(request: SaveRequest, signal: AbortSignal): Promise<SaveResponse>;
    preview(request: PreviewRequest, signal: AbortSignal): Promise<PreviewResponse>;
    products(store: ScopeId, query: string, signal: AbortSignal): Promise<readonly ProductHit[]>;
}

/** Leaving the page. */
export interface Navigator {
    go(url: string): void;
    /** Asks the person to confirm leaving with unsaved changes; true to leave. */
    confirmLeave(text: string): boolean;
}

/** Where details for developers go; a person never reads them. */
export interface Logger {
    error(message: string, detail?: unknown): void;
}
