/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * One setting as a field sees it at the current scope: its value, where the value comes from, whether it can be
 * changed here, and the actions a field offers. Problems show only once the field was touched (or a refused
 * Continue named it), and only where the person can fix them.
 */
import { useMemo } from 'preact/hooks';
import { effectiveAt, lockAt, ownValues, resetAt, type Draft } from '../../domain/draft.ts';
import { inheritedFrom, type ValueSource } from '../../domain/inheritance.ts';
import { settingOrigin, type FieldOrigin } from '../../domain/origin.ts';
import type { Scope, ScopeId, ScopeTree } from '../../domain/scope.ts';
import {
    UnknownSettingError,
    type EditValue,
    type SettingDefinition,
    type SettingKey,
    type SettingValue,
} from '../../domain/setting.ts';
import { settingIssues, type IssueCode } from '../../domain/validation.ts';
import { useRuntimeValue } from '../../sdk/context.tsx';
import { useWizard } from './use-wizard.ts';

export interface ScopeBinding {
    readonly scope: Scope;
    readonly tree: ScopeTree;
    /** Edit another scope; the draft is kept, what was touched is forgotten. */
    select(scope: ScopeId): void;
}

export function useScope(): ScopeBinding {
    const { view, dispatch } = useWizard();
    return {
        scope: view.scope,
        tree: view.tree,
        select: (scope: ScopeId): void => dispatch({ type: 'setScope', scope }),
    };
}

export interface SettingBinding {
    readonly definition: SettingDefinition;
    /** The value that applies here once the edits apply. */
    readonly value: SettingValue;
    /** Whether this scope has a value of its own. */
    readonly own: boolean;
    /** Where the value would come from without one: the nearest ancestor that sets it, or the built-in default. */
    readonly inheritedFrom: ValueSource;
    /** Within reach, not locked, and either the default scope or already overridden here. */
    readonly editable: boolean;
    /** Whether the setting can be set at this scope at all. */
    readonly withinReach: boolean;
    /** Why deployment configuration locks it here. */
    readonly lock: string | null;
    /** Where the value comes from here, as the field's origin line shows it. */
    readonly origin: FieldOrigin;
    readonly touched: boolean;
    /** The first problem to show: only once touched, and only where the person can change the value. */
    readonly error: IssueCode | null;
    /** Whether this scope has a pending change of the setting. */
    readonly changed: boolean;
    /** Whether a new secret is being typed over one the store keeps, which `discard()` keeps instead. */
    readonly replacing: boolean;
    set(value: EditValue): void;
    inherit(): void;
    override(): void;
    touch(): void;
    /** Drops this scope's pending change, back to what is stored. */
    discard(): void;
}

/** Whether the scope's pending value replaces a secret it would otherwise keep. */
function replacesStoredSecret(draft: Draft, scope: ScopeId, key: SettingKey, value: SettingValue): boolean {
    if (typeof value !== 'object' || !('replace' in value)) {
        return false;
    }
    const kept = effectiveAt(resetAt(draft, { scope, key }), scope, key);
    return typeof kept === 'object' && 'set' in kept && kept.set;
}

/** @throws UnknownSettingError for a key the page state does not hold */
export function useSetting(key: SettingKey): SettingBinding {
    const { runtime } = useRuntimeValue();
    const { state, view, dispatch } = useWizard();
    const definition = view.definition(key);
    const value = view.value(key);
    if (definition === undefined || value === undefined) {
        throw new UnknownSettingError(key);
    }
    const scope = state.scope;
    const editable = view.isEditable(key);
    const touched = state.touched.has(key);
    const issues = useMemo(() => settingIssues(key, view, runtime.requirements), [key, view, runtime]);
    const source = useMemo(
        () => inheritedFrom(state.draft.state.tree, ownValues(state.draft, key), scope),
        [state.draft, key, scope],
    );
    const origin = useMemo(() => settingOrigin(state.draft, scope, key), [state.draft, key, scope]);
    const replacing = useMemo(() => replacesStoredSecret(state.draft, scope, key, value), [state.draft, scope, key, value]);

    return {
        definition,
        value,
        own: view.isOwn(key),
        inheritedFrom: source,
        editable,
        withinReach: view.isWithinReach(key),
        lock: lockAt(state.draft, scope, key) ?? null,
        origin,
        touched,
        error: touched && editable ? (issues[0] ?? null) : null,
        changed: state.draft.settingEdits.get(key)?.has(scope) ?? false,
        replacing,
        set: (next: EditValue): void => dispatch({ type: 'set', scope, key, value: next }),
        inherit: (): void => dispatch({ type: 'inherit', scope, key }),
        override: (): void => dispatch({ type: 'override', scope, key }),
        touch: (): void => dispatch({ type: 'touch', key }),
        discard: (): void => dispatch({ type: 'discardChange', ref: { scope, key } }),
    };
}
