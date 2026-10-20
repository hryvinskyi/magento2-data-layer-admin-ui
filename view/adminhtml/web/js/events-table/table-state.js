/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The events table's state and what it saves. Pure: no DOM, no globals.
 *
 * Each row is an event with its Send switch and its channel (`browser`, `server` or `both`); a row whose channel is
 * fixed keeps it whatever happens. The table saves two settings: the events switched off, as one comma list, and a
 * routing row for each event that does not go to the browser (switched off or not, so switching it back on keeps its
 * channel). Entries the page kept for events no module registers are saved again unchanged, after the table's own.
 */

const CHANNELS = Object.freeze(['browser', 'server', 'both']);
const SERVER_CHANNELS = Object.freeze(['server', 'both']);

/**
 * @typedef {{event: string, send: boolean, channel: string, fixed: boolean}} Row
 * @typedef {{event: string, channel: string}} RoutingRow
 * @typedef {{disabled: string[], routing: RoutingRow[]}} Kept
 * @typedef {{rows: Row[], kept: Kept, serverDeliveryEnabled: boolean}} Table
 */

/**
 * @param {*} value
 * @returns {boolean} Whether a value is an object (not an array, not null)
 */
function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {*} value
 * @returns {RoutingRow|null}
 */
function parseRoutingRow(value) {
    if (!isObject(value) || typeof value.event !== 'string' || typeof value.channel !== 'string') {
        return null;
    }

    return Object.freeze({event: value.event, channel: value.channel});
}

/**
 * @param {*} value
 * @returns {Row|null}
 */
function parseRow(value) {
    if (!isObject(value) || typeof value.event !== 'string' || value.event === ''
        || typeof value.send !== 'boolean' || !CHANNELS.includes(value.channel)
    ) {
        return null;
    }

    return Object.freeze({event: value.event, send: value.send, channel: value.channel, fixed: value.fixed === true});
}

/**
 * Read the table the page printed
 *
 * @param {*} value The parsed JSON configuration
 * @returns {Table|null} Null when it is not a table: no rows, or a row that is not one
 */
export function parseTable(value) {
    if (!isObject(value) || !Array.isArray(value.rows) || value.rows.length === 0) {
        return null;
    }
    const rows = value.rows.map(parseRow);
    if (rows.includes(null)) {
        return null;
    }
    const kept = isObject(value.kept) ? value.kept : {};
    const disabled = Array.isArray(kept.disabled) ? kept.disabled.filter((name) => typeof name === 'string') : [];
    const routing = Array.isArray(kept.routing) ? kept.routing.map(parseRoutingRow).filter(Boolean) : [];

    return Object.freeze({
        rows: Object.freeze(rows),
        kept: Object.freeze({disabled: Object.freeze(disabled), routing: Object.freeze(routing)}),
        serverDeliveryEnabled: value.serverDeliveryEnabled === true
    });
}

/**
 * @param {Table} table
 * @param {string} event
 * @param {function(Row): Row} change
 * @returns {Table} A new table with one row changed; the same table when no editable row has that event
 */
function withRow(table, event, change) {
    let changed = false;
    const rows = table.rows.map((row) => {
        if (row.event !== event || row.fixed && change(row).channel !== row.channel) {
            return row;
        }
        changed = true;

        return Object.freeze(change(row));
    });

    return changed ? Object.freeze({...table, rows: Object.freeze(rows)}) : table;
}

/**
 * Switch an event's sending on or off
 *
 * @param {Table} table
 * @param {string} event
 * @param {boolean} send
 * @returns {Table}
 */
export function withSend(table, event, send) {
    return withRow(table, event, (row) => ({...row, send: send === true}));
}

/**
 * Route an event to a channel; a fixed channel and an unknown channel are left as they are
 *
 * @param {Table} table
 * @param {string} event
 * @param {string} channel
 * @returns {Table}
 */
export function withChannel(table, event, channel) {
    if (!CHANNELS.includes(channel)) {
        return table;
    }

    return withRow(table, event, (row) => ({...row, channel}));
}

/**
 * The two settings the table saves
 *
 * @param {Table} table
 * @returns {{disabled: string, routing: RoutingRow[]}}
 */
export function storedValues(table) {
    const disabled = table.rows.filter((row) => !row.send).map((row) => row.event);
    const routing = table.rows
        .filter((row) => !row.fixed && row.channel !== 'browser')
        .map((row) => ({event: row.event, channel: row.channel}));

    return {
        disabled: [...disabled, ...table.kept.disabled.filter((name) => !disabled.includes(name))].join(','),
        routing: [...routing, ...table.kept.routing.map((row) => ({...row}))]
    };
}

/**
 * How many events are sent, out of how many, and how many of those the server sends
 *
 * @param {Table} table
 * @returns {{sent: number, total: number, fromServer: number}}
 */
export function summary(table) {
    const sent = table.rows.filter((row) => row.send);

    return {
        sent: sent.length,
        total: table.rows.length,
        fromServer: sent.filter((row) => SERVER_CHANNELS.includes(row.channel)).length
    };
}

/**
 * Which warnings the table shows: an event sent by both sides (GA4 counts it twice), and an event sent from the
 * server while server-side delivery is off for the scope
 *
 * @param {Table} table
 * @returns {{both: boolean, serverWithoutDelivery: boolean}}
 */
export function warnings(table) {
    const sent = table.rows.filter((row) => row.send);

    return {
        both: sent.some((row) => row.channel === 'both'),
        serverWithoutDelivery: !table.serverDeliveryEnabled
            && sent.some((row) => SERVER_CHANNELS.includes(row.channel))
    };
}

/**
 * Fill the counter's wording: `{sent}`, `{total}` and `{server}` are replaced by the numbers
 *
 * @param {string} template
 * @param {{sent: number, total: number, fromServer: number}} counts
 * @returns {string}
 */
export function counterText(template, counts) {
    const values = {sent: counts.sent, total: counts.total, server: counts.fromServer};

    return String(template).replace(/\{(sent|total|server)\}/g, (match, key) => String(values[key]));
}
