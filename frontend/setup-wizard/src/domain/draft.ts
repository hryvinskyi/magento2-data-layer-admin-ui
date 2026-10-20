/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The wizard's working copy: the stored snapshot plus the person's edits, keyed by scope and setting. Nothing here
 * reaches the store; a save sends the edits and the server answers with the next snapshot.
 *
 * Every operation returns a new draft. An edit that would leave a scope as it is stored is not kept, so the edits
 * are always exactly the pending changes. A scope where deployment configuration locks a setting, or that lies
 * below the setting's reach, cannot be edited; the default scope always has a value, so it cannot inherit.
 */
import { sameSelection, type EventSelection } from './events.ts';
import { effectiveValue, isEditableAt, type OwnValues } from './inheritance.ts';
import type { Mode } from './mode.ts';
import { failure, success, type Result } from './result.ts';
import { DEFAULT_SCOPE, type ScopeId } from './scope.ts';
import {
    acceptsEdit,
    EVENTS_KEY,
    sameValue,
    UnknownSettingError,
    type EditValue,
    type EventsKey,
    type SettingKey,
    type SettingValue,
} from './setting.ts';
import type { SettingState, SetupState } from './setup-state.ts';

export type Edit<V> = { readonly op: 'set'; readonly value: V } | { readonly op: 'inherit' };

export interface Draft {
    readonly state: SetupState;
    readonly settingEdits: ReadonlyMap<SettingKey, ReadonlyMap<ScopeId, Edit<EditValue>>>;
    readonly eventEdits: ReadonlyMap<ScopeId, Edit<EventSelection>>;
    /** Modes picked per scope before the IDs could say so; remembered for the session, never saved. */
    readonly modePicks: ReadonlyMap<ScopeId, Mode>;
}

export type DraftRefusal =
    | 'unknown_scope'
    | 'unknown_setting'
    | 'out_of_reach'
    | 'locked'
    | 'default_scope'
    | 'wrong_kind';

/** Names one pending edit: a setting at a scope, or the events setting at a scope. */
export interface EditRef {
    readonly scope: ScopeId;
    readonly key: SettingKey | EventsKey;
}

const NO_EDITS: ReadonlyMap<ScopeId, never> = new Map<ScopeId, never>();

export function createDraft(state: SetupState): Draft {
    return Object.freeze({
        state,
        settingEdits: new Map<SettingKey, ReadonlyMap<ScopeId, Edit<EditValue>>>(),
        eventEdits: new Map<ScopeId, Edit<EventSelection>>(),
        modePicks: new Map<ScopeId, Mode>(),
    });
}

function settingState(draft: Draft, key: SettingKey): SettingState {
    const state = draft.state.settings.get(key);
    if (state === undefined) {
        throw new UnknownSettingError(key);
    }
    return state;
}

function overlay<V>(stored: OwnValues<V>, edits: ReadonlyMap<ScopeId, Edit<V>>): OwnValues<V> {
    const own = new Map(stored);
    for (const [scope, edit] of edits) {
        if (edit.op === 'set') {
            own.set(scope, edit.value);
        } else {
            own.delete(scope);
        }
    }
    return own;
}

function withEdit<V>(
    edits: ReadonlyMap<ScopeId, Edit<V>>,
    scope: ScopeId,
    edit: Edit<V> | null,
): ReadonlyMap<ScopeId, Edit<V>> {
    const next = new Map(edits);
    if (edit === null) {
        next.delete(scope);
    } else {
        next.set(scope, edit);
    }
    return next;
}

function withSettingEdits(
    draft: Draft,
    key: SettingKey,
    edits: ReadonlyMap<ScopeId, Edit<EditValue>>,
): Draft {
    const settingEdits = new Map(draft.settingEdits);
    if (edits.size === 0) {
        settingEdits.delete(key);
    } else {
        settingEdits.set(key, edits);
    }
    return Object.freeze({ ...draft, settingEdits });
}

/** The values set at each scope once the edits apply. */
export function ownValues(draft: Draft, key: SettingKey): OwnValues<SettingValue> {
    return overlay<SettingValue>(settingState(draft, key).stored, draft.settingEdits.get(key) ?? NO_EDITS);
}

/** The value set at the scope itself, if any. */
export function ownAt(draft: Draft, scope: ScopeId, key: SettingKey): SettingValue | undefined {
    draft.state.tree.get(scope);
    return ownValues(draft, key).get(scope);
}

/** The value that applies at the scope once the edits apply. */
export function effectiveAt(draft: Draft, scope: ScopeId, key: SettingKey): SettingValue {
    return effectiveValue<SettingValue>(
        draft.state.tree,
        ownValues(draft, key),
        settingState(draft, key).builtIn,
        scope,
    );
}

/** Why the setting cannot be changed at the scope, when deployment configuration locks it there. */
export function lockAt(draft: Draft, scope: ScopeId, key: SettingKey): string | undefined {
    return settingState(draft, key).locks.get(scope);
}

/** Whether the setting can be set at the scope at all (its reach). */
export function isWithinReach(draft: Draft, scope: ScopeId, key: SettingKey): boolean {
    return isEditableAt(settingState(draft, key).definition, draft.state.tree.get(scope));
}

function writable(draft: Draft, scope: ScopeId, key: SettingKey): Result<SettingState, DraftRefusal> {
    if (!draft.state.tree.has(scope)) {
        return failure('unknown_scope');
    }
    const state = draft.state.settings.get(key);
    if (state === undefined) {
        return failure('unknown_setting');
    }
    if (!isEditableAt(state.definition, draft.state.tree.get(scope))) {
        return failure('out_of_reach');
    }
    if (state.locks.has(scope)) {
        return failure('locked');
    }
    return success(state);
}

/**
 * Whether the value is blank replacement text for a secret the scope itself holds as not set (its own row, or at
 * the default scope the built-in value): there is nothing to replace and nothing typed, so it changes nothing. At a
 * scope that inherits, blank replacement text is how an override starts, so it stays an edit there.
 */
function replacesNothing(state: SettingState, scope: ScopeId, value: EditValue): boolean {
    if (typeof value !== 'object' || value.replace.trim() !== '') {
        return false;
    }
    const own = state.stored.get(scope) ?? (scope === DEFAULT_SCOPE ? state.builtIn : undefined);
    return typeof own === 'object' && 'set' in own && !own.set;
}

/** Give the scope its own value. */
export function setValue(draft: Draft, scope: ScopeId, key: SettingKey, value: EditValue): Result<Draft, DraftRefusal> {
    const checked = writable(draft, scope, key);
    if (!checked.ok) {
        return checked;
    }
    if (!acceptsEdit(checked.value.definition.kind, value)) {
        return failure('wrong_kind');
    }
    const stored = checked.value.stored.get(scope);
    const unchanged = (stored !== undefined && sameValue(value, stored)) || replacesNothing(checked.value, scope, value);
    const edits = withEdit(draft.settingEdits.get(key) ?? NO_EDITS, scope, unchanged ? null : { op: 'set', value });
    return success(withSettingEdits(draft, key, edits));
}

/** Remove the scope's own value, so it inherits again. */
export function inheritValue(draft: Draft, scope: ScopeId, key: SettingKey): Result<Draft, DraftRefusal> {
    if (scope === DEFAULT_SCOPE) {
        return failure('default_scope');
    }
    const checked = writable(draft, scope, key);
    if (!checked.ok) {
        return checked;
    }
    const unchanged = !checked.value.stored.has(scope);
    const edits = withEdit(draft.settingEdits.get(key) ?? NO_EDITS, scope, unchanged ? null : { op: 'inherit' });
    return success(withSettingEdits(draft, key, edits));
}

/** The events values set at each scope once the edits apply. */
export function eventsOwnValues(draft: Draft): OwnValues<EventSelection> {
    return overlay(draft.state.events.stored, draft.eventEdits);
}

export function eventsOwnAt(draft: Draft, scope: ScopeId): EventSelection | undefined {
    draft.state.tree.get(scope);
    return eventsOwnValues(draft).get(scope);
}

export function eventsAt(draft: Draft, scope: ScopeId): EventSelection {
    return effectiveValue(draft.state.tree, eventsOwnValues(draft), draft.state.events.builtIn, scope);
}

export function eventsLockAt(draft: Draft, scope: ScopeId): string | undefined {
    return draft.state.events.locks.get(scope);
}

function eventsWritable(draft: Draft, scope: ScopeId): DraftRefusal | null {
    if (!draft.state.tree.has(scope)) {
        return 'unknown_scope';
    }
    return draft.state.events.locks.has(scope) ? 'locked' : null;
}

/** Give the scope its own event selection (built with the catalogue, so it is already normalised). */
export function setEvents(draft: Draft, scope: ScopeId, selection: EventSelection): Result<Draft, DraftRefusal> {
    const refusal = eventsWritable(draft, scope);
    if (refusal !== null) {
        return failure(refusal);
    }
    const stored = draft.state.events.stored.get(scope);
    const unchanged = stored !== undefined && sameSelection(selection, stored);
    const eventEdits = withEdit(draft.eventEdits, scope, unchanged ? null : { op: 'set', value: selection });
    return success(Object.freeze({ ...draft, eventEdits }));
}

/** Remove the scope's own event selection (both stored rows), so it inherits again. */
export function inheritEvents(draft: Draft, scope: ScopeId): Result<Draft, DraftRefusal> {
    if (scope === DEFAULT_SCOPE) {
        return failure('default_scope');
    }
    const refusal = eventsWritable(draft, scope);
    if (refusal !== null) {
        return failure(refusal);
    }
    const unchanged = !draft.state.events.stored.has(scope);
    const eventEdits = withEdit(draft.eventEdits, scope, unchanged ? null : { op: 'inherit' });
    return success(Object.freeze({ ...draft, eventEdits }));
}

/** Remember a mode picked at a scope. @throws UnknownScopeError */
export function withModePick(draft: Draft, scope: ScopeId, mode: Mode): Draft {
    draft.state.tree.get(scope);
    const modePicks = new Map(draft.modePicks);
    modePicks.set(scope, mode);
    return Object.freeze({ ...draft, modePicks });
}

/** Drop every edit and pick: back to the stored snapshot. */
export function reset(draft: Draft): Draft {
    return createDraft(draft.state);
}

/** Drop the pending edit of one setting (or the events setting) at one scope. */
export function resetAt(draft: Draft, ref: EditRef): Draft {
    if (ref.key === EVENTS_KEY) {
        return Object.freeze({ ...draft, eventEdits: withEdit(draft.eventEdits, ref.scope, null) });
    }
    return withSettingEdits(draft, ref.key, withEdit(draft.settingEdits.get(ref.key) ?? NO_EDITS, ref.scope, null));
}

function applySettingEdit(draft: Draft, scope: ScopeId, key: SettingKey, edit: Edit<EditValue>): Draft {
    const applied = edit.op === 'set' ? setValue(draft, scope, key, edit.value) : inheritValue(draft, scope, key);
    return applied.ok ? applied.value : draft;
}

function applyEventsEdit(draft: Draft, scope: ScopeId, edit: Edit<EventSelection>): Draft {
    const applied = edit.op === 'set' ? setEvents(draft, scope, edit.value) : inheritEvents(draft, scope);
    return applied.ok ? applied.value : draft;
}

/**
 * Move the draft onto a new snapshot (what a save answers), keeping only the edits `keep` names. A kept edit the
 * new snapshot already holds, or can no longer take (its scope or setting is gone, or now locked), is dropped.
 */
export function rebase(draft: Draft, state: SetupState, keep: (ref: EditRef) => boolean): Draft {
    let next = createDraft(state);
    for (const [key, edits] of draft.settingEdits) {
        for (const [scope, edit] of edits) {
            if (keep({ scope, key })) {
                next = applySettingEdit(next, scope, key, edit);
            }
        }
    }
    for (const [scope, edit] of draft.eventEdits) {
        if (keep({ scope, key: EVENTS_KEY })) {
            next = applyEventsEdit(next, scope, edit);
        }
    }
    const modePicks = new Map([...draft.modePicks].filter(([scope]) => state.tree.has(scope)));
    return Object.freeze({ ...next, modePicks });
}
