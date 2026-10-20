/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * How a value reaches a scope. A scope uses its own value when it has one, else the nearest ancestor's (store view
 * → website → default), else the built-in default. The server re-derives all of this on save; the browser computes
 * it only to show what a person's edits will do.
 */
import type { Scope, ScopeId, ScopeTree, ScopeType } from './scope.ts';

/** The values set at each scope (a scope without an entry inherits). */
export type OwnValues<V> = ReadonlyMap<ScopeId, V>;

export const BUILT_IN = 'builtIn';
/** Where an effective value comes from: a scope's own value, or the built-in default. */
export type ValueSource = ScopeId | typeof BUILT_IN;

function firstOwner<V>(own: OwnValues<V>, chain: readonly ScopeId[]): ValueSource {
    return chain.find((id) => own.has(id)) ?? BUILT_IN;
}

/** The scope whose value applies at `scope`, the scope itself included. */
export function sourceOf<V>(tree: ScopeTree, own: OwnValues<V>, scope: ScopeId): ValueSource {
    return firstOwner(own, tree.chain(scope));
}

/** Where `scope` would take its value from without a value of its own: the nearest ancestor's, or the built-in. */
export function inheritedFrom<V>(tree: ScopeTree, own: OwnValues<V>, scope: ScopeId): ValueSource {
    return firstOwner(own, tree.chain(scope).slice(1));
}

/** The value that applies at `scope`. */
export function effectiveValue<V>(tree: ScopeTree, own: OwnValues<V>, builtIn: V, scope: ScopeId): V {
    const source = sourceOf(tree, own, scope);
    return source === BUILT_IN ? builtIn : (own.get(source) ?? builtIn);
}

/** Scopes below the default scope that set their own value, in tree order. */
export function overriders<V>(tree: ScopeTree, own: OwnValues<V>): readonly ScopeId[] {
    return tree.scopes.filter((scope) => scope.type !== 'default' && own.has(scope.id)).map((scope) => scope.id);
}

const DEPTH = { default: 0, website: 1, store: 2 } as const satisfies Record<ScopeType, number>;

/**
 * Whether a setting can be set at a scope at all: a website-only setting is not set per store view, a
 * default-only one only at the default scope.
 */
export function isEditableAt(definition: { readonly reach: ScopeType }, scope: Scope): boolean {
    return DEPTH[scope.type] <= DEPTH[definition.reach];
}
