/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { multiWebsiteConfig } from '../test/fixtures/page-config.ts';
import { eventName, key, scope, stateOf } from '../test/fixtures/setup-state.ts';
import { changes, toSaveRequest } from './diff.ts';
import { createDraft, inheritEvents, inheritValue, setEvents, setValue, type Draft, type DraftRefusal } from './draft.ts';
import { selectionOf } from './events.ts';
import type { Result } from './result.ts';
import { EVENTS_KEY } from './setting.ts';

const state = stateOf(multiWebsiteConfig);
const catalogue = state.events.catalogue;

function ok(result: Result<Draft, DraftRefusal>): Draft {
    if (!result.ok) {
        throw new assert.AssertionError({ message: `Refused: ${result.error}` });
    }
    return result.value;
}

describe('pending changes', () => {
    it('are none for the stored snapshot', () => {
        assert.deepEqual(changes(createDraft(state)), []);
        assert.deepEqual(toSaveRequest(changes(createDraft(state))), { changes: [] });
    });

    it('list a value change as a set', () => {
        const draft = ok(setValue(createDraft(state), scope('website:1'), key('container_id'), 'GTM-NEW1'));
        assert.deepEqual(toSaveRequest(changes(draft)), {
            changes: [{ scope: 'website:1', key: 'container_id', op: 'set', value: 'GTM-NEW1' }],
        });
    });

    it('list an inheritance-only change as an inherit', () => {
        const draft = ok(inheritValue(createDraft(state), scope('website:2'), key('brand')));
        assert.deepEqual(toSaveRequest(changes(draft)), {
            changes: [{ scope: 'website:2', key: 'brand', op: 'inherit' }],
        });
    });

    it('vanish when a value is changed and changed back', () => {
        const there = ok(setValue(createDraft(state), scope('store:3'), key('list_view'), 'load'));
        const back = ok(setValue(there, scope('store:3'), key('list_view'), 'visible'));
        assert.deepEqual(changes(back), []);
    });

    it('compare event selections by content, not by the order names were added', () => {
        const stored = state.events.stored.get(scope('website:2'));
        assert.ok(stored);
        const reordered = selectionOf(
            catalogue,
            [eventName('login'), eventName('refund')],
            [[eventName('view_item'), 'browser'], [eventName('purchase'), 'both']],
        );
        assert.deepEqual(changes(ok(setEvents(createDraft(state), scope('website:2'), reordered))), []);
    });

    it('carry a replacement secret as plain text', () => {
        const draft = ok(setValue(createDraft(state), scope('website:2'), key('sample_secret'), { replace: 's3cret' }));
        assert.deepEqual(toSaveRequest(changes(draft)).changes, [
            { scope: 'website:2', key: 'sample_secret', op: 'set', value: 's3cret' },
        ]);
    });

    it('carry an event selection with sorted names and routing only where it is not the browser', () => {
        const selection = selectionOf(
            catalogue,
            [eventName('view_cart'), eventName('add_to_cart')],
            [[eventName('purchase'), 'server'], [eventName('begin_checkout'), 'both'], [eventName('view_item'), 'browser']],
        );
        const draft = ok(setEvents(createDraft(state), scope('store:1'), selection));
        assert.deepEqual(toSaveRequest(changes(draft)).changes, [{
            scope: 'store:1',
            key: 'events',
            op: 'set',
            value: { off: ['add_to_cart', 'view_cart'], channels: { begin_checkout: 'both', purchase: 'server' } },
        }]);
    });

    it('are ordered by scope, then by the order given', () => {
        let draft = createDraft(state);
        draft = ok(setValue(draft, scope('store:3'), key('brand'), ''));
        draft = ok(inheritEvents(draft, scope('website:2')));
        draft = ok(setValue(draft, scope('website:2'), key('item_id'), 'entity_id'));
        draft = ok(setValue(draft, scope('default'), key('brand'), 'manufacturer'));
        draft = ok(setValue(draft, scope('default'), key('container_id'), 'GTM-X1'));
        const ordered = (list: ReturnType<typeof changes>) => list.map((change) => `${change.scope} ${change.key}`);

        assert.deepEqual(ordered(changes(draft, [key('container_id'), EVENTS_KEY, key('brand'), key('item_id')])), [
            'default container_id',
            'default brand',
            'website:2 events',
            'website:2 item_id',
            'store:3 brand',
        ]);
        assert.deepEqual(ordered(changes(draft)), [
            'default container_id',
            'default brand',
            'website:2 item_id',
            'website:2 events',
            'store:3 brand',
        ]);
    });
});
