/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The pending changes of a draft, and the save request that carries them. A change is a real difference from the
 * stored snapshot: setting a scope's own value, or removing it so the scope inherits. Event selections compare by
 * content (the order of names never matters).
 */
import type { Draft, Edit } from './draft.ts';
import { sameSelection, type EventSelection, type RoutedChannel } from './events.ts';
import type { ScopeId } from './scope.ts';
import { EVENTS_KEY, sameValue, wireValueOf, type EditValue, type EventsKey, type SettingKey } from './setting.ts';

export type Change =
    | { readonly target: 'setting'; readonly scope: ScopeId; readonly key: SettingKey; readonly edit: Edit<EditValue> }
    | { readonly target: 'events'; readonly scope: ScopeId; readonly key: EventsKey; readonly edit: Edit<EventSelection> };

export interface WireEventSelection {
    readonly off: readonly string[];
    readonly channels: Readonly<Record<string, RoutedChannel>>;
}

export type WireChange =
    | { readonly scope: string; readonly key: string; readonly op: 'set'; readonly value: boolean | string | WireEventSelection }
    | { readonly scope: string; readonly key: string; readonly op: 'inherit' };

export interface SaveRequest {
    readonly changes: readonly WireChange[];
}

function isRealSettingChange(draft: Draft, key: SettingKey, scope: ScopeId, edit: Edit<EditValue>): boolean {
    const stored = draft.state.settings.get(key)?.stored.get(scope);
    if (edit.op === 'inherit') {
        return stored !== undefined;
    }
    return stored === undefined || !sameValue(edit.value, stored);
}

function isRealEventsChange(draft: Draft, scope: ScopeId, edit: Edit<EventSelection>): boolean {
    const stored = draft.state.events.stored.get(scope);
    if (edit.op === 'inherit') {
        return stored !== undefined;
    }
    return stored === undefined || !sameSelection(edit.value, stored);
}

/**
 * Every pending change, ordered by scope (tree order), then by `order` — the setting keys, with the events key
 * where the events setting belongs. Keys `order` leaves out follow in the server's definition order, the events
 * setting last.
 */
export function changes(draft: Draft, order: readonly (SettingKey | EventsKey)[] = []): readonly Change[] {
    const list: Change[] = [];
    for (const [key, edits] of draft.settingEdits) {
        for (const [scope, edit] of edits) {
            if (isRealSettingChange(draft, key, scope, edit)) {
                list.push({ target: 'setting', scope, key, edit });
            }
        }
    }
    for (const [scope, edit] of draft.eventEdits) {
        if (isRealEventsChange(draft, scope, edit)) {
            list.push({ target: 'events', scope, key: EVENTS_KEY, edit });
        }
    }

    const fallback: readonly (SettingKey | EventsKey)[] = [...draft.state.settings.keys(), EVENTS_KEY];
    const rank = (key: SettingKey | EventsKey): number => {
        const position = order.indexOf(key);
        return position >= 0 ? position : order.length + fallback.indexOf(key);
    };
    const tree = draft.state.tree;
    return list.sort((a, b) => tree.indexOf(a.scope) - tree.indexOf(b.scope) || rank(a.key) - rank(b.key));
}

const byCodePoint = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** An event selection as the save request carries it: names sorted, routing only where it is not the browser. */
export function wireSelection(selection: EventSelection): WireEventSelection {
    const channels: Record<string, RoutedChannel> = {};
    for (const name of [...selection.channels.keys()].sort(byCodePoint)) {
        const channel = selection.channels.get(name);
        if (channel !== undefined) {
            channels[name] = channel;
        }
    }
    return { off: [...selection.off].sort(byCodePoint), channels };
}

function wireChange(change: Change): WireChange {
    if (change.edit.op === 'inherit') {
        return { scope: change.scope, key: change.key, op: 'inherit' };
    }
    const value = change.target === 'events' ? wireSelection(change.edit.value) : wireValueOf(change.edit.value);
    return { scope: change.scope, key: change.key, op: 'set', value };
}

/** The body of a save request: each change once, in the given order. */
export function toSaveRequest(list: readonly Change[]): SaveRequest {
    return { changes: list.map(wireChange) };
}
