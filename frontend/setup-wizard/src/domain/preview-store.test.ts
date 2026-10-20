/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { multiWebsiteConfig } from '../test/fixtures/page-config.ts';
import { scope, stateOf } from '../test/fixtures/setup-state.ts';
import { previewStoreOf } from './preview-store.ts';
import { createScopeTree } from './scope.ts';

const tree = stateOf(multiWebsiteConfig).tree;

describe('previewStoreOf', () => {
    it('is the scope itself for a store view', () => {
        assert.equal(previewStoreOf(tree, scope('store:2')), 'store:2');
    });

    it('is the first store view of a website, in tree order', () => {
        assert.equal(previewStoreOf(tree, scope('website:1')), 'store:1');
        assert.equal(previewStoreOf(tree, scope('website:2')), 'store:3');
    });

    it('is the first store view of the first website for the default scope', () => {
        assert.equal(previewStoreOf(tree, scope('default')), 'store:1');
    });

    it('is nothing when no store view sits under the scope', () => {
        const built = createScopeTree([
            { id: scope('default'), type: 'default', name: 'Default', code: 'default', parent: null },
            { id: scope('website:1'), type: 'website', name: 'Main', code: 'main', parent: scope('default') },
        ]);
        assert.ok(built.ok);

        assert.equal(previewStoreOf(built.value, scope('default')), null);
        assert.equal(previewStoreOf(built.value, scope('website:1')), null);
    });
});
