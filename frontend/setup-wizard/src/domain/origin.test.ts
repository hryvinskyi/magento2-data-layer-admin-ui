/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { multiWebsiteConfig, LOCK_MESSAGE } from '../test/fixtures/page-config.ts';
import { key, scope, stateOf } from '../test/fixtures/setup-state.ts';
import { createDraft, inheritValue, setEvents, setValue, eventsAt, type Draft } from './draft.ts';
import { BUILT_IN } from './inheritance.ts';
import { eventsOrigin, settingOrigin } from './origin.ts';

const draft = createDraft(stateOf(multiWebsiteConfig));

function applied(result: { readonly ok: true; readonly value: Draft } | { readonly ok: false; readonly error: unknown }): Draft {
    assert.equal(result.ok, true, 'the edit applies');
    return result.ok ? result.value : draft;
}

describe('field origin', () => {
    it('names the lock first, whatever the scope holds', () => {
        assert.deepEqual(settingOrigin(draft, scope('website:1'), key('hidden_price')), { kind: 'locked', message: LOCK_MESSAGE });
    });

    it('points a scope below the reach at the scope where the setting is set', () => {
        assert.deepEqual(
            settingOrigin(draft, scope('store:3'), key('sample_days')),
            { kind: 'outOfReach', reach: 'website', target: 'website:2' },
        );
    });

    it('lists the scopes that override the default value, and says whether the default scope has its own', () => {
        assert.deepEqual(
            settingOrigin(draft, scope('default'), key('container_id')),
            { kind: 'default', own: true, overriders: ['website:2'] },
        );
        assert.deepEqual(
            settingOrigin(draft, scope('default'), key('script_host')),
            { kind: 'default', own: false, overriders: [] },
            'the built-in value applies everywhere',
        );
    });

    it('tells a scope with its own value from one that inherits, and from where', () => {
        assert.deepEqual(settingOrigin(draft, scope('website:2'), key('container_id')), { kind: 'own', scopeType: 'website' });
        assert.deepEqual(settingOrigin(draft, scope('store:1'), key('item_id')), { kind: 'own', scopeType: 'store' });
        assert.deepEqual(settingOrigin(draft, scope('store:3'), key('container_id')), { kind: 'inherited', from: 'website:2' });
        assert.deepEqual(settingOrigin(draft, scope('store:2'), key('script_host')), { kind: 'inherited', from: BUILT_IN });
    });

    it('follows the edits: an override makes the value own, inheriting again removes it', () => {
        const overridden = applied(setValue(draft, scope('store:2'), key('container_id'), 'GTM-STORE22'));
        assert.deepEqual(settingOrigin(overridden, scope('store:2'), key('container_id')), { kind: 'own', scopeType: 'store' });
        assert.deepEqual(
            settingOrigin(overridden, scope('default'), key('container_id')),
            { kind: 'default', own: true, overriders: ['store:2', 'website:2'] },
        );

        const inherited = applied(inheritValue(draft, scope('website:2'), key('container_id')));
        assert.deepEqual(settingOrigin(inherited, scope('website:2'), key('container_id')), { kind: 'inherited', from: 'default' });
    });

    it('answers the same questions for the events selection', () => {
        assert.deepEqual(eventsOrigin(draft, scope('website:2')), { kind: 'own', scopeType: 'website' });
        assert.deepEqual(eventsOrigin(draft, scope('store:3')), { kind: 'inherited', from: 'website:2' });
        assert.deepEqual(eventsOrigin(draft, scope('default')), { kind: 'default', own: true, overriders: ['website:2'] });

        const overridden = applied(setEvents(draft, scope('store:1'), eventsAt(draft, scope('store:1'))));
        assert.deepEqual(eventsOrigin(overridden, scope('store:1')), { kind: 'own', scopeType: 'store' });
    });
});
