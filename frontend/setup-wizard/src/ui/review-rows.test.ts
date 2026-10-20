/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    applyPreset,
    changes,
    createDraft,
    DEFAULT_SCOPE,
    inheritValue,
    selectionOf,
    setEvents,
    setValue,
    type Draft,
    type DraftRefusal,
    type Result,
    type SaveResult,
    type SaveStatus,
    type Translator,
} from '@hryvinskyi/datalayer-setup';
import { multiWebsiteConfig, withSetting } from '../test/fixtures/page-config.ts';
import { eventName, key, scope, stateOf, step } from '../test/fixtures/setup-state.ts';
import {
    checklistOf,
    groupRows,
    marksOf,
    phaseOf,
    rowsOf,
    savedScopes,
    scopeCount,
    sentEvents,
    tallyOf,
} from './review-rows.ts';

/** Every phrase shows its key and parameters, so a test sees which phrase was chosen and what filled it. */
const translator: Translator = {
    t: (phrase, ...params) => [phrase, ...params].join('|'),
    tn: (phrase, count, ...params) => [`${phrase}#${count}`, ...params].join('|'),
    n: (value) => String(value),
    list: (values) => values.join('+'),
    issue: (setting, code) => `${setting}.${code}`,
};

const state = stateOf(multiWebsiteConfig);

function ok(result: Result<Draft, DraftRefusal>): Draft {
    if (!result.ok) {
        throw new assert.AssertionError({ message: `Refused: ${result.error}` });
    }
    return result.value;
}

const rowsFor = (draft: Draft) => rowsOf(draft, changes(draft), translator);

describe('the rows of the pending changes', () => {
    it('show a scope that takes its value from an ancestor against that ancestor', () => {
        const rows = rowsFor(ok(setValue(createDraft(state), scope('website:1'), key('container_id'), 'GTM-NEW1')));
        assert.deepEqual(rows, [{
            id: 'website:1 container_id',
            scope: 'website:1',
            scopeType: 'website',
            scopeName: 'scope.main',
            key: 'container_id',
            step: 'connect',
            label: 'container_id',
            current: 'GTM-AB12CD3',
            currentNote: 'origin.inherited|field.reach.default',
            next: 'GTM-NEW1',
            nextNote: null,
        }]);
    });

    it('show a scope with a value of its own against that value, with no note', () => {
        const [row] = rowsFor(ok(setValue(createDraft(state), scope('website:2'), key('container_id'), 'GTM-NEW2')));
        assert.equal(row?.current, 'GTM-WH45EF6');
        assert.equal(row?.currentNote, null);
    });

    it('say where the built-in default applies, to the default scope and to those below it', () => {
        const atDefault = rowsFor(ok(setValue(createDraft(state), DEFAULT_SCOPE, key('measurement_id'), 'G-NEW1')));
        assert.equal(atDefault[0]?.current, 'review.empty');
        assert.equal(atDefault[0]?.currentNote, 'review.built_in');

        const atWebsite = rowsFor(ok(setValue(createDraft(state), scope('website:1'), key('measurement_id'), 'G-NEW1')));
        assert.equal(atWebsite[0]?.currentNote, 'origin.inherited_built_in');
    });

    it('show the value an inheriting scope will take, and from where', () => {
        const [fromDefault] = rowsFor(ok(inheritValue(createDraft(state), scope('website:2'), key('container_id'))));
        assert.equal(fromDefault?.current, 'GTM-WH45EF6');
        assert.equal(fromDefault?.next, 'action.inherit');
        assert.equal(fromDefault?.nextNote, 'review.inherited_value|field.reach.default|GTM-AB12CD3');

        const [fromBuiltIn] = rowsFor(ok(inheritValue(createDraft(state), scope('store:1'), key('item_id'))));
        assert.equal(fromBuiltIn?.nextNote, 'review.inherited_value|review.built_in|item_id.sku');
    });

    it('take the value of an inheriting store view from its website when the website has one', () => {
        const websiteSet = ok(setValue(createDraft(state), scope('website:1'), key('item_id'), 'entity_id'));
        const row = rowsFor(ok(inheritValue(websiteSet, scope('store:1'), key('item_id')))).find((candidate) => candidate.scope === 'store:1');
        assert.equal(row?.nextNote, 'review.inherited_value|scope.main|item_id.entity_id');
    });

    it('never show a secret', () => {
        const [row] = rowsFor(ok(setValue(createDraft(state), scope('website:1'), key('sample_secret'), { replace: 'hunter2' })));
        assert.equal(row?.next, 'review.secret');
        assert.equal(JSON.stringify(row).includes('hunter2'), false);
    });

    it('show the events setting as its preset, owned by the step that picks events', () => {
        const events = state.events;
        const minimal = events.presets.find((preset) => preset.key === 'minimal');
        assert.ok(minimal);
        const [row] = rowsFor(ok(setEvents(createDraft(state), scope('website:1'), applyPreset(events.catalogue, minimal))));
        assert.equal(row?.key, 'events');
        assert.equal(row?.step, 'track');
        assert.equal(row?.label, 'track.events');
        assert.equal(row?.current, 'review.events|preset.standard|9|10');
        assert.equal(row?.currentNote, 'origin.inherited|field.reach.default');
        assert.equal(row?.next, 'review.events|preset.minimal|2|10');
    });

    it('keep the order of the changes: scope by scope', () => {
        const storeSet = ok(setValue(createDraft(state), scope('store:3'), key('list_view'), 'load'));
        const draft = ok(setValue(storeSet, DEFAULT_SCOPE, key('enabled'), false));
        assert.deepEqual(rowsFor(draft).map((row) => row.id), ['default enabled', 'store:3 list_view']);
    });

    it('are none without changes', () => {
        assert.deepEqual(rowsFor(createDraft(state)), []);
    });
});

describe('rows grouped by step', () => {
    const sampleSet = ok(setValue(createDraft(state), scope('website:1'), key('sample_days'), '10'));
    const enabledSet = ok(setValue(sampleSet, DEFAULT_SCOPE, key('enabled'), false));
    const rows = rowsFor(ok(setValue(enabledSet, DEFAULT_SCOPE, key('item_id'), 'entity_id')));

    it('follow the order of the steps, leaving out steps with no changes', () => {
        const order = [step('scope'), step('connect'), step('track'), step('products'), step('sample'), step('review')];
        assert.deepEqual(groupRows(rows, order).map((group) => [group.step, group.rows.map((row) => row.key)]), [
            ['connect', ['enabled']],
            ['products', ['item_id']],
            ['sample', ['sample_days']],
        ]);
    });

    it('put rows of a step that is not on the page last, in a group of their own', () => {
        const groups = groupRows(rows, [step('connect'), step('products')]);
        assert.deepEqual(groups.map((group) => group.step), ['connect', 'products', null]);
        assert.deepEqual(groups[2]?.rows.map((row) => row.key), ['sample_days']);
    });

    it('count the scopes the rows touch', () => {
        assert.equal(scopeCount(rows), 2);
        assert.equal(scopeCount([]), 0);
    });
});

describe('where a save stands', () => {
    const idle: SaveStatus = { status: 'idle' };
    const saved: SaveStatus = { status: 'saved', results: [] };

    it('is nothing to save without changes, unless they were just saved', () => {
        assert.equal(phaseOf(idle, 0), 'nothing');
        assert.equal(phaseOf({ status: 'failed', reason: { kind: 'changes', results: [] } }, 0), 'nothing');
        assert.equal(phaseOf(saved, 0), 'saved');
    });

    it('is changes whenever anything is pending, also when an earlier save succeeded', () => {
        assert.equal(phaseOf(idle, 2), 'changes');
        assert.equal(phaseOf({ status: 'saving' }, 2), 'changes');
        assert.equal(phaseOf(saved, 1), 'changes');
    });
});

describe('the outcome of a save that stored only some changes', () => {
    const results: readonly SaveResult[] = [
        { scope: scope('default'), key: key('enabled'), status: 'saved' },
        { scope: scope('website:1'), key: key('container_id'), status: 'failed', message: 'not a container' },
        { scope: scope('website:2'), key: key('brand'), status: 'failed' },
    ];
    const partial: SaveStatus = { status: 'failed', reason: { kind: 'changes', results } };

    it('marks each row with what happened to it', () => {
        assert.deepEqual([...marksOf(partial)], [
            ['default enabled', { kind: 'saved' }],
            ['website:1 container_id', { kind: 'failed', message: 'not a container' }],
            ['website:2 brand', { kind: 'failed', message: null }],
        ]);
    });

    it('marks nothing after any other outcome', () => {
        assert.equal(marksOf({ status: 'idle' }).size, 0);
        assert.equal(marksOf({ status: 'saved', results }).size, 0);
        assert.equal(marksOf({ status: 'failed', reason: { kind: 'request', failure: { kind: 'timeout', serverMessage: null } } }).size, 0);
    });

    it('is counted as saved, failed and total', () => {
        assert.deepEqual(tallyOf(results), { total: 3, saved: 1, failed: 2 });
    });
});

describe('what was saved', () => {
    const stored = withSetting(
        withSetting(multiWebsiteConfig, 'container_id', { values: { default: 'GTM-AB12CD3', 'website:1': 'GTM-NEW1' } }),
        'brand',
        { values: {} },
    );
    const after = stateOf(stored);
    const results: readonly SaveResult[] = [
        { scope: scope('website:1'), key: key('container_id'), status: 'saved' },
        { scope: scope('website:2'), key: key('brand'), status: 'saved' },
        { scope: scope('website:2'), key: key('container_id'), status: 'failed', message: 'refused' },
        { scope: scope('default'), key: key('enabled'), status: 'saved' },
        { scope: scope('default'), key: 'events', status: 'saved' },
    ];

    it('lists, scope by scope in tree order, what the store holds now', () => {
        assert.deepEqual(savedScopes(after, results, translator), [
            {
                scope: 'default',
                scopeType: 'default',
                name: 'field.reach.default',
                items: [
                    { label: 'enabled', value: 'switch.yes' },
                    { label: 'track.events', value: 'review.events|preset.standard|9|10' },
                ],
            },
            { scope: 'website:1', scopeType: 'website', name: 'scope.main', items: [{ label: 'container_id', value: 'GTM-NEW1' }] },
            { scope: 'website:2', scopeType: 'website', name: 'scope.second', items: [{ label: 'brand', value: 'action.inherit' }] },
        ]);
    });

    it('leaves out a change for a setting the snapshot does not hold', () => {
        const unknown: readonly SaveResult[] = [
            { scope: scope('default'), key: key('enabled'), status: 'saved' },
            { scope: scope('default'), key: key('sample_days'), status: 'saved' },
        ];
        const trimmed = stateOf({
            ...stored,
            state: { ...stored.state, settings: stored.state.settings.filter((setting) => setting.key !== 'sample_days') },
        });
        const labels = savedScopes(trimmed, unknown, translator).flatMap((entry) => entry.items.map((item) => item.label));
        assert.deepEqual(labels, ['enabled']);
    });
});

describe('the events a container needs tags for', () => {
    it('are the events sent at a scope, in catalogue order', () => {
        const draft = createDraft(state);
        assert.equal(sentEvents(draft, DEFAULT_SCOPE).length, 9);
        assert.equal(sentEvents(draft, DEFAULT_SCOPE).includes(eventName('refund')), false);

        const fewer = ok(setEvents(draft, DEFAULT_SCOPE, selectionOf(state.events.catalogue, [eventName('login'), eventName('refund')], [])));
        assert.equal(sentEvents(fewer, DEFAULT_SCOPE).includes(eventName('login')), false);
        assert.equal(sentEvents(fewer, DEFAULT_SCOPE)[0], 'view_item_list');
    });

    it('lead the checklist, which has three items when events are sent and two when none are', () => {
        const events = sentEvents(createDraft(state), DEFAULT_SCOPE);
        const full = checklistOf(events, translator);
        assert.deepEqual(full.map((item) => item.id), ['tags', 'preview', 'publish']);
        assert.equal(full[0]?.text, 'checklist.tags#9|field.reach.default');
        assert.equal(full[0]?.codes, events);
        assert.deepEqual(checklistOf([], translator).map((item) => item.id), ['preview', 'publish']);
    });
});
