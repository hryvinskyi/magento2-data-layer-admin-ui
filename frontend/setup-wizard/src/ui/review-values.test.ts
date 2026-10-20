/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { selectionOf, type SettingDefinition, type Translator } from '@hryvinskyi/datalayer-setup';
import { multiWebsiteConfig } from '../test/fixtures/page-config.ts';
import { eventName, key, stateOf } from '../test/fixtures/setup-state.ts';
import { formatSelection, formatSetting, scopeName } from './review-values.ts';

/** Every phrase shows its key and parameters, so a test sees which phrase was chosen and what filled it. */
const translator: Translator = {
    t: (phrase, ...params) => [phrase, ...params].join('|'),
    tn: (phrase, count, ...params) => [`${phrase}#${count}`, ...params].join('|'),
    n: (value) => String(value),
    list: (values) => values.join('+'),
    issue: (setting, code) => `${setting}.${code}`,
};

const state = stateOf(multiWebsiteConfig);

function definitionOf(setting: string): SettingDefinition {
    const found = state.settings.get(key(setting));
    if (found === undefined) {
        throw new RangeError(`The fixture has no setting ${setting}`);
    }
    return found.definition;
}

describe('a setting value in the review', () => {
    it('reads a flag as Yes or No', () => {
        assert.equal(formatSetting(definitionOf('enabled'), true, translator), 'switch.yes');
        assert.equal(formatSetting(definitionOf('enabled'), false, translator), 'switch.no');
    });

    it("reads a choice as its option's label, and an unknown value as it is", () => {
        assert.equal(formatSetting(definitionOf('item_id'), 'entity_id', translator), 'item_id.entity_id');
        assert.equal(formatSetting(definitionOf('item_id'), 'legacy', translator), 'legacy');
    });

    it('says Empty for a choice that is blank and has no option of its own', () => {
        assert.equal(formatSetting(definitionOf('item_id'), '', translator), 'review.empty');
        assert.equal(formatSetting(definitionOf('brand'), '', translator), 'brand.', 'the blank option has the label the server gave it');
    });

    it('reads text and numbers as typed, and blank ones as Empty', () => {
        assert.equal(formatSetting(definitionOf('container_id'), 'GTM-AB12CD3', translator), 'GTM-AB12CD3');
        assert.equal(formatSetting(definitionOf('container_id'), '', translator), 'review.empty');
        assert.equal(formatSetting(definitionOf('container_id'), '   ', translator), 'review.empty');
        assert.equal(formatSetting(definitionOf('sample_days'), '30', translator), '30');
    });

    it('never shows a secret, only that one is set', () => {
        const secret = definitionOf('sample_secret');
        assert.equal(formatSetting(secret, { set: true }, translator), 'review.secret');
        assert.equal(formatSetting(secret, { set: false }, translator), 'review.empty');
        assert.equal(formatSetting(secret, { replace: 'hunter2' }, translator), 'review.secret');
        assert.equal(formatSetting(secret, { replace: '  ' }, translator), 'review.empty');
    });
});

describe('the events setting in the review', () => {
    const events = state.events;

    it('names the preset the selection equals and how many events it sends', () => {
        assert.equal(formatSelection(events, events.builtIn, translator), 'review.events|preset.standard|9|10');
    });

    it('calls a selection that equals no preset Custom', () => {
        const selection = selectionOf(events.catalogue, [eventName('login')], []);
        assert.equal(formatSelection(events, selection, translator), 'review.events|preset.custom|9|10');
    });
});

describe('a scope in the review', () => {
    it('is the default scope by a short word and any other scope by its name', () => {
        assert.equal(scopeName({ type: 'default', name: 'scope.default' }, translator), 'field.reach.default');
        assert.equal(scopeName({ type: 'website', name: 'Main website' }, translator), 'Main website');
        assert.equal(scopeName({ type: 'store', name: 'Main store' }, translator), 'Main store');
    });
});
