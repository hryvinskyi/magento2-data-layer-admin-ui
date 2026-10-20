/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { multiWebsiteConfig } from '../test/fixtures/page-config.ts';
import { eventName, scope, stateOf } from '../test/fixtures/setup-state.ts';
import {
    applyPreset,
    channelOf,
    CUSTOM_PRESET,
    doubleCounted,
    fromServerCount,
    presetOf,
    route,
    sameEffect,
    sameSelection,
    selectionOf,
    sentCount,
    serverWithoutDelivery,
    toggle,
    type EventPreset,
    type EventSelection,
} from './events.ts';

const { catalogue, presets, builtIn, stored } = stateOf(multiWebsiteConfig).events;

function preset(key: string): EventPreset {
    const found = presets.find((item) => item.key === key);
    assert.ok(found, key);
    return found;
}

function unwrap(result: { ok: true; value: EventSelection } | { ok: false; error: string }): EventSelection {
    if (!result.ok) {
        throw new assert.AssertionError({ message: `Refused: ${result.error}` });
    }
    return result.value;
}

describe('event selection', () => {
    it('drops unknown names, routing of fixed-channel events and browser routes', () => {
        const selection = selectionOf(
            catalogue,
            [eventName('view_cart'), eventName('retired_event')],
            [
                [eventName('purchase'), 'server'],
                [eventName('refund'), 'browser'],
                [eventName('view_promotion'), 'server'],
                [eventName('view_item'), 'browser'],
                [eventName('retired_event'), 'both'],
            ],
        );
        assert.deepEqual([...selection.off], ['view_cart']);
        assert.deepEqual([...selection.channels], [['purchase', 'server']]);
    });

    it('answers the channel each event uses', () => {
        const website = stored.get(scope('website:2'));
        assert.ok(website);
        assert.equal(channelOf(catalogue, website, eventName('purchase')), 'both');
        assert.equal(channelOf(catalogue, website, eventName('view_item')), 'browser');
        assert.equal(channelOf(catalogue, website, eventName('refund')), 'server');
        assert.equal(channelOf(catalogue, website, eventName('view_promotion')), 'browser');
    });

    it('toggles a known event and refuses an unknown one', () => {
        const off = unwrap(toggle(catalogue, builtIn, eventName('view_cart')));
        assert.equal(off.off.has(eventName('view_cart')), true);
        assert.equal(unwrap(toggle(catalogue, off, eventName('view_cart'))).off.has(eventName('view_cart')), false);
        assert.deepEqual(toggle(catalogue, builtIn, eventName('retired_event')), { ok: false, error: 'unknown_event' });
    });

    it('routes an event, back to the browser by removing its routing, and refuses a fixed one', () => {
        const server = unwrap(route(catalogue, builtIn, eventName('purchase'), 'server'));
        assert.equal(server.channels.get(eventName('purchase')), 'server');
        assert.equal(unwrap(route(catalogue, server, eventName('purchase'), 'browser')).channels.size, 0);
        assert.deepEqual(route(catalogue, builtIn, eventName('refund'), 'browser'), { ok: false, error: 'fixed_channel' });
        assert.deepEqual(route(catalogue, builtIn, eventName('retired_event'), 'both'), { ok: false, error: 'unknown_event' });
    });
});

describe('presets', () => {
    it('applying one switches every known non-member off and clears routing', () => {
        const routed = unwrap(route(catalogue, builtIn, eventName('purchase'), 'both'));
        assert.equal(routed.channels.size, 1);
        const minimal = applyPreset(catalogue, preset('minimal'));
        assert.deepEqual(
            catalogue.events.map((event) => event.name).filter((name) => !minimal.off.has(name)),
            ['view_item', 'purchase'],
        );
        assert.equal(minimal.channels.size, 0);
    });

    it('a selection is the preset it equals', () => {
        assert.equal(presetOf(catalogue, builtIn, presets), 'standard');
        assert.equal(presetOf(catalogue, applyPreset(catalogue, preset('minimal')), presets), 'minimal');
    });

    it('a selection that equals no preset is custom: one event switched, or one routed', () => {
        assert.equal(presetOf(catalogue, unwrap(toggle(catalogue, builtIn, eventName('login'))), presets), CUSTOM_PRESET);
        assert.equal(presetOf(catalogue, unwrap(route(catalogue, builtIn, eventName('purchase'), 'server')), presets), CUSTOM_PRESET);
    });

    it('matching ignores browser routes, fixed-channel routing and unknown entries', () => {
        const noisy = selectionOf(
            catalogue,
            [eventName('refund'), eventName('retired_event')],
            [[eventName('view_item'), 'browser'], [eventName('refund'), 'server'], [eventName('retired_event'), 'server']],
        );
        assert.equal(presetOf(catalogue, noisy, presets), 'standard');
    });

    it('matching ignores the routing an event keeps while it is switched off', () => {
        const routed = unwrap(route(catalogue, applyPreset(catalogue, preset('minimal')), eventName('view_item'), 'both'));
        const switchedOff = unwrap(toggle(catalogue, routed, eventName('view_item')));
        const minimalWithout = unwrap(toggle(catalogue, applyPreset(catalogue, preset('minimal')), eventName('view_item')));
        assert.equal(switchedOff.channels.get(eventName('view_item')), 'both', 'the routing is kept for later');
        assert.equal(sameEffect(switchedOff, minimalWithout), true);
        assert.equal(sameSelection(switchedOff, minimalWithout), false, 'the stored selections still differ');

        const offInStandard = unwrap(route(catalogue, builtIn, eventName('purchase'), 'server'));
        const standardAgain = unwrap(toggle(catalogue, unwrap(toggle(catalogue, offInStandard, eventName('purchase'))), eventName('purchase')));
        assert.equal(presetOf(catalogue, standardAgain, presets), CUSTOM_PRESET, 'switched back on, the routing counts again');

        const minimal = applyPreset(catalogue, preset('minimal'));
        const minimalWithOffRouting = selectionOf(catalogue, minimal.off, [[eventName('add_to_cart'), 'server']]);
        assert.equal(minimalWithOffRouting.channels.size, 1);
        assert.equal(presetOf(catalogue, minimalWithOffRouting, presets), 'minimal');
    });
});

describe('counts and warnings', () => {
    const website = stored.get(scope('website:2'));

    it('count the events sent and those the server sends, fixed ones included', () => {
        assert.ok(website);
        assert.equal(sentCount(catalogue, builtIn), 9);
        assert.equal(fromServerCount(catalogue, builtIn), 0);
        assert.equal(sentCount(catalogue, website), 8);
        assert.equal(fromServerCount(catalogue, website), 1);
        const withRefund = unwrap(toggle(catalogue, website, eventName('refund')));
        assert.equal(fromServerCount(catalogue, withRefund), 2);
    });

    it('list events sent by both channels', () => {
        assert.ok(website);
        assert.deepEqual(doubleCounted(catalogue, website), ['purchase']);
        assert.deepEqual(doubleCounted(catalogue, unwrap(toggle(catalogue, website, eventName('purchase')))), []);
    });

    it('list server-channel events only while nothing delivers from the server', () => {
        assert.ok(website);
        const withRefund = unwrap(toggle(catalogue, website, eventName('refund')));
        assert.deepEqual(serverWithoutDelivery(catalogue, withRefund, { on: false }), ['purchase', 'refund']);
        assert.deepEqual(serverWithoutDelivery(catalogue, withRefund, { on: true }), []);
        assert.deepEqual(serverWithoutDelivery(catalogue, builtIn, { on: false }), []);
    });
});
