/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { multiWebsiteConfig } from '../test/fixtures/page-config.ts';
import { eventName, key, scope, stateOf } from '../test/fixtures/setup-state.ts';
import { createDraft, setValue } from './draft.ts';
import { UnknownScopeError } from './scope.ts';
import { viewOf } from './view.ts';

const draft = createDraft(stateOf(multiWebsiteConfig));

describe('settings view', () => {
    it('reads effective values at its scope and at others', () => {
        const view = viewOf(draft, scope('store:3'));
        assert.equal(view.value(key('container_id')), 'GTM-WH45EF6');
        assert.equal(view.valueAt(key('container_id'), scope('store:1')), 'GTM-AB12CD3');
        assert.equal(view.value(key('missing')), undefined);
        assert.equal(view.definition(key('brand'))?.step, 'products');
        assert.equal(view.definitions().length, multiWebsiteConfig.state.settings.length);
    });

    it('says what a person can change here', () => {
        const store = viewOf(draft, scope('store:1'));
        assert.equal(store.isOwn(key('item_id')), true);
        assert.equal(store.isEditable(key('item_id')), true);
        assert.equal(store.isOwn(key('container_id')), false);
        assert.equal(store.isEditable(key('container_id')), false, 'inherited until overridden');
        assert.equal(store.isWithinReach(key('sample_days')), false);
        assert.equal(store.isEditable(key('sample_days')), false, 'website-only');

        const website = viewOf(draft, scope('website:1'));
        assert.equal(website.isLocked(key('hidden_price')), true);
        assert.equal(website.isEditable(key('hidden_price')), false, 'locked');

        const root = viewOf(draft, scope('default'));
        assert.equal(root.isOwn(key('brand')), false);
        assert.equal(root.isEditable(key('brand')), true, 'the default scope edits the built-in directly');
    });

    it('reads the events setting', () => {
        assert.equal(viewOf(draft, scope('store:3')).events().off.has(eventName('login')), true);
        assert.equal(viewOf(draft, scope('website:2')).isEventsOwn(), true);
        assert.equal(viewOf(draft, scope('store:3')).isEventsOwn(), false);
        assert.equal(viewOf(draft, scope('store:3')).isEventsLocked(), false);
    });

    it('offers the event catalogue and the presets a selection is read against, at every scope', () => {
        const view = viewOf(draft, scope('store:3'));
        assert.deepEqual(
            view.eventCatalogue().events.map((event) => event.name),
            multiWebsiteConfig.state.events.catalogue.map((event) => event.name),
        );
        assert.deepEqual(view.eventPresets().map((preset) => preset.key), ['standard', 'minimal']);
        assert.equal(viewOf(draft, scope('default')).eventCatalogue(), view.eventCatalogue());
    });

    it('follows the draft it was built from', () => {
        const edited = setValue(draft, scope('website:2'), key('container_id'), '');
        assert.ok(edited.ok);
        assert.equal(viewOf(edited.value, scope('store:3')).value(key('container_id')), '');
        assert.equal(viewOf(draft, scope('store:3')).value(key('container_id')), 'GTM-WH45EF6');
    });

    it('fails loudly on a scope the tree does not hold', () => {
        assert.throws(() => viewOf(draft, scope('store:9')), UnknownScopeError);
    });
});
