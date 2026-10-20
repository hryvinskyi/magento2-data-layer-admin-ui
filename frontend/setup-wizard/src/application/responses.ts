/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * What the server answers, as the wizard's use cases see it once an adapter has parsed the wire.
 */
import type { ScopeId } from '../domain/scope.ts';
import type { EventsKey, SettingKey } from '../domain/setting.ts';
import type { SetupState } from '../domain/setup-state.ts';

export type JsonValue = null | boolean | number | string | readonly JsonValue[] | JsonObject;
export interface JsonObject {
    readonly [key: string]: JsonValue;
}

export interface SaveResult {
    readonly scope: ScopeId;
    readonly key: SettingKey | EventsKey;
    readonly status: 'saved' | 'failed';
    /** The store's reason, translated, when the change failed. */
    readonly message?: string;
}

/** Per-change results, and the snapshot the store holds after the save. */
export interface SaveResponse {
    readonly results: readonly SaveResult[];
    readonly state: SetupState;
}

/** `sent`: the event a page would push. `not_sent` and `unavailable` carry the server's translated reason. */
export type PreviewResponse =
    | { readonly status: 'sent'; readonly event: JsonObject }
    | { readonly status: 'not_sent'; readonly reason: string }
    | { readonly status: 'unavailable'; readonly reason: string };

export interface ProductHit {
    readonly id: number;
    readonly sku: string;
    readonly name: string;
}

/** A test event's outcome: valid, or the endpoint's findings, or the reason nothing usable came back. */
export interface TestResult {
    readonly valid: boolean;
    readonly messages: readonly string[];
    readonly error: string;
}
