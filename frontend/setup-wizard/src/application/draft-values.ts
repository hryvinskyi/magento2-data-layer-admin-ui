/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The unsaved values a request sends so the server can show what they would do (a preview, a test event) without
 * storing anything: the value that applies at the view's scope once the edits apply.
 *
 * A secret is sent only when the draft replaces it. The browser never holds a stored secret, so leaving it out
 * tells the server to use the one it has.
 */
import { CONNECT_STEP, PRODUCTS_STEP } from '../domain/core-steps.ts';
import { ENABLED } from '../domain/core-keys.ts';
import { wireSelection } from '../domain/diff.ts';
import { EVENTS_KEY, type EventsKey, type SettingKey } from '../domain/setting.ts';
import type { SettingsView } from '../domain/view.ts';
import type { PreviewKind, PreviewRequest, WireDraftValue } from './ports.ts';

/**
 * Key → draft value for each key the view holds. A key the state does not hold is left out, and so is a secret the
 * draft does not replace.
 */
export function draftValues(
    view: SettingsView,
    keys: readonly (SettingKey | EventsKey)[],
): Readonly<Record<string, WireDraftValue>> {
    const values: Record<string, WireDraftValue> = {};
    for (const key of keys) {
        if (key === EVENTS_KEY) {
            values[key] = wireSelection(view.events());
            continue;
        }
        const value = view.value(key);
        if (value === undefined) {
            continue;
        }
        if (typeof value !== 'object') {
            values[key] = value;
            continue;
        }
        if ('replace' in value) {
            values[key] = value.replace;
        }
    }
    return values;
}

/** The settings an event preview depends on: whether events are sent, which ones, and every connect and products setting. */
export function previewKeys(view: SettingsView): readonly (SettingKey | EventsKey)[] {
    const stepKeys = view.definitions()
        .filter((definition) => definition.step === CONNECT_STEP || definition.step === PRODUCTS_STEP)
        .map((definition) => definition.key);
    return [ENABLED, ...stepKeys.filter((key) => key !== ENABLED), EVENTS_KEY];
}

export interface PreviewChoice {
    readonly kind: PreviewKind;
    readonly product: number | null;
    readonly priceVisible: boolean;
}

/** The preview request for the view's store view; null when the view is not a store view's. */
export function previewRequestOf(view: SettingsView, choice: PreviewChoice): PreviewRequest | null {
    if (view.scope.type !== 'store') {
        return null;
    }
    return {
        store: view.scope.id,
        kind: choice.kind,
        product: choice.product,
        priceVisible: choice.priceVisible,
        settings: draftValues(view, previewKeys(view)),
    };
}
