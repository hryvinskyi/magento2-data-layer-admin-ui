/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Configuration scopes: the default scope, websites and store views, and the tree they form. A store view inherits
 * from its website, a website from the default scope.
 */
import type { Brand } from './brand.ts';
import { failure, success, type Result } from './result.ts';

export type ScopeId = Brand<string, 'ScopeId'>;
export type ScopeType = 'default' | 'website' | 'store';

const SCOPE_ID = /^(?:default|(?:website|store):[1-9]\d*)$/;
const SCOPE_TYPES: ReadonlySet<string> = new Set<ScopeType>(['default', 'website', 'store']);

export const isScopeType = (raw: string): raw is ScopeType => SCOPE_TYPES.has(raw);

export const isScopeId = (raw: string): raw is ScopeId => SCOPE_ID.test(raw);

/** `default`, `website:<id>` or `store:<id>`; anything else is not a scope id. */
export function parseScopeId(raw: string): ScopeId | null {
    return isScopeId(raw) ? raw : null;
}

/** For ids the code itself spells; throws on a malformed one. */
export function requireScopeId(raw: string): ScopeId {
    if (!isScopeId(raw)) {
        throw new RangeError(`Not a scope id: ${raw}`);
    }
    return raw;
}

export const DEFAULT_SCOPE: ScopeId = requireScopeId('default');

/** The type a scope id spells: its prefix. */
export function scopeTypeOf(id: ScopeId): ScopeType {
    if (id === DEFAULT_SCOPE) {
        return 'default';
    }
    return id.startsWith('website:') ? 'website' : 'store';
}

export interface Scope {
    readonly id: ScopeId;
    readonly type: ScopeType;
    readonly name: string;
    readonly code: string;
    readonly domain?: string;
    readonly parent: ScopeId | null;
}

/** A scope id the tree does not hold reached a query: a programming error, not a person's mistake. */
export class UnknownScopeError extends Error {
    readonly scope: string;

    constructor(scope: string) {
        super(`Unknown scope: ${scope}`);
        this.name = 'UnknownScopeError';
        this.scope = scope;
    }
}

export interface ScopeTree {
    /** Every scope, in the order the server sorted them (default, then each website followed by its store views). */
    readonly scopes: readonly Scope[];
    has(id: ScopeId): boolean;
    /** @throws UnknownScopeError */
    get(id: ScopeId): Scope;
    /** Position in `scopes`, for ordering lists by scope. @throws UnknownScopeError */
    indexOf(id: ScopeId): number;
    /** @throws UnknownScopeError */
    parentOf(id: ScopeId): ScopeId | null;
    /** Direct children, in tree order. @throws UnknownScopeError */
    childrenOf(id: ScopeId): readonly ScopeId[];
    /** The scope itself, then each ancestor up to and including the default scope. @throws UnknownScopeError */
    chain(id: ScopeId): readonly ScopeId[];
    /** The website a store view belongs to; a website is its own; the default scope has none. @throws UnknownScopeError */
    websiteOf(id: ScopeId): ScopeId | null;
}

export type ScopeTreeRefusalCode =
    | 'duplicate'
    | 'type_mismatch'
    | 'no_default'
    | 'dangling_parent'
    | 'cycle'
    | 'parent_type';

export interface ScopeTreeRefusal {
    readonly code: ScopeTreeRefusalCode;
    readonly scope: ScopeId;
}

/** Which type a scope's parent must have: websites hang off the default scope, store views off a website. */
const PARENT_TYPE = {
    default: null,
    website: 'default',
    store: 'website',
} as const satisfies Record<ScopeType, ScopeType | null>;

/**
 * Builds the tree, refusing a scope listed twice, an id whose prefix contradicts its type, a missing default
 * scope, a parent that is not in the list, a cycle, or a parent of the wrong type.
 */
export function createScopeTree(scopes: readonly Scope[]): Result<ScopeTree, ScopeTreeRefusal> {
    const byId = new Map<ScopeId, Scope>();
    for (const scope of scopes) {
        if (byId.has(scope.id)) {
            return failure({ code: 'duplicate', scope: scope.id });
        }
        if (scopeTypeOf(scope.id) !== scope.type) {
            return failure({ code: 'type_mismatch', scope: scope.id });
        }
        byId.set(scope.id, scope);
    }
    if (!byId.has(DEFAULT_SCOPE)) {
        return failure({ code: 'no_default', scope: DEFAULT_SCOPE });
    }
    for (const scope of scopes) {
        if (scope.parent !== null && !byId.has(scope.parent)) {
            return failure({ code: 'dangling_parent', scope: scope.id });
        }
    }
    for (const scope of scopes) {
        const seen = new Set<ScopeId>();
        for (let current: Scope | undefined = scope; current !== undefined;) {
            if (seen.has(current.id)) {
                return failure({ code: 'cycle', scope: scope.id });
            }
            seen.add(current.id);
            current = current.parent === null ? undefined : byId.get(current.parent);
        }
    }
    for (const scope of scopes) {
        const parentType = scope.parent === null ? null : (byId.get(scope.parent)?.type ?? null);
        if (parentType !== PARENT_TYPE[scope.type]) {
            return failure({ code: 'parent_type', scope: scope.id });
        }
    }

    return success(buildTree(Object.freeze([...scopes]), byId));
}

function buildTree(scopes: readonly Scope[], byId: ReadonlyMap<ScopeId, Scope>): ScopeTree {
    const order = new Map<ScopeId, number>(scopes.map((scope, index) => [scope.id, index]));
    const children = new Map<ScopeId, ScopeId[]>(scopes.map((scope) => [scope.id, []]));
    for (const scope of scopes) {
        if (scope.parent !== null) {
            children.get(scope.parent)?.push(scope.id);
        }
    }

    const get = (id: ScopeId): Scope => {
        const scope = byId.get(id);
        if (scope === undefined) {
            throw new UnknownScopeError(id);
        }
        return scope;
    };

    return Object.freeze({
        scopes,
        has: (id: ScopeId): boolean => byId.has(id),
        get,
        indexOf: (id: ScopeId): number => order.get(get(id).id) ?? -1,
        parentOf: (id: ScopeId): ScopeId | null => get(id).parent,
        childrenOf: (id: ScopeId): readonly ScopeId[] => Object.freeze([...(children.get(get(id).id) ?? [])]),
        chain: (id: ScopeId): readonly ScopeId[] => {
            const chain: ScopeId[] = [];
            for (let current: ScopeId | null = id; current !== null; current = get(current).parent) {
                chain.push(current);
            }
            return Object.freeze(chain);
        },
        websiteOf: (id: ScopeId): ScopeId | null => {
            const scope = get(id);
            if (scope.type === 'default') {
                return null;
            }
            return scope.type === 'website' ? scope.id : scope.parent;
        },
    });
}
