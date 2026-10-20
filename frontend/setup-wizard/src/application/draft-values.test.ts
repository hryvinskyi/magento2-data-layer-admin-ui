/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDraft, setValue, type Draft } from '../domain/draft.ts';
import { EVENTS_KEY } from '../domain/setting.ts';
import { viewOf } from '../domain/view.ts';
import { multiWebsiteConfig } from '../test/fixtures/page-config.ts';
import { key, scope, stateOf } from '../test/fixtures/setup-state.ts';
import { draftValues, previewKeys, previewRequestOf } from './draft-values.ts';

const stored = createDraft(stateOf(multiWebsiteConfig));

function replaced(draft: Draft): Draft {
    const result = setValue(draft, scope('website:2'), key('sample_secret'), { replace: 'new-secret' });
    assert.ok(result.ok);
    return result.value;
}

describe('draft values', () => {
    it('sends the value that applies at the scope, edits included', () => {
        const edited = setValue(stored, scope('store:3'), key('item_id'), 'entity_id');
        assert.ok(edited.ok);
        const values = draftValues(viewOf(edited.value, scope('store:3')), [key('item_id'), key('brand'), key('enabled')]);

        assert.deepEqual(values, { item_id: 'entity_id', brand: 'manufacturer', enabled: true });
    });

    it('sends a secret only when the draft replaces it', () => {
        const keys = [key('sample_secret')];

        assert.deepEqual(draftValues(viewOf(stored, scope('website:2')), keys), {}, 'stored and set: the server uses its own');
        assert.deepEqual(draftValues(viewOf(replaced(stored), scope('website:2')), keys), { sample_secret: 'new-secret' });
        assert.deepEqual(draftValues(viewOf(replaced(stored), scope('store:3')), keys), { sample_secret: 'new-secret' }, 'inherited replacement');
    });

    it('sends the events setting as the save request carries it, and leaves out unknown keys', () => {
        const values = draftValues(viewOf(stored, scope('website:2')), [EVENTS_KEY, key('no_such_setting')]);

        assert.deepEqual(values, { events: { off: ['login', 'refund'], channels: { purchase: 'both' } } });
    });
});

describe('preview request', () => {
    it('drafts whether events are sent, which ones, and every connect and products setting', () => {
        const view = viewOf(stored, scope('store:1'));

        assert.deepEqual(previewKeys(view), [
            'enabled',
            'container_id',
            'script_host',
            'measurement_id',
            'item_id',
            'brand',
            'tax_catalog',
            'hidden_price',
            'list_view',
            'events',
        ]);
    });

    it('is built for a store view only', () => {
        const choice = { kind: 'view_item', product: 7, priceVisible: false } as const;
        const request = previewRequestOf(viewOf(stored, scope('store:1')), choice);

        assert.equal(previewRequestOf(viewOf(stored, scope('website:1')), choice), null);
        assert.equal(request?.store, 'store:1');
        assert.deepEqual([request?.kind, request?.product, request?.priceVisible], ['view_item', 7, false]);
        assert.equal(request?.settings['item_id'], 'entity_id');
        assert.equal(request?.settings['hidden_price'], 'skip');
    });
});
