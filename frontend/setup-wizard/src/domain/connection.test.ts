/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LOCK_MESSAGE, multiWebsiteConfig, singleWebsiteConfig, withSetting } from '../test/fixtures/page-config.ts';
import { key, scope, stateOf } from '../test/fixtures/setup-state.ts';
import { canChooseMode, chooseMode, loaderLines, loaderState, modeBlocker } from './connection.ts';
import { changes, toSaveRequest } from './diff.ts';
import { createDraft, inheritValue, ownAt, setValue, type Draft, type DraftRefusal } from './draft.ts';
import { deriveMode, resolveMode } from './mode.ts';
import type { Result } from './result.ts';
import type { SetupState } from './setup-state.ts';
import { viewOf } from './view.ts';

const CONTAINER = key('container_id');
const MEASUREMENT = key('measurement_id');

function ok(result: Result<Draft, DraftRefusal>): Draft {
    if (!result.ok) {
        throw new assert.AssertionError({ message: `Refused: ${result.error}` });
    }
    return result.value;
}

/** The single-website fixture at the default scope with the given values. */
function draftWith(values: Record<string, string | boolean>, state: SetupState = stateOf(singleWebsiteConfig)): Draft {
    return Object.entries(values).reduce(
        (draft, [name, value]) => ok(setValue(draft, scope('default'), key(name), value)),
        createDraft(state),
    );
}

describe('mode', () => {
    it('follows from the IDs that apply', () => {
        assert.equal(deriveMode('GTM-A1', ''), 'gtm');
        assert.equal(deriveMode('', 'G-A1'), 'gtag');
        assert.equal(deriveMode('GTM-A1', 'G-A1'), 'both');
        assert.equal(deriveMode('', '  '), 'gtm');
    });

    it('keeps a pick while the IDs do not contradict it', () => {
        assert.equal(resolveMode('', '', 'gtag'), 'gtag');
        assert.equal(resolveMode('GTM-A1', '', 'both'), 'both');
        assert.equal(resolveMode('GTM-A1', '', 'gtag'), 'gtm');
        assert.equal(resolveMode('GTM-A1', 'G-A1', 'gtm'), 'both');
    });
});

describe('choosing a mode', () => {
    it('clears the container ID the mode leaves out, at the current scope only', () => {
        const draft = ok(chooseMode(createDraft(stateOf(multiWebsiteConfig)), scope('website:1'), 'gtag'));
        assert.deepEqual(toSaveRequest(changes(draft)).changes, [
            { scope: 'website:1', key: 'container_id', op: 'set', value: '' },
        ]);
        assert.equal(viewOf(draft, scope('website:1')).mode(), 'gtag');
        assert.equal(viewOf(draft, scope('website:2')).mode(), 'gtm');
    });

    it('leaves an excluded ID alone when it is already empty there', () => {
        const draft = ok(chooseMode(createDraft(stateOf(multiWebsiteConfig)), scope('website:2'), 'gtm'));
        assert.deepEqual(changes(draft), []);
    });

    it('drops a measurement ID typed in this session when going back to the container only, leaving nothing to save', () => {
        const both = draftWith({ measurement_id: 'G-7KQ2XM4P1N' });
        assert.equal(viewOf(both, scope('default')).mode(), 'both');
        const gtm = ok(chooseMode(both, scope('default'), 'gtm'));
        assert.equal(ownAt(gtm, scope('default'), MEASUREMENT), undefined);
        assert.equal(ownAt(gtm, scope('default'), CONTAINER), 'GTM-AB12CD3');
        assert.equal(viewOf(gtm, scope('default')).mode(), 'gtm');
        assert.deepEqual(changes(gtm), []);
    });

    it('overrides a measurement ID the scope stores itself with an empty one', () => {
        const stored = stateOf(withSetting(singleWebsiteConfig, 'measurement_id', { values: { default: 'G-7KQ2XM4P1N' } }));
        const edited = draftWith({ measurement_id: 'G-AB12CD34' }, stored);
        const gtm = ok(chooseMode(edited, scope('default'), 'gtm'));
        assert.deepEqual(toSaveRequest(changes(gtm)).changes, [
            { scope: 'default', key: 'measurement_id', op: 'set', value: '' },
        ]);
    });

    it('overrides an inherited measurement ID with an empty one at the scope', () => {
        const inherited = stateOf(withSetting(multiWebsiteConfig, 'measurement_id', { values: { default: 'G-7KQ2XM4P1N' } }));
        const gtm = ok(chooseMode(createDraft(inherited), scope('website:1'), 'gtm'));
        assert.deepEqual(toSaveRequest(changes(gtm)).changes, [
            { scope: 'website:1', key: 'measurement_id', op: 'set', value: '' },
        ]);
        assert.equal(viewOf(gtm, scope('default')).mode(), 'both', 'the parent keeps its own');
    });

    it('overrides an ID an edit at the parent scope gave, since dropping nothing here would empty it', () => {
        const parentEdit = draftWith({ measurement_id: 'G-7KQ2XM4P1N' }, stateOf(multiWebsiteConfig));
        const gtm = ok(chooseMode(parentEdit, scope('website:1'), 'gtm'));
        assert.equal(ownAt(gtm, scope('website:1'), MEASUREMENT), '');
        assert.equal(ownAt(gtm, scope('default'), MEASUREMENT), 'G-7KQ2XM4P1N');
    });

    it('drops an edit that removed a scope\'s own empty ID, rather than writing an empty one over it', () => {
        const ownEmpty = stateOf(withSetting(multiWebsiteConfig, 'measurement_id', { values: { default: 'G-7KQ2XM4P1N', 'website:1': '' } }));
        const inheriting = ok(inheritValue(createDraft(ownEmpty), scope('website:1'), MEASUREMENT));
        assert.equal(viewOf(inheriting, scope('website:1')).mode(), 'both');
        const gtm = ok(chooseMode(inheriting, scope('website:1'), 'gtm'));
        assert.deepEqual(changes(gtm), []);
        assert.equal(ownAt(gtm, scope('website:1'), MEASUREMENT), '');
    });

    it('remembers a pick no ID can express yet', () => {
        const empty = draftWith({ container_id: '' });
        assert.equal(viewOf(empty, scope('default')).mode(), 'gtm');
        assert.equal(viewOf(ok(chooseMode(empty, scope('default'), 'gtag')), scope('default')).mode(), 'gtag');
        assert.equal(viewOf(ok(chooseMode(empty, scope('default'), 'both')), scope('default')).mode(), 'both');
    });

    it('is refused where the ID to clear is locked', () => {
        const locked = stateOf(withSetting(multiWebsiteConfig, 'container_id', {
            values: { default: 'GTM-AB12CD3' },
            locks: { 'store:1': LOCK_MESSAGE },
        }));
        assert.deepEqual(chooseMode(createDraft(locked), scope('store:1'), 'gtag'), { ok: false, error: 'locked' });
    });
});

describe('which modes can be chosen', () => {
    const lockedContainer = stateOf(withSetting(multiWebsiteConfig, 'container_id', {
        values: { default: 'GTM-AB12CD3' },
        locks: { 'store:1': LOCK_MESSAGE },
    }));

    it('holds back only the mode that would empty a locked ID, naming that ID', () => {
        const draft = createDraft(lockedContainer);
        assert.equal(canChooseMode(draft, scope('store:1'), 'gtag'), false);
        assert.equal(modeBlocker(draft, scope('store:1'), 'gtag'), CONTAINER);
        assert.equal(canChooseMode(draft, scope('store:1'), 'gtm'), true, 'the measurement ID is empty already');
        assert.equal(canChooseMode(draft, scope('store:1'), 'both'), true, 'both empties nothing');
        assert.equal(canChooseMode(draft, scope('store:2'), 'gtag'), true, 'the lock holds at one store view only');
    });

    it('lets a mode be chosen when the ID it empties is empty there already', () => {
        const emptyLocked = stateOf(withSetting(multiWebsiteConfig, 'container_id', {
            values: {},
            locks: { 'store:1': LOCK_MESSAGE },
        }));
        assert.equal(canChooseMode(createDraft(emptyLocked), scope('store:1'), 'gtag'), true);
    });

    it('holds back a mode that would empty an ID below its reach', () => {
        const websiteOnly = stateOf(withSetting(multiWebsiteConfig, 'measurement_id', {
            reach: 'website',
            values: { 'website:1': 'G-A1' },
        }));
        const draft = createDraft(websiteOnly);
        assert.equal(modeBlocker(draft, scope('store:1'), 'gtm'), MEASUREMENT);
        assert.equal(canChooseMode(draft, scope('website:1'), 'gtm'), true);
    });

    it('answers no for a scope the tree does not hold', () => {
        assert.equal(canChooseMode(createDraft(lockedContainer), scope('store:99'), 'gtm'), false);
    });
});

describe('loader lines', () => {
    const at = (draft: Draft) => viewOf(draft, scope('default'));

    it('show nothing while sending is off', () => {
        const off = draftWith({ enabled: false });
        assert.deepEqual(loaderLines(at(off)), []);
        assert.equal(loaderState(at(off)), 'off');
    });

    it('show the container on Google\'s standard host', () => {
        const draft = draftWith({});
        assert.deepEqual(loaderLines(at(draft)), [
            { loader: 'gtm', state: 'ok', url: 'https://www.googletagmanager.com/gtm.js?id=GTM-AB12CD3' },
        ]);
        assert.equal(loaderState(at(draft)), 'ok');
    });

    it('show the container on a first-party host', () => {
        assert.deepEqual(loaderLines(at(draftWith({ script_host: ' gtm.example.com ' }))), [
            { loader: 'gtm', state: 'ok', url: 'https://gtm.example.com/gtm.js?id=GTM-AB12CD3' },
        ]);
    });

    it('show gtag.js with the ID upper-cased, as the store will save it', () => {
        const draft = draftWith({ container_id: '', measurement_id: 'g-7kq2xm4p1n' });
        assert.deepEqual(loaderLines(at(draft)), [
            { loader: 'gtag', state: 'ok', url: 'https://www.googletagmanager.com/gtag/js?id=G-7KQ2XM4P1N' },
        ]);
    });

    it('show both scripts in mode both', () => {
        const lines = loaderLines(at(draftWith({ measurement_id: 'G-7KQ2XM4P1N' })));
        assert.deepEqual(lines.map((line) => [line.loader, line.state]), [['gtm', 'ok'], ['gtag', 'ok']]);
    });

    it('wait for an ID', () => {
        const draft = ok(chooseMode(draftWith({ container_id: '' }), scope('default'), 'both'));
        assert.deepEqual(loaderLines(at(draft)), [{ loader: 'gtm', state: 'waiting' }, { loader: 'gtag', state: 'waiting' }]);
        assert.equal(loaderState(at(draft)), 'waiting');
    });

    it('output nothing for an ID or host with the wrong form', () => {
        assert.deepEqual(loaderLines(at(draftWith({ container_id: 'GTM WH45' }))), [{ loader: 'gtm', state: 'invalid' }]);
        assert.deepEqual(loaderLines(at(draftWith({ script_host: 'https://gtm.example.com/' }))), [{ loader: 'gtm', state: 'invalid' }]);
        const mixed = draftWith({ measurement_id: 'UA-1' });
        assert.deepEqual(loaderLines(at(mixed)).map((line) => line.state), ['ok', 'invalid']);
        assert.equal(loaderState(at(mixed)), 'invalid');
    });
});
