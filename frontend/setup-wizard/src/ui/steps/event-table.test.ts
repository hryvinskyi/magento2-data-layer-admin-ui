/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    applyPreset,
    createEventCatalogue,
    selectionOf,
    toggle,
    type CatalogueEvent,
    type EventSelection,
} from '@hryvinskyi/datalayer-setup';
import { multiWebsiteConfig } from '../../test/fixtures/page-config.ts';
import { eventName, stateOf } from '../../test/fixtures/setup-state.ts';
import { GENERIC_GROUP_GLYPH, GENERIC_SOURCE_GLYPH, groupEvents, groupGlyph, sourceGlyph } from './event-table.ts';

const { catalogue, presets } = stateOf(multiWebsiteConfig).events;

const standard = presets.find((preset) => preset.key === 'standard');
if (standard === undefined) {
    throw new TypeError('The fixture has a standard preset');
}
const STANDARD: EventSelection = applyPreset(catalogue, standard);

function event(name: string, group: string, groupCode?: string): CatalogueEvent {
    return {
        name: eventName(name),
        label: name,
        group,
        ...(groupCode === undefined ? {} : { groupCode }),
        trigger: 'trigger',
        source: 'source',
        browserOriginated: true,
        fixedChannel: null,
    };
}

function catalogueOf(...events: readonly CatalogueEvent[]) {
    const created = createEventCatalogue(events);
    if (!created.ok) {
        throw new TypeError(`Duplicate event ${created.error}`);
    }
    return created.value;
}

describe('groupEvents', () => {
    it('gathers the events by group in catalogue order, counting what is sent', () => {
        const groups = groupEvents(catalogue, STANDARD);

        assert.deepEqual(groups.map((group) => [group.code, group.label]), [
            ['browsing', 'group.browsing'],
            ['cart', 'group.cart'],
            ['checkout', 'group.checkout'],
            ['account', 'group.account'],
        ]);
        assert.deepEqual(groups.map((group) => group.events.map((item) => item.name)), [
            ['view_item_list', 'select_item', 'view_item', 'view_promotion'],
            ['add_to_cart', 'view_cart'],
            ['begin_checkout', 'purchase', 'refund'],
            ['login'],
        ]);
        assert.deepEqual(groups.map((group) => [group.sent, group.events.length]), [[4, 4], [2, 2], [2, 3], [1, 1]]);
    });

    it('counts an event switched off as not sent', () => {
        const toggled = toggle(catalogue, STANDARD, eventName('add_to_cart'));
        assert.ok(toggled.ok);
        const cart = groupEvents(catalogue, toggled.value).find((group) => group.code === 'cart');
        assert.equal(cart?.sent, 1);
    });

    it('keeps a group whose events are not next to each other as one group at its first place', () => {
        const scattered = catalogueOf(
            event('first', 'Shop', 'shop'),
            event('second', 'Other', 'other'),
            event('third', 'Shop', 'shop'),
        );
        const groups = groupEvents(scattered, selectionOf(scattered, [], []));

        assert.deepEqual(groups.map((group) => group.events.map((item) => item.name)), [['first', 'third'], ['second']]);
    });

    it('groups by the group text when the catalogue gives no code, and offers no code for it', () => {
        const uncoded = catalogueOf(event('first', 'Shop'), event('second', 'Shop'), event('third', 'Other'));
        const groups = groupEvents(uncoded, selectionOf(uncoded, [], []));

        assert.deepEqual(groups.map((group) => [group.key, group.label, group.events.length]), [
            ['Shop', 'Shop', 2],
            ['Other', 'Other', 1],
        ]);
        assert.ok(groups.every((group) => !('code' in group)));
    });
});

describe('glyphs', () => {
    it('draws a group and a source by the code the catalogue carries', () => {
        assert.deepEqual(['browsing', 'cart', 'checkout', 'account'].map(groupGlyph), [
            'storefront',
            'shopping_cart',
            'point_of_sale',
            'person',
        ]);
        assert.deepEqual(['page', 'list', 'click', 'server', 'order'].map(sourceGlyph), [
            'description',
            'view_list',
            'touch_app',
            'dns',
            'receipt_long',
        ]);
    });

    it('falls back to a generic glyph for no code, an unknown code and a name every object has', () => {
        for (const code of [undefined, 'unheard_of', 'constructor', 'toString']) {
            assert.equal(groupGlyph(code), GENERIC_GROUP_GLYPH);
            assert.equal(sourceGlyph(code), GENERIC_SOURCE_GLYPH);
        }
    });
});
