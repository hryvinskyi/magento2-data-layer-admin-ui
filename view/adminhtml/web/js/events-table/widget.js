/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Binds one events table to its state: the Send switches and channel selects change the state, and the state writes
 * the inputs the settings form posts, the counter and the warnings.
 *
 * The table's root carries `data-hryvinskyi-datalayer-events-table`; each event's row carries `data-role="event"` and
 * the event's name in `data-event`. Its JSON configuration sits in a `script[data-role="config"]` inside it (rows,
 * kept entries, whether server-side delivery is on, the names of the posted inputs, the wording). The posted inputs are rewritten only when the table changes, so an untouched table
 * posts the stored values the page came with. While "use the parent scope's value" is ticked, every control and every
 * posted value input is disabled and only the two "inherit" inputs are posted.
 */
import {
    counterText,
    parseTable,
    storedValues,
    summary,
    warnings,
    withChannel,
    withSend
} from '@hryvinskyi/data-layer-admin/events-table/table-state.js';

const mounted = new WeakSet();

/**
 * What each control of a row changes, by its `data-role`
 *
 * @type {Readonly<Record<string, function(object, (HTMLInputElement|HTMLSelectElement)): object>>}
 */
const CONTROLS = Object.freeze({
    send: (table, control) => withSend(table, control.dataset.event || '', control.checked === true),
    channel: (table, control) => withChannel(table, control.dataset.event || '', control.value)
});

/**
 * @param {*} value
 * @returns {boolean}
 */
function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Read the table's configuration from its root
 *
 * @param {HTMLElement} root
 * @returns {{table: object, names: object, wording: object}|null} Null when it is missing or not a table
 */
function readConfig(root) {
    const script = root.querySelector('script[data-role="config"]');
    if (!script) {
        return null;
    }
    let raw;
    try {
        raw = JSON.parse(script.textContent || '');
    } catch (error) {
        console.error('The events table configuration is not JSON.', error);

        return null;
    }
    const table = parseTable(raw);
    const names = isObject(raw) && isObject(raw.names) ? raw.names : null;
    const wording = isObject(raw) && isObject(raw.wording) ? raw.wording : null;
    if (!table || !names || typeof names.disabled !== 'string' || typeof names.routing !== 'string' || !wording) {
        console.error('The events table configuration is incomplete.');

        return null;
    }

    return {
        table,
        names,
        wording: {
            yes: String(wording.yes ?? ''),
            no: String(wording.no ?? ''),
            counter: String(wording.counter ?? '')
        }
    };
}

/**
 * @param {Document} document
 * @param {string} name
 * @param {string} value
 * @returns {HTMLInputElement}
 */
function hiddenInput(document, name, value) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;

    return input;
}

/**
 * Write the inputs the form posts for the table's state
 *
 * @param {HTMLElement} container
 * @param {object} names
 * @param {{disabled: string, routing: {event: string, channel: string}[]}} values
 * @param {boolean} disabled
 * @returns {void}
 */
function writeStored(container, names, values, disabled) {
    const document = container.ownerDocument;
    const inputs = [hiddenInput(document, names.disabled, values.disabled)];
    if (names.routing !== '') {
        inputs.push(hiddenInput(document, `${names.routing}[__empty]`, ''));
        values.routing.forEach((row, index) => {
            inputs.push(hiddenInput(document, `${names.routing}[_${index}][event]`, row.event));
            inputs.push(hiddenInput(document, `${names.routing}[_${index}][channel]`, row.channel));
        });
    }
    inputs.forEach((input) => {
        input.disabled = disabled;
    });
    container.replaceChildren(...inputs);
}

/**
 * Bind one events table
 *
 * @param {HTMLElement} root
 * @returns {function(): void} Removes every listener the table added
 */
export function mount(root) {
    if (mounted.has(root)) {
        return () => {};
    }
    const config = readConfig(root);
    if (!config) {
        return () => {};
    }
    mounted.add(root);

    const readonly = root.dataset.readonly === '1';
    const inherit = root.querySelector('input[data-role="inherit"]');
    const routingInherit = root.querySelector('input[data-role="routing-inherit"]');
    const stored = root.querySelector('[data-role="stored"]');
    const counter = root.querySelector('[data-role="counter"]');
    const warningBoth = root.querySelector('[data-role="warning-both"]');
    const warningServer = root.querySelector('[data-role="warning-server"]');
    const controller = new AbortController();
    let table = config.table;

    const isLocked = () => readonly || Boolean(inherit && inherit.checked);

    const renderRows = () => {
        table.rows.forEach((row) => {
            const line = root.querySelector(`[data-role="event"][data-event="${CSS.escape(row.event)}"]`);
            if (!line) {
                return;
            }
            line.classList.toggle('is-off', !row.send);
            const send = line.querySelector('input[data-role="send"]');
            const text = line.querySelector('[data-role="send-text"]');
            const channel = line.querySelector('select[data-role="channel"]');
            if (send) {
                send.checked = row.send;
                send.disabled = isLocked();
            }
            if (text) {
                text.textContent = row.send ? config.wording.yes : config.wording.no;
            }
            if (channel) {
                channel.value = row.channel;
                channel.disabled = isLocked() || !row.send;
            }
        });
    };

    const renderSummary = () => {
        const found = warnings(table);
        if (counter) {
            counter.textContent = counterText(config.wording.counter, summary(table));
        }
        if (warningBoth) {
            warningBoth.hidden = !found.both;
        }
        if (warningServer) {
            warningServer.hidden = !found.serverWithoutDelivery;
        }
    };

    const change = (next) => {
        if (next === table) {
            return;
        }
        table = next;
        renderRows();
        renderSummary();
        if (stored) {
            writeStored(stored, config.names, storedValues(table), isLocked());
        }
    };

    root.addEventListener('change', (event) => {
        const target = event.target;
        const control = target instanceof HTMLInputElement || target instanceof HTMLSelectElement ? target : null;
        const role = control ? control.dataset.role || '' : '';
        const apply = Object.hasOwn(CONTROLS, role) ? CONTROLS[role] : undefined;
        if (!control || !apply || isLocked()) {
            return;
        }
        change(apply(table, control));
    }, {signal: controller.signal});

    if (inherit && !readonly) {
        inherit.addEventListener('change', () => {
            const locked = isLocked();
            root.classList.toggle('is-inherited', locked);
            if (routingInherit) {
                routingInherit.disabled = !locked;
            }
            stored?.querySelectorAll('input').forEach((input) => {
                input.disabled = locked;
            });
            renderRows();
        }, {signal: controller.signal});
    }

    renderSummary();

    return () => {
        controller.abort();
        mounted.delete(root);
    };
}

/**
 * Bind every events table under a scope
 *
 * @param {ParentNode} scope
 * @returns {void}
 */
export function mountAll(scope) {
    scope.querySelectorAll('[data-hryvinskyi-datalayer-events-table]').forEach((root) => {
        if (root instanceof HTMLElement) {
            mount(root);
        }
    });
}
