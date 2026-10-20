/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { multiWebsiteConfig } from '../test/fixtures/page-config.ts';
import { scope, stateOf } from '../test/fixtures/setup-state.ts';
import {
    BUILT_IN,
    effectiveValue,
    inheritedFrom,
    isEditableAt,
    overriders,
    sourceOf,
    type OwnValues,
} from './inheritance.ts';
import type { ScopeId, ScopeType } from './scope.ts';

const tree = stateOf(multiWebsiteConfig).tree;
const own = (rows: Record<string, string>): OwnValues<string> =>
    new Map(Object.entries(rows).map(([id, value]): [ScopeId, string] => [scope(id), value]));

describe('effective value', () => {
    const values = own({ default: 'D', 'website:1': 'W1', 'store:2': 'S2' });

    it('uses the scope\'s own value', () => {
        assert.equal(effectiveValue(tree, values, 'B', scope('store:2')), 'S2');
        assert.equal(sourceOf(tree, values, scope('store:2')), 'store:2');
    });

    it('inherits the nearest ancestor\'s value: store view from its website', () => {
        assert.equal(effectiveValue(tree, values, 'B', scope('store:1')), 'W1');
        assert.equal(sourceOf(tree, values, scope('store:1')), 'website:1');
    });

    it('inherits the default scope\'s value where the website sets none', () => {
        assert.equal(effectiveValue(tree, values, 'B', scope('store:3')), 'D');
        assert.equal(effectiveValue(tree, values, 'B', scope('website:2')), 'D');
    });

    it('falls back to the built-in default when no scope in the chain sets one', () => {
        const websiteOnly = own({ 'website:1': 'W1' });
        assert.equal(effectiveValue(tree, websiteOnly, 'B', scope('store:3')), 'B');
        assert.equal(effectiveValue(tree, websiteOnly, 'B', scope('default')), 'B');
        assert.equal(sourceOf(tree, websiteOnly, scope('store:3')), BUILT_IN);
    });

    it('says where a scope would inherit from, ignoring its own value', () => {
        assert.equal(inheritedFrom(tree, values, scope('store:2')), 'website:1');
        assert.equal(inheritedFrom(tree, values, scope('website:1')), 'default');
        assert.equal(inheritedFrom(tree, values, scope('default')), BUILT_IN);
        assert.equal(inheritedFrom(tree, own({ 'website:2': 'W2' }), scope('website:2')), BUILT_IN);
    });

    it('lists the scopes below default that override, in tree order', () => {
        assert.deepEqual(overriders(tree, values), ['website:1', 'store:2']);
        assert.deepEqual(overriders(tree, own({ default: 'D' })), []);
    });
});

describe('reach', () => {
    const at = (id: string) => tree.get(scope(id));
    const cases: readonly [ScopeType, string, boolean][] = [
        ['store', 'store:1', true],
        ['store', 'website:1', true],
        ['store', 'default', true],
        ['website', 'store:1', false],
        ['website', 'website:1', true],
        ['website', 'default', true],
        ['default', 'website:1', false],
        ['default', 'default', true],
    ];
    for (const [reach, id, expected] of cases) {
        it(`a ${reach}-reach setting ${expected ? 'can' : 'cannot'} be set at ${id}`, () => {
            assert.equal(isEditableAt({ reach }, at(id)), expected);
        });
    }
});
