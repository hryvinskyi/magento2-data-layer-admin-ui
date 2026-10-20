/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The stored snapshot the server sends: the scope tree, each setting with its built-in default, the values stored
 * per scope and the scopes where deployment configuration locks it, and the same for the events setting.
 *
 * Stored values and locks only name scopes of the tree, and only scopes within the setting's reach.
 */
import type { EventCatalogue, EventPreset, EventSelection } from './events.ts';
import type { OwnValues } from './inheritance.ts';
import type { ScopeId, ScopeTree } from './scope.ts';
import type { SettingDefinition, SettingKey, StoredValue } from './setting.ts';

export interface SettingState {
    readonly definition: SettingDefinition;
    readonly builtIn: StoredValue;
    readonly stored: OwnValues<StoredValue>;
    /** Scope → the server's explanation of why the value cannot be changed there. */
    readonly locks: ReadonlyMap<ScopeId, string>;
}

export interface EventsState {
    readonly catalogue: EventCatalogue;
    readonly presets: readonly EventPreset[];
    readonly builtIn: EventSelection;
    readonly stored: OwnValues<EventSelection>;
    readonly locks: ReadonlyMap<ScopeId, string>;
}

export interface SetupState {
    readonly tree: ScopeTree;
    /** In the order the server listed the definitions. */
    readonly settings: ReadonlyMap<SettingKey, SettingState>;
    readonly events: EventsState;
}
