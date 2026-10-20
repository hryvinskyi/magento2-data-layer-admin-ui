/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The draft as seen from one scope: what rules, warnings and step plugins read. Values are the effective ones once
 * the edits apply.
 */
import { CONTAINER_ID, MEASUREMENT_ID } from './core-keys.ts';
import {
    effectiveAt,
    eventsAt,
    eventsLockAt,
    eventsOwnAt,
    isWithinReach,
    lockAt,
    ownAt,
    type Draft,
} from './draft.ts';
import type { EventCatalogue, EventPreset, EventSelection } from './events.ts';
import { resolveMode, type Mode } from './mode.ts';
import { DEFAULT_SCOPE, type Scope, type ScopeId, type ScopeTree } from './scope.ts';
import { textOf, type SettingDefinition, type SettingKey, type SettingValue } from './setting.ts';

export interface SettingsView {
    readonly scope: Scope;
    readonly tree: ScopeTree;
    /** Every setting definition, in the server's order. */
    definitions(): readonly SettingDefinition[];
    definition(key: SettingKey): SettingDefinition | undefined;
    /** The effective value at this scope; undefined for a key the state does not hold. */
    value(key: SettingKey): SettingValue | undefined;
    /** The effective value at another scope, for rules that read a website's setting from a store view. */
    valueAt(key: SettingKey, scope: ScopeId): SettingValue | undefined;
    /** Whether this scope has a value of its own (the default scope always uses its own or the built-in). */
    isOwn(key: SettingKey): boolean;
    isLocked(key: SettingKey): boolean;
    isWithinReach(key: SettingKey): boolean;
    /**
     * Whether a person can change the value here right now: within reach, not locked, and either the default
     * scope or a scope that already overrides it. An inherited value has to be overridden first.
     */
    isEditable(key: SettingKey): boolean;
    events(): EventSelection;
    /** The events the store knows, in the server's order: what a selection is read against. */
    eventCatalogue(): EventCatalogue;
    /** The presets the store offers, in the server's order. */
    eventPresets(): readonly EventPreset[];
    isEventsOwn(): boolean;
    isEventsLocked(): boolean;
    /** How pages load Google at this scope. */
    mode(): Mode;
}

/** @throws UnknownScopeError */
export function viewOf(draft: Draft, scopeId: ScopeId): SettingsView {
    const tree = draft.state.tree;
    const scope = tree.get(scopeId);
    const has = (key: SettingKey): boolean => draft.state.settings.has(key);
    const valueAt = (key: SettingKey, at: ScopeId): SettingValue | undefined =>
        (has(key) ? effectiveAt(draft, at, key) : undefined);
    const isOwn = (key: SettingKey): boolean => has(key) && ownAt(draft, scopeId, key) !== undefined;
    const isLocked = (key: SettingKey): boolean => has(key) && lockAt(draft, scopeId, key) !== undefined;
    const withinReach = (key: SettingKey): boolean => has(key) && isWithinReach(draft, scopeId, key);

    return Object.freeze({
        scope,
        tree,
        definitions: (): readonly SettingDefinition[] =>
            [...draft.state.settings.values()].map((state) => state.definition),
        definition: (key: SettingKey): SettingDefinition | undefined => draft.state.settings.get(key)?.definition,
        value: (key: SettingKey): SettingValue | undefined => valueAt(key, scopeId),
        valueAt,
        isOwn,
        isLocked,
        isWithinReach: withinReach,
        isEditable: (key: SettingKey): boolean =>
            withinReach(key) && !isLocked(key) && (scopeId === DEFAULT_SCOPE || isOwn(key)),
        events: (): EventSelection => eventsAt(draft, scopeId),
        eventCatalogue: (): EventCatalogue => draft.state.events.catalogue,
        eventPresets: (): readonly EventPreset[] => draft.state.events.presets,
        isEventsOwn: (): boolean => eventsOwnAt(draft, scopeId) !== undefined,
        isEventsLocked: (): boolean => eventsLockAt(draft, scopeId) !== undefined,
        mode: (): Mode => resolveMode(
            textOf(valueAt(CONTAINER_ID, scopeId)),
            textOf(valueAt(MEASUREMENT_ID, scopeId)),
            draft.modePicks.get(scopeId),
        ),
    });
}
