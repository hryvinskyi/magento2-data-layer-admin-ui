/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { multiWebsiteConfig, singleWebsiteConfig, withSetting } from '../test/fixtures/page-config.ts';
import { key, scope, stateOf, step } from '../test/fixtures/setup-state.ts';
import { chooseMode } from './connection.ts';
import { createDraft, setValue, type Draft, type DraftRefusal } from './draft.ts';
import type { Result } from './result.ts';
import type { EditValue, SettingDefinition } from './setting.ts';
import {
    checkFormat,
    checkRange,
    createRequirementRegistry,
    registerCoreRequirements,
    settingIssues,
    stepIssues,
    type RequirementRegistry,
} from './validation.ts';
import { viewOf } from './view.ts';

const multi = stateOf(multiWebsiteConfig);

function ok(result: Result<Draft, DraftRefusal>): Draft {
    if (!result.ok) {
        throw new assert.AssertionError({ message: `Refused: ${result.error}` });
    }
    return result.value;
}

function definition(name: string): SettingDefinition {
    const found = multi.settings.get(key(name))?.definition;
    assert.ok(found, name);
    return found;
}

function coreRegistry(): RequirementRegistry {
    const registry = createRequirementRegistry();
    registerCoreRequirements(registry);
    return registry;
}

const set = (draft: Draft, at: string, name: string, value: EditValue): Draft => ok(setValue(draft, scope(at), key(name), value));

describe('format and range', () => {
    const formats: readonly [string, EditValue, 'format' | null][] = [
        ['container_id', 'GTM-AB12CD3', null],
        ['container_id', ' GTM-AB12CD3 ', null],
        ['container_id', 'GTM WH45', 'format'],
        ['container_id', 'gtm-ab12cd3', 'format'],
        ['container_id', '', null],
        ['measurement_id', 'g-7kq2xm4p1n', null],
        ['measurement_id', 'UA-12345', 'format'],
        ['script_host', 'gtm.example.com', null],
        ['script_host', 'GTM.Example.com', null],
        ['script_host', 'https://gtm.example.com', 'format'],
        ['script_host', 'localhost', 'format'],
        ['sample_days', '30', null],
        ['sample_days', 'thirty', 'format'],
        ['sample_days', '', 'format'],
        ['sample_days', ' 30 ', null],
        ['sample_days', '-5', 'format'],
        ['sample_days', '1.5', 'format'],
        ['sample_days', '30.0', 'format'],
        ['sample_days', '+30', 'format'],
        ['sample_secret', { replace: 'k8Xq-2Lm9' }, null],
        ['sample_secret', { replace: '******' }, 'format'],
        ['enabled', true, null],
        ['brand', 'anything', null],
    ];
    for (const [name, value, expected] of formats) {
        it(`${name} ${JSON.stringify(value)} → ${String(expected)}`, () => {
            assert.equal(checkFormat(definition(name), value), expected);
        });
    }

    it('compares numbers with the server\'s minimum and maximum', () => {
        const days = definition('sample_days');
        assert.equal(checkRange(days, '0'), 'range');
        assert.equal(checkRange(days, '731'), 'range');
        assert.equal(checkRange(days, '1'), null);
        assert.equal(checkRange(days, '730'), null);
        assert.equal(checkRange(days, 'thirty'), null);
        assert.equal(checkRange(days, '-5'), null, 'a malformed number is a format problem, not a range one');
        assert.equal(checkRange(days, '0.5'), null);
        assert.equal(checkRange(definition('container_id'), '5'), null);
    });
});

describe('required rules', () => {
    const at = (draft: Draft) => viewOf(draft, scope('default'));
    const registry = coreRegistry();
    const single = stateOf(singleWebsiteConfig);

    it('need the container ID while sending, unless pages load gtag.js only', () => {
        const empty = set(createDraft(single), 'default', 'container_id', '');
        assert.deepEqual(registry.issuesFor(key('container_id'), at(empty)), ['required']);
        assert.deepEqual(registry.issuesFor(key('measurement_id'), at(empty)), []);
        const gtag = ok(chooseMode(empty, scope('default'), 'gtag'));
        assert.deepEqual(registry.issuesFor(key('container_id'), at(gtag)), []);
        assert.deepEqual(registry.issuesFor(key('measurement_id'), at(gtag)), ['required']);
    });

    it('need both IDs in mode both', () => {
        const both = ok(chooseMode(set(createDraft(single), 'default', 'container_id', ''), scope('default'), 'both'));
        assert.equal(registry.isRequired(key('container_id'), at(both)), true);
        assert.equal(registry.isRequired(key('measurement_id'), at(both)), true);
    });

    it('need nothing while sending is off', () => {
        const off = set(set(createDraft(single), 'default', 'container_id', ''), 'default', 'enabled', false);
        assert.deepEqual(registry.issuesFor(key('container_id'), at(off)), []);
    });

    it('live in the registry instance they were registered in', () => {
        const empty = set(createDraft(single), 'default', 'container_id', '');
        assert.deepEqual(createRequirementRegistry().issuesFor(key('container_id'), at(empty)), []);
    });

    it('can be added for any setting', () => {
        const own = createRequirementRegistry();
        own.register(key('sample_secret'), (view) => view.value(key('sample_enabled')) === true);
        const enabled = set(createDraft(single), 'website:1', 'sample_enabled', true);
        assert.deepEqual(own.issuesFor(key('sample_secret'), viewOf(enabled, scope('website:1'))), ['required']);
        assert.deepEqual(own.issuesFor(key('sample_secret'), viewOf(createDraft(single), scope('website:1'))), []);
    });
});

describe('issues of a setting and of a step', () => {
    const registry = coreRegistry();

    it('report required before format, and a blank replacement secret as required', () => {
        const draft = set(set(createDraft(multi), 'website:2', 'sample_days', '0'), 'website:1', 'sample_secret', { replace: ' ' });
        assert.deepEqual(settingIssues(key('sample_days'), viewOf(draft, scope('website:2')), registry), ['range']);
        assert.deepEqual(settingIssues(key('sample_secret'), viewOf(draft, scope('website:1')), registry), ['required']);
        assert.deepEqual(settingIssues(key('missing'), viewOf(draft, scope('website:1')), registry), []);
    });

    it('block a step on the settings a person can change at the scope', () => {
        const draft = set(set(createDraft(multi), 'default', 'container_id', 'GTM WH45'), 'default', 'script_host', 'https://x');
        assert.deepEqual(stepIssues(step('connect'), viewOf(draft, scope('default')), registry), [
            { key: 'container_id', code: 'format' },
            { key: 'script_host', code: 'format' },
        ]);
        assert.deepEqual(stepIssues(step('products'), viewOf(draft, scope('default')), registry), []);
    });

    it('do not block a store view on a value it inherits and did not set', () => {
        const draft = set(createDraft(multi), 'website:1', 'container_id', 'GTM WH45');
        assert.equal(stepIssues(step('connect'), viewOf(draft, scope('website:1')), registry).length, 1);
        assert.deepEqual(stepIssues(step('connect'), viewOf(draft, scope('store:1')), registry), []);
    });

    it('do not block a store view on a website-only setting', () => {
        const draft = set(createDraft(multi), 'website:1', 'sample_days', '0');
        assert.equal(stepIssues(step('sample'), viewOf(draft, scope('website:1')), registry).length, 1);
        assert.deepEqual(stepIssues(step('sample'), viewOf(draft, scope('store:1')), registry), []);
    });

    it('do not block on a locked setting', () => {
        const strict = createRequirementRegistry();
        strict.register(key('hidden_price'), () => true);
        const locked = stateOf(withSetting(multiWebsiteConfig, 'hidden_price', { values: { 'website:1': '' } }));
        assert.deepEqual(stepIssues(step('products'), viewOf(createDraft(locked), scope('website:1')), strict), []);
        assert.equal(stepIssues(step('products'), viewOf(set(createDraft(locked), 'website:2', 'hidden_price', ''), scope('website:2')), strict).length, 1);
    });
});
