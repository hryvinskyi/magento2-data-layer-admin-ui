/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The events table's state: reading what the page printed, editing rows, and the two settings, the counter and the
 * warnings it derives. Plain Node: node --test app/code/Hryvinskyi/DataLayerAdminUi/Test/Js/
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
    counterText,
    parseTable,
    storedValues,
    summary,
    warnings,
    withChannel,
    withSend
} from '../../view/adminhtml/web/js/events-table/table-state.js';

const PRINTED = {
    rows: [
        {event: 'view_item', send: true, channel: 'browser', fixed: false},
        {event: 'add_to_cart', send: true, channel: 'both', fixed: false},
        {event: 'purchase', send: true, channel: 'server', fixed: false},
        {event: 'view_promotion', send: false, channel: 'browser', fixed: false},
        {event: 'sample_server_event', send: false, channel: 'server', fixed: true},
        {event: 'ads_conversion', send: true, channel: 'browser', fixed: true}
    ],
    kept: {disabled: ['retired_event'], routing: [{event: 'retired_event', channel: 'server'}]},
    serverDeliveryEnabled: false
};

/**
 * @returns {object} The printed table, parsed
 */
function table() {
    const parsed = parseTable(PRINTED);
    assert.ok(parsed);

    return parsed;
}

test('the printed table is read with its rows, kept entries and the server-side state', () => {
    const parsed = table();

    assert.equal(parsed.rows.length, 6);
    assert.deepEqual(parsed.rows[4], {event: 'sample_server_event', send: false, channel: 'server', fixed: true});
    assert.deepEqual(parsed.kept, PRINTED.kept);
    assert.equal(parsed.serverDeliveryEnabled, false);
});

test('anything that is not a table with well-formed rows is refused', () => {
    assert.equal(parseTable(null), null);
    assert.equal(parseTable([]), null);
    assert.equal(parseTable({rows: []}), null);
    assert.equal(parseTable({rows: [{event: 'view_item', send: 'yes', channel: 'browser'}]}), null);
    assert.equal(parseTable({rows: [{event: 'view_item', send: true, channel: 'cloud'}]}), null);
    assert.equal(parseTable({rows: [{event: '', send: true, channel: 'browser'}]}), null);
});

test('malformed kept entries are dropped, the rest of the table stays', () => {
    const parsed = parseTable({...PRINTED, kept: {disabled: ['old', 7], routing: [{event: 'old'}, 'x']}});

    assert.deepEqual(parsed.kept, {disabled: ['old'], routing: []});
});

test('the stored table saves the events switched off and a routing row per event not sent to the browser', () => {
    assert.deepEqual(storedValues(table()), {
        disabled: 'view_promotion,sample_server_event,retired_event',
        routing: [
            {event: 'add_to_cart', channel: 'both'},
            {event: 'purchase', channel: 'server'},
            {event: 'retired_event', channel: 'server'}
        ]
    });
});

test('switching an event off keeps its channel, so switching it back on restores it', () => {
    const off = withSend(table(), 'purchase', false);

    assert.deepEqual(storedValues(off), {
        disabled: 'purchase,view_promotion,sample_server_event,retired_event',
        routing: [
            {event: 'add_to_cart', channel: 'both'},
            {event: 'purchase', channel: 'server'},
            {event: 'retired_event', channel: 'server'}
        ]
    });
    assert.deepEqual(storedValues(withSend(off, 'purchase', true)), storedValues(table()));
});

test('routing an event to the browser removes its routing row', () => {
    const values = storedValues(withChannel(table(), 'add_to_cart', 'browser'));

    assert.deepEqual(values.routing, [
        {event: 'purchase', channel: 'server'},
        {event: 'retired_event', channel: 'server'}
    ]);
});

test('a fixed channel cannot change, an unknown channel or event changes nothing, and the original is untouched', () => {
    const original = table();

    assert.equal(withChannel(original, 'sample_server_event', 'browser'), original);
    assert.equal(withChannel(original, 'purchase', 'cloud'), original);
    assert.equal(withSend(original, 'not_listed', false), original);
    assert.equal(withSend(original, 'sample_server_event', true).rows[4].send, true);
    assert.equal(original.rows[4].send, false);
    assert.equal(original.rows[2].channel, 'server');
});

test('an event the table already switches off is not repeated from the kept entries', () => {
    const parsed = parseTable({...PRINTED, kept: {disabled: ['view_promotion', 'retired_event'], routing: []}});

    assert.equal(storedValues(parsed).disabled, 'view_promotion,sample_server_event,retired_event');
});

test('the counter counts the events sent and, among them, the ones the server sends', () => {
    assert.deepEqual(summary(table()), {sent: 4, total: 6, fromServer: 2});
    assert.deepEqual(summary(withSend(table(), 'sample_server_event', true)), {sent: 5, total: 6, fromServer: 3});
    assert.equal(
        counterText('{sent} of {total} sent · {server} from the server', summary(table())),
        '4 of 6 sent · 2 from the server'
    );
});

test('both warnings show while an event sent by both sides and server routes without delivery exist', () => {
    assert.deepEqual(warnings(table()), {both: true, serverWithoutDelivery: true});
});

test('the warnings follow the sent events only, and server-side delivery clears the second one', () => {
    let state = withSend(table(), 'add_to_cart', false);
    assert.deepEqual(warnings(state), {both: false, serverWithoutDelivery: true});

    state = withSend(state, 'purchase', false);
    assert.deepEqual(warnings(state), {both: false, serverWithoutDelivery: false});

    const delivered = parseTable({...PRINTED, serverDeliveryEnabled: true});
    assert.deepEqual(warnings(delivered), {both: true, serverWithoutDelivery: false});
});

test('a sent fixed server event alone asks for server-side delivery', () => {
    const state = withSend(withSend(withSend(table(), 'add_to_cart', false), 'purchase', false), 'sample_server_event', true);

    assert.deepEqual(warnings(state), {both: false, serverWithoutDelivery: true});
});
