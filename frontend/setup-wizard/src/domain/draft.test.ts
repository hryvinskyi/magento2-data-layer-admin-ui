/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LOCK_MESSAGE, multiWebsiteConfig, withSetting } from '../test/fixtures/page-config.ts';
import { eventName, key, scope, stateOf } from '../test/fixtures/setup-state.ts';
import {
    createDraft,
    effectiveAt,
    eventsAt,
    eventsOwnAt,
    inheritEvents,
    inheritValue,
    lockAt,
    ownAt,
    rebase,
    reset,
    resetAt,
    setEvents,
    setValue,
    type Draft,
    type DraftRefusal,
} from './draft.ts';
import { applyPreset, toggle } from './events.ts';
import type { Result } from './result.ts';
import { EVENTS_KEY } from './setting.ts';

const state = stateOf(multiWebsiteConfig);
const CONTAINER = key('container_id');

function ok(result: Result<Draft, DraftRefusal>): Draft {
    if (!result.ok) {
        throw new assert.AssertionError({ message: `Refused: ${result.error}` });
    }
    return result.value;
}

const refusal = (result: Result<Draft, DraftRefusal>): DraftRefusal | null => (result.ok ? null : result.error);

describe('draft values', () => {
    it('starts as the stored snapshot', () => {
        const draft = createDraft(state);
        assert.equal(effectiveAt(draft, scope('store:3'), CONTAINER), 'GTM-WH45EF6');
        assert.equal(effectiveAt(draft, scope('store:1'), CONTAINER), 'GTM-AB12CD3');
        assert.equal(ownAt(draft, scope('store:1'), CONTAINER), undefined);
        assert.equal(lockAt(draft, scope('website:1'), key('hidden_price')), LOCK_MESSAGE);
    });

    it('sets a website value its store views inherit, leaving the original draft unchanged', () => {
        const draft = createDraft(state);
        const next = ok(setValue(draft, scope('website:1'), CONTAINER, 'GTM-NEW1'));
        assert.equal(ownAt(next, scope('website:1'), CONTAINER), 'GTM-NEW1');
        assert.equal(effectiveAt(next, scope('store:2'), CONTAINER), 'GTM-NEW1');
        assert.equal(effectiveAt(draft, scope('store:2'), CONTAINER), 'GTM-AB12CD3');
    });

    it('keeps no edit that would leave the scope as stored', () => {
        const draft = ok(setValue(createDraft(state), scope('website:2'), CONTAINER, 'GTM-WH45EF6'));
        assert.equal(draft.settingEdits.size, 0);
        const back = ok(setValue(ok(setValue(createDraft(state), scope('default'), CONTAINER, 'GTM-X')), scope('default'), CONTAINER, 'GTM-AB12CD3'));
        assert.equal(back.settingEdits.size, 0);
    });

    it('inherits by removing the scope\'s own value', () => {
        const draft = ok(inheritValue(createDraft(state), scope('website:2'), CONTAINER));
        assert.equal(ownAt(draft, scope('website:2'), CONTAINER), undefined);
        assert.equal(effectiveAt(draft, scope('store:3'), CONTAINER), 'GTM-AB12CD3');
        assert.deepEqual(draft.settingEdits.get(CONTAINER)?.get(scope('website:2')), { op: 'inherit' });
    });

    it('records nothing when inheriting at a scope that already inherits', () => {
        assert.equal(ok(inheritValue(createDraft(state), scope('store:1'), CONTAINER)).settingEdits.size, 0);
    });

    it('drops a pending set when the scope goes back to inheriting', () => {
        const set = ok(setValue(createDraft(state), scope('store:1'), CONTAINER, 'GTM-S1'));
        assert.equal(ok(inheritValue(set, scope('store:1'), CONTAINER)).settingEdits.size, 0);
    });

    it('refuses what the scope cannot take', () => {
        const draft = createDraft(state);
        assert.equal(refusal(inheritValue(draft, scope('default'), CONTAINER)), 'default_scope');
        assert.equal(refusal(setValue(draft, scope('website:1'), key('hidden_price'), 'omit')), 'locked');
        assert.equal(refusal(inheritValue(draft, scope('website:1'), key('hidden_price'))), 'locked');
        assert.equal(refusal(setValue(draft, scope('store:1'), key('sample_days'), '10')), 'out_of_reach');
        assert.equal(refusal(setValue(draft, scope('website:9'), CONTAINER, 'GTM-X')), 'unknown_scope');
        assert.equal(refusal(setValue(draft, scope('default'), key('missing'), 'x')), 'unknown_setting');
    });

    it('takes only the value its kind holds; a secret only as replacement text', () => {
        const draft = createDraft(state);
        assert.equal(refusal(setValue(draft, scope('default'), key('enabled'), 'yes')), 'wrong_kind');
        assert.equal(refusal(setValue(draft, scope('default'), CONTAINER, true)), 'wrong_kind');
        assert.equal(refusal(setValue(draft, scope('default'), key('sample_secret'), 'plain')), 'wrong_kind');
        const secret = ok(setValue(draft, scope('website:1'), key('sample_secret'), { replace: 'abc' }));
        assert.deepEqual(ownAt(secret, scope('website:1'), key('sample_secret')), { replace: 'abc' });
        assert.deepEqual(effectiveAt(draft, scope('website:1'), key('sample_secret')), { set: true });
    });

    it('keeps no blank replacement of a secret the scope holds as not set, but keeps one that starts an override', () => {
        const unset = stateOf(withSetting(multiWebsiteConfig, 'sample_secret', { values: { 'website:2': { set: false } } }));
        const SECRET = key('sample_secret');
        const draft = createDraft(unset);

        assert.equal(ok(setValue(draft, scope('default'), SECRET, { replace: '' })).settingEdits.size, 0, 'the built-in default is not set');
        assert.equal(ok(setValue(draft, scope('website:2'), SECRET, { replace: '  ' })).settingEdits.size, 0, 'its own row is not set');
        const typed = ok(setValue(draft, scope('website:2'), SECRET, { replace: 'k8Xq' }));
        assert.equal(ok(setValue(typed, scope('website:2'), SECRET, { replace: '' })).settingEdits.size, 0, 'clearing what was typed drops the edit');

        const override = ok(setValue(draft, scope('website:1'), SECRET, { replace: '' }));
        assert.deepEqual(ownAt(override, scope('website:1'), SECRET), { replace: '' }, 'an inheriting scope starts its own secret');
        const stored = ok(setValue(createDraft(state), scope('default'), SECRET, { replace: '' }));
        assert.deepEqual(ownAt(stored, scope('default'), SECRET), { replace: '' }, 'a stored secret is being replaced');
    });

    it('resets every edit, or one', () => {
        const two = ok(setValue(ok(setValue(createDraft(state), scope('default'), CONTAINER, 'GTM-X')), scope('store:1'), key('brand'), 'manufacturer'));
        assert.equal(reset(two).settingEdits.size, 0);
        const one = resetAt(two, { scope: scope('default'), key: CONTAINER });
        assert.equal(one.settingEdits.has(CONTAINER), false);
        assert.equal(ownAt(one, scope('store:1'), key('brand')), 'manufacturer');
    });
});

describe('draft events', () => {
    const events = state.events;

    it('inherits the stored selection, a website overriding it', () => {
        const draft = createDraft(state);
        assert.equal(eventsAt(draft, scope('store:3')).off.has(eventName('login')), true);
        assert.equal(eventsAt(draft, scope('store:1')).off.has(eventName('login')), false);
    });

    it('sets a selection at a store view and inherits it back', () => {
        const toggled = toggle(events.catalogue, eventsAt(createDraft(state), scope('store:1')), eventName('view_cart'));
        assert.ok(toggled.ok);
        const draft = ok(setEvents(createDraft(state), scope('store:1'), toggled.value));
        assert.equal(eventsOwnAt(draft, scope('store:1'))?.off.has(eventName('view_cart')), true);
        assert.equal(ok(inheritEvents(draft, scope('store:1'))).eventEdits.size, 0);
    });

    it('keeps no edit for a selection equal to the stored one', () => {
        const standard = events.presets.find((preset) => preset.key === 'standard');
        assert.ok(standard);
        const draft = ok(setEvents(createDraft(state), scope('default'), applyPreset(events.catalogue, standard)));
        assert.equal(draft.eventEdits.size, 0);
    });

    it('inherits by removing a scope\'s rows, refused at the default scope', () => {
        const draft = ok(inheritEvents(createDraft(state), scope('website:2')));
        assert.deepEqual(draft.eventEdits.get(scope('website:2')), { op: 'inherit' });
        assert.equal(eventsAt(draft, scope('store:3')).off.has(eventName('login')), false);
        assert.equal(refusal(inheritEvents(draft, scope('default'))), 'default_scope');
    });

    it('refuses a locked scope', () => {
        const locked = stateOf({
            ...multiWebsiteConfig,
            state: { ...multiWebsiteConfig.state, events: { ...multiWebsiteConfig.state.events, locks: { 'store:1': LOCK_MESSAGE } } },
        });
        assert.equal(refusal(inheritEvents(createDraft(locked), scope('store:1'))), 'locked');
        assert.equal(refusal(setEvents(createDraft(locked), scope('store:1'), locked.events.builtIn)), 'locked');
    });
});

describe('rebase onto the next snapshot', () => {
    it('keeps only the edits asked for', () => {
        const draft = ok(setValue(ok(setValue(createDraft(state), scope('default'), CONTAINER, 'GTM-FAIL')), scope('store:1'), key('brand'), 'manufacturer'));
        const next = rebase(draft, state, (ref) => ref.key === CONTAINER);
        assert.equal(ownAt(next, scope('default'), CONTAINER), 'GTM-FAIL');
        assert.equal(ownAt(next, scope('store:1'), key('brand')), undefined);
    });

    it('drops a kept edit the new snapshot already holds', () => {
        const draft = ok(setValue(createDraft(state), scope('store:1'), key('brand'), 'manufacturer'));
        const saved = stateOf(withSetting(multiWebsiteConfig, 'brand', { values: { 'store:1': 'manufacturer' } }));
        const next = rebase(draft, saved, () => true);
        assert.equal(next.settingEdits.size, 0);
        assert.equal(ownAt(next, scope('store:1'), key('brand')), 'manufacturer');
    });

    it('drops a kept edit the new snapshot locks', () => {
        const draft = ok(setValue(createDraft(state), scope('store:1'), key('brand'), 'manufacturer'));
        const locked = stateOf(withSetting(multiWebsiteConfig, 'brand', { locks: { 'store:1': LOCK_MESSAGE } }));
        assert.equal(rebase(draft, locked, () => true).settingEdits.size, 0);
    });

    it('keeps event edits by the events key', () => {
        const draft = ok(inheritEvents(createDraft(state), scope('website:2')));
        assert.equal(rebase(draft, state, (ref) => ref.key === EVENTS_KEY).eventEdits.size, 1);
        assert.equal(rebase(draft, state, (ref) => ref.key !== EVENTS_KEY).eventEdits.size, 0);
    });
});
