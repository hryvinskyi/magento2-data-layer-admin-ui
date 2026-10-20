/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDraft, setValue } from '@hryvinskyi/datalayer-setup';
import { multiWebsiteConfig, singleWebsiteConfig } from '../../test/fixtures/page-config.ts';
import { key, scope, stateOf } from '../../test/fixtures/setup-state.ts';
import { scopeCards } from './scope-cards.ts';

const draft = createDraft(stateOf(multiWebsiteConfig));

describe('scope cards', () => {
    it('describes the default scope without overrides', () => {
        const { root } = scopeCards(draft, 'Events');
        assert.equal(root.scope.id, 'default');
        assert.equal(root.tracking, true);
        assert.equal(root.container, 'GTM-AB12CD3');
        assert.deepEqual(root.overrides, []);
    });

    it('lists websites with their store views in the server order', () => {
        const { websites } = scopeCards(draft, 'Events');
        assert.deepEqual(websites.map((website) => website.scope.id), ['website:1', 'website:2']);
        assert.deepEqual(websites.map((website) => website.views.map((view) => view.scope.id)), [['store:1', 'store:2'], ['store:3']]);
    });

    it('names each setting a scope sets itself, the events setting last', () => {
        const { websites } = scopeCards(draft, 'Events');
        const [main, second] = websites;
        assert.deepEqual(main?.overrides, ['hidden_price']);
        assert.deepEqual(second?.overrides, ['container_id', 'brand', 'sample_days', 'Events']);
        assert.equal(second?.container, 'GTM-WH45EF6');
        assert.deepEqual(main?.views.map((view) => view.overrides), [['item_id'], []]);
        assert.deepEqual(second?.views.map((view) => [view.overrides, view.container]), [[['list_view'], 'GTM-WH45EF6']]);
    });

    it('follows edits made to the draft', () => {
        const switchedOff = setValue(draft, scope('default'), key('enabled'), false);
        assert.ok(switchedOff.ok);
        const emptied = setValue(switchedOff.value, scope('website:1'), key('container_id'), '');
        assert.ok(emptied.ok);

        const { root, websites } = scopeCards(emptied.value, 'Events');
        assert.equal(root.tracking, false);
        assert.equal(websites[0]?.tracking, false, 'a website inherits the switch');
        assert.equal(websites[0]?.container, '');
        assert.deepEqual(websites[0]?.overrides, ['container_id', 'hidden_price']);
        assert.equal(root.container, 'GTM-AB12CD3');
    });

    it('sees a shop with nothing to choose between', () => {
        assert.equal(scopeCards(createDraft(stateOf(singleWebsiteConfig)), 'Events').singleWebsite, true);
        assert.equal(scopeCards(draft, 'Events').singleWebsite, false);
    });
});
