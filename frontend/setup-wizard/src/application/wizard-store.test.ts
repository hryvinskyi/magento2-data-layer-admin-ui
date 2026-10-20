/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { changes } from '../domain/diff.ts';
import { effectiveAt, eventsOwnAt, ownAt } from '../domain/draft.ts';
import { selectionOf } from '../domain/events.ts';
import { EVENTS_KEY } from '../domain/setting.ts';
import { parseState } from '../adapters/contract.ts';
import { multiWebsiteConfig } from '../test/fixtures/page-config.ts';
import { eventName, key, scope, stateOf, step } from '../test/fixtures/setup-state.ts';
import type { SaveResult } from './responses.ts';
import { createWizardState, reduceWizard, type WizardAction, type WizardState } from './wizard-store.ts';

const stored = stateOf(multiWebsiteConfig);
const STEPS = [step('connect'), step('products'), step('sample')];
const start = (): WizardState => createWizardState({ state: stored, scope: scope('default'), steps: STEPS });
const run = (state: WizardState, ...actions: WizardAction[]): WizardState => actions.reduce(reduceWizard, state);

describe('wizard store', () => {
    it('starts at the given scope on the first step, idle, nothing touched or pending', () => {
        const state = start();

        assert.equal(state.scope, 'default');
        assert.equal(state.steps.current, 'connect');
        assert.deepEqual(state.save, { status: 'idle' });
        assert.equal(state.touched.size, 0);
        assert.equal(changes(state.draft).length, 0);
    });

    it('refuses to start without steps or at a scope the tree does not hold', () => {
        assert.throws(() => createWizardState({ state: stored, scope: scope('default'), steps: [] }), RangeError);
        assert.throws(() => createWizardState({ state: stored, scope: scope('store:99'), steps: STEPS }), RangeError);
        assert.throws(() => createWizardState({ state: stored, scope: scope('default'), steps: STEPS, step: step('review') }), RangeError);
    });

    it('starts on a given step when asked to', () => {
        const state = createWizardState({ state: stored, scope: scope('default'), steps: STEPS, step: step('products') });
        assert.equal(state.steps.current, 'products');
        assert.equal(state.steps.progress.get(step('connect')), 'todo', 'the steps before it are not done');
    });

    it('sets and inherits values through the draft', () => {
        const set = run(start(), { type: 'set', scope: scope('store:1'), key: key('container_id'), value: 'GTM-ST0RE1' });
        assert.equal(ownAt(set.draft, scope('store:1'), key('container_id')), 'GTM-ST0RE1');

        const inherited = run(set, { type: 'inherit', scope: scope('store:1'), key: key('item_id') });
        assert.equal(ownAt(inherited.draft, scope('store:1'), key('item_id')), undefined);
        assert.equal(changes(inherited.draft).length, 2);
    });

    it('leaves the state as it is when the draft refuses a change', () => {
        const state = start();

        assert.equal(run(state, { type: 'set', scope: scope('website:1'), key: key('hidden_price'), value: 'omit' }), state, 'locked');
        assert.equal(run(state, { type: 'set', scope: scope('store:1'), key: key('sample_days'), value: '9' }), state, 'out of reach');
        assert.equal(run(state, { type: 'inherit', scope: scope('default'), key: key('enabled') }), state, 'default scope');
        assert.equal(run(state, { type: 'override', scope: scope('store:1'), key: key('sample_days') }), state, 'out of reach');
    });

    it('overrides with the inherited value, and a secret with a blank replacement', () => {
        const state = run(
            start(),
            { type: 'override', scope: scope('store:2'), key: key('container_id') },
            { type: 'override', scope: scope('website:1'), key: key('sample_secret') },
        );

        assert.equal(ownAt(state.draft, scope('store:2'), key('container_id')), 'GTM-AB12CD3');
        assert.deepEqual(ownAt(state.draft, scope('website:1'), key('sample_secret')), { replace: '' });
    });

    it('sets, overrides and inherits the events setting', () => {
        const catalogue = stored.events.catalogue;
        const selection = selectionOf(catalogue, [eventName('login')], []);
        const set = run(start(), { type: 'setEvents', scope: scope('website:1'), selection });
        assert.deepEqual([...(eventsOwnAt(set.draft, scope('website:1'))?.off ?? [])], ['login']);

        const overridden = run(start(), { type: 'overrideEvents', scope: scope('store:1') });
        assert.deepEqual([...(eventsOwnAt(overridden.draft, scope('store:1'))?.off ?? [])], ['refund']);

        const inherited = run(start(), { type: 'inheritEvents', scope: scope('website:2') });
        assert.equal(eventsOwnAt(inherited.draft, scope('website:2')), undefined);
    });

    it('chooses how pages load Google, emptying the ID the mode leaves out', () => {
        const state = run(start(), { type: 'chooseMode', scope: scope('default'), mode: 'gtag' });

        assert.equal(effectiveAt(state.draft, scope('default'), key('container_id')), '');
        assert.equal(state.draft.modePicks.get(scope('default')), 'gtag');
    });

    it('switches scope keeping the draft and forgetting what was touched', () => {
        const touched = run(
            start(),
            { type: 'set', scope: scope('default'), key: key('script_host'), value: 'bad host' },
            { type: 'touch', key: key('script_host') },
        );
        const switched = run(touched, { type: 'setScope', scope: scope('website:2') });

        assert.equal(switched.scope, 'website:2');
        assert.equal(switched.touched.size, 0);
        assert.equal(switched.draft, touched.draft);
        assert.equal(run(touched, { type: 'setScope', scope: scope('default') }), touched, 'the same scope changes nothing');
        assert.equal(run(touched, { type: 'setScope', scope: scope('store:99') }), touched, 'an unknown scope changes nothing');
    });

    it('holds Continue back while issues remain, marking their fields touched', () => {
        const blocked = run(start(), { type: 'continueStep', issues: [{ key: key('container_id'), code: 'required' }] });
        assert.equal(blocked.steps.current, 'connect');
        assert.deepEqual([...blocked.touched], ['container_id']);

        const next = run(blocked, { type: 'continueStep', issues: [] });
        assert.equal(next.steps.current, 'products');
        assert.equal(next.steps.progress.get(step('connect')), 'done');
    });

    it('skips, visits, and stays put past the last step', () => {
        const skipped = run(start(), { type: 'skipStep' });
        assert.deepEqual([skipped.steps.current, skipped.steps.progress.get(step('connect'))], ['products', 'skipped']);

        const last = run(skipped, { type: 'visitStep', step: step('sample') });
        assert.equal(last.steps.current, 'sample');
        assert.equal(run(last, { type: 'skipStep' }), last);
        assert.equal(run(last, { type: 'continueStep', issues: [] }), last);
        assert.equal(run(last, { type: 'visitStep', step: step('missing') }), last);
    });

    it('marks a field touched once', () => {
        const once = run(start(), { type: 'touch', key: EVENTS_KEY });
        assert.equal(run(once, { type: 'touch', key: EVENTS_KEY }), once);
    });

    it('discards one change, or all of them', () => {
        const edited = run(
            start(),
            { type: 'set', scope: scope('default'), key: key('enabled'), value: false },
            { type: 'set', scope: scope('store:2'), key: key('brand'), value: 'manufacturer' },
        );
        const one = run(edited, { type: 'discardChange', ref: { scope: scope('default'), key: key('enabled') } });
        assert.deepEqual(changes(one.draft).map((change) => change.key), ['brand']);
        assert.equal(changes(run(edited, { type: 'discardAll' }).draft).length, 0);
    });

    describe('saving', () => {
        const edited = run(
            start(),
            { type: 'set', scope: scope('default'), key: key('enabled'), value: false },
            { type: 'set', scope: scope('store:2'), key: key('brand'), value: 'manufacturer' },
        );
        const saved: SaveResult[] = [
            { scope: scope('default'), key: key('enabled'), status: 'saved' },
            { scope: scope('store:2'), key: key('brand'), status: 'saved' },
        ];

        it('is saving once started, and back to idle when cancelled', () => {
            const saving = run(edited, { type: 'saveStarted' });
            assert.deepEqual(saving.save, { status: 'saving' });
            assert.deepEqual(run(saving, { type: 'saveCancelled' }).save, { status: 'idle' });
            assert.equal(run(edited, { type: 'saveCancelled' }), edited, 'nothing to cancel');
        });

        it('holds the draft, the scope and the step still while the save is in flight', () => {
            const saving = run(edited, { type: 'saveStarted' });
            const attempts: WizardAction[] = [
                { type: 'set', scope: scope('default'), key: key('enabled'), value: true },
                { type: 'inherit', scope: scope('store:2'), key: key('brand') },
                { type: 'override', scope: scope('website:1'), key: key('container_id') },
                { type: 'setEvents', scope: scope('default'), selection: selectionOf(stored.events.catalogue, [], []) },
                { type: 'inheritEvents', scope: scope('website:2') },
                { type: 'overrideEvents', scope: scope('website:1') },
                { type: 'chooseMode', scope: scope('default'), mode: 'gtag' },
                { type: 'setScope', scope: scope('website:1') },
                { type: 'visitStep', step: step('sample') },
                { type: 'continueStep', issues: [] },
                { type: 'skipStep' },
                { type: 'discardChange', ref: { scope: scope('default'), key: key('enabled') } },
                { type: 'discardAll' },
            ];
            for (const action of attempts) {
                assert.equal(reduceWizard(saving, action), saving, `${action.type} waits for the save`);
            }
            assert.ok(run(saving, { type: 'touch', key: key('brand') }).touched.has(key('brand')), 'touching shows problems only');

            const settled = run(saving, { type: 'saveFailed', failure: { kind: 'network', serverMessage: null } });
            assert.equal(run(settled, { type: 'setScope', scope: scope('website:1') }).scope, 'website:1', 'editable again once settled');
        });

        it('is saved when every change was saved, on the answer\'s snapshot', () => {
            const state = run(edited, { type: 'saveStarted' }, { type: 'saveCompleted', sent: edited.draft, state: stored, results: saved });

            assert.deepEqual(state.save, { status: 'saved', results: saved });
            assert.equal(state.draft.state, stored);
        });

        it('has failed, keeping the refused changes, when some were refused', () => {
            const results: SaveResult[] = [
                { scope: scope('default'), key: key('enabled'), status: 'saved' },
                { scope: scope('store:2'), key: key('brand'), status: 'failed', message: 'no' },
            ];
            const state = run(edited, { type: 'saveStarted' }, { type: 'saveCompleted', sent: edited.draft, state: stored, results });

            assert.deepEqual(state.save, { status: 'failed', reason: { kind: 'changes', results } });
            assert.deepEqual(changes(state.draft).map((change) => change.key), ['brand']);
        });

        it('has failed, keeping every change, when the request failed', () => {
            const failure = { kind: 'timeout', serverMessage: null } as const;
            const state = run(edited, { type: 'saveStarted' }, { type: 'saveFailed', failure });

            assert.deepEqual(state.save, { status: 'failed', reason: { kind: 'request', failure } });
            assert.equal(state.draft, edited.draft);
        });

        it('falls back to the default scope when the answer no longer holds the current one', () => {
            const onStore = run(edited, { type: 'setScope', scope: scope('store:3') });
            const withoutStore = parseState({
                ...multiWebsiteConfig.state,
                scopes: multiWebsiteConfig.state.scopes.filter((item) => item.id !== 'store:3'),
                settings: multiWebsiteConfig.state.settings.map((item) => (item.key === 'list_view' ? { ...item, values: {} } : item)),
            });
            const state = run(onStore, { type: 'saveCompleted', sent: edited.draft, state: withoutStore, results: saved });

            assert.equal(state.scope, 'default');
        });
    });
});
