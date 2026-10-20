/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Where a field's value comes from at the scope being edited, as a field shows it next to the control. The answers
 * are checked in order, so each field has exactly one:
 *
 * 1. `locked`: deployment configuration fixes the value here; nothing in the wizard can change it.
 * 2. `outOfReach`: the setting cannot be set at this kind of scope; `target` is the scope where it can (the store
 *    view's website, or the default scope).
 * 3. `default`: the default scope, whose value (its own, or the built-in one when `own` is false) applies wherever
 *    no scope below sets one; `overriders` are the scopes below that do.
 * 4. `own`: a website or store view with a value of its own.
 * 5. `inherited`: a website or store view taking the value of the nearest ancestor that sets one, or the built-in.
 */
import {
    eventsLockAt,
    eventsOwnValues,
    isWithinReach,
    lockAt,
    ownValues,
    type Draft,
} from './draft.ts';
import { inheritedFrom, overriders, type OwnValues, type ValueSource } from './inheritance.ts';
import { DEFAULT_SCOPE, type ScopeId, type ScopeTree, type ScopeType } from './scope.ts';
import type { SettingKey } from './setting.ts';

export type FieldOrigin =
    | { readonly kind: 'locked'; readonly message: string }
    | { readonly kind: 'outOfReach'; readonly reach: ScopeType; readonly target: ScopeId | null }
    | { readonly kind: 'default'; readonly own: boolean; readonly overriders: readonly ScopeId[] }
    | { readonly kind: 'own'; readonly scopeType: Exclude<ScopeType, 'default'> }
    | { readonly kind: 'inherited'; readonly from: ValueSource };

export type FieldOriginKind = FieldOrigin['kind'];

interface OriginFacts {
    readonly tree: ScopeTree;
    readonly scope: ScopeId;
    readonly own: OwnValues<unknown>;
    readonly lock: string | undefined;
    readonly withinReach: boolean;
    readonly reach: ScopeType;
}

/** The scope a setting of this reach is set at, seen from a scope below its reach. */
function reachTarget(tree: ScopeTree, scope: ScopeId, reach: ScopeType): ScopeId | null {
    return reach === 'website' ? tree.websiteOf(scope) : DEFAULT_SCOPE;
}

function originOf(facts: OriginFacts): FieldOrigin {
    if (facts.lock !== undefined) {
        return { kind: 'locked', message: facts.lock };
    }
    if (!facts.withinReach) {
        return { kind: 'outOfReach', reach: facts.reach, target: reachTarget(facts.tree, facts.scope, facts.reach) };
    }
    const type = facts.tree.get(facts.scope).type;
    if (type === 'default') {
        return { kind: 'default', own: facts.own.has(facts.scope), overriders: overriders(facts.tree, facts.own) };
    }
    if (facts.own.has(facts.scope)) {
        return { kind: 'own', scopeType: type };
    }
    return { kind: 'inherited', from: inheritedFrom(facts.tree, facts.own, facts.scope) };
}

/** Where one setting's value comes from at `scope`, edits included. @throws UnknownSettingError, UnknownScopeError */
export function settingOrigin(draft: Draft, scope: ScopeId, key: SettingKey): FieldOrigin {
    const definition = draft.state.settings.get(key)?.definition;
    return originOf({
        tree: draft.state.tree,
        scope,
        own: ownValues(draft, key),
        lock: lockAt(draft, scope, key),
        withinReach: isWithinReach(draft, scope, key),
        reach: definition?.reach ?? 'store',
    });
}

/** Where the events selection comes from at `scope`, edits included. The selection can be set at every scope. */
export function eventsOrigin(draft: Draft, scope: ScopeId): FieldOrigin {
    return originOf({
        tree: draft.state.tree,
        scope,
        own: eventsOwnValues(draft),
        lock: eventsLockAt(draft, scope),
        withinReach: true,
        reach: 'store',
    });
}
