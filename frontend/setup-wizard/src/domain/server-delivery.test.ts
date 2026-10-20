/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { multiWebsiteConfig } from '../test/fixtures/page-config.ts';
import { key, scope, stateOf, step } from '../test/fixtures/setup-state.ts';
import { createDraft, setValue } from './draft.ts';
import { createServerDeliveryRegistry, deliveryOf, ServerDeliveryTakenError } from './server-delivery.ts';
import { flagOf } from './setting.ts';
import { viewOf, type SettingsView } from './view.ts';

const draft = createDraft(stateOf(multiWebsiteConfig));

/** A contribution reading a website-only flag at the view's website, as a step plugin would. */
const sample = {
    stepId: step('sample'),
    isOn: (view: SettingsView): boolean => {
        const website = view.tree.websiteOf(view.scope.id);
        return website !== null && flagOf(view.valueAt(key('sample_enabled'), website));
    },
};

describe('server delivery', () => {
    it('is off with no step when nothing is registered', () => {
        assert.deepEqual(deliveryOf(createServerDeliveryRegistry(), viewOf(draft, scope('store:1'))), { on: false, stepId: null });
    });

    it('answers what the registered contribution computes from the draft', () => {
        const registry = createServerDeliveryRegistry();
        registry.register(sample);
        assert.deepEqual(deliveryOf(registry, viewOf(draft, scope('store:1'))), { on: false, stepId: 'sample' });
        const on = setValue(draft, scope('website:1'), key('sample_enabled'), true);
        assert.ok(on.ok);
        assert.deepEqual(deliveryOf(registry, viewOf(on.value, scope('store:1'))), { on: true, stepId: 'sample' });
        assert.deepEqual(deliveryOf(registry, viewOf(on.value, scope('store:3'))), { on: false, stepId: 'sample' });
    });

    it('takes one contribution and fails loudly on a second', () => {
        const registry = createServerDeliveryRegistry();
        registry.register(sample);
        assert.throws(() => registry.register({ ...sample, stepId: step('other') }), ServerDeliveryTakenError);
        assert.equal(registry.contribution()?.stepId, 'sample');
    });

    it('keeps each registry instance separate', () => {
        const first = createServerDeliveryRegistry();
        first.register(sample);
        assert.equal(createServerDeliveryRegistry().contribution(), null);
    });
});
