/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { multiWebsiteConfig } from '../test/fixtures/page-config.ts';
import { scope, stateOf } from '../test/fixtures/setup-state.ts';
import { createScopeTree, parseScopeId, scopeTypeOf, UnknownScopeError, type Scope } from './scope.ts';

const tree = stateOf(multiWebsiteConfig).tree;

const node = (id: string, parent: string | null, type?: Scope['type']): Scope => ({
    id: scope(id),
    type: type ?? scopeTypeOf(scope(id)),
    name: id,
    code: id,
    parent: parent === null ? null : scope(parent),
});

describe('scope ids', () => {
    it('accepts the default scope, websites and store views', () => {
        for (const raw of ['default', 'website:1', 'store:12']) {
            assert.equal(parseScopeId(raw), raw);
        }
    });

    it('refuses anything else', () => {
        for (const raw of ['Default', 'website:0', 'store:', 'stores:1', 'website:1 ', 'store:-1', '']) {
            assert.equal(parseScopeId(raw), null, raw);
        }
    });

    it('reads the type from the prefix', () => {
        assert.equal(scopeTypeOf(scope('default')), 'default');
        assert.equal(scopeTypeOf(scope('website:3')), 'website');
        assert.equal(scopeTypeOf(scope('store:3')), 'store');
    });
});

describe('scope tree', () => {
    it('walks from a store view up to the default scope', () => {
        assert.deepEqual(tree.chain(scope('store:2')), ['store:2', 'website:1', 'default']);
        assert.deepEqual(tree.chain(scope('website:2')), ['website:2', 'default']);
        assert.deepEqual(tree.chain(scope('default')), ['default']);
    });

    it('knows parents and children in tree order', () => {
        assert.equal(tree.parentOf(scope('store:3')), 'website:2');
        assert.equal(tree.parentOf(scope('default')), null);
        assert.deepEqual(tree.childrenOf(scope('default')), ['website:1', 'website:2']);
        assert.deepEqual(tree.childrenOf(scope('website:1')), ['store:1', 'store:2']);
        assert.deepEqual(tree.childrenOf(scope('store:1')), []);
    });

    it('finds the website of a store view, a website is its own, the default scope has none', () => {
        assert.equal(tree.websiteOf(scope('store:3')), 'website:2');
        assert.equal(tree.websiteOf(scope('website:1')), 'website:1');
        assert.equal(tree.websiteOf(scope('default')), null);
    });

    it('keeps the server order', () => {
        assert.deepEqual(tree.scopes.map((item) => item.id), ['default', 'website:1', 'store:1', 'store:2', 'website:2', 'store:3']);
        assert.equal(tree.indexOf(scope('website:2')), 4);
    });

    it('fails loudly on a scope it does not hold', () => {
        assert.equal(tree.has(scope('store:9')), false);
        assert.throws(() => tree.chain(scope('store:9')), UnknownScopeError);
        assert.throws(() => tree.get(scope('website:9')), UnknownScopeError);
    });

    const refusals: readonly [string, readonly Scope[], string, string][] = [
        ['a scope listed twice', [node('default', null), node('website:1', 'default'), node('website:1', 'default')], 'duplicate', 'website:1'],
        ['a type its id contradicts', [node('default', null), node('website:1', 'default', 'store')], 'type_mismatch', 'website:1'],
        ['no default scope', [node('website:1', null)], 'no_default', 'default'],
        ['a parent outside the list', [node('default', null), node('store:1', 'website:7')], 'dangling_parent', 'store:1'],
        ['a cycle', [node('default', null), node('website:1', 'store:1'), node('store:1', 'website:1')], 'cycle', 'website:1'],
        ['a store view hanging off the default scope', [node('default', null), node('store:1', 'default')], 'parent_type', 'store:1'],
        ['a website hanging off a website', [node('default', null), node('website:1', 'default'), node('website:2', 'website:1')], 'parent_type', 'website:2'],
    ];
    for (const [name, scopes, code, at] of refusals) {
        it(`refuses ${name}`, () => {
            assert.deepEqual(createScopeTree(scopes), { ok: false, error: { code, scope: at } });
        });
    }
});
