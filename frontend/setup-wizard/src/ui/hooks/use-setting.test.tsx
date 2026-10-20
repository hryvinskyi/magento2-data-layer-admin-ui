/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { act, cleanup, renderHook } from '@testing-library/preact';
import {
    BUILT_IN,
    useEventsSetting,
    useExtensionData,
    useScope,
    useServerDelivery,
    useSetting,
    useSteps,
    useT,
    useWizard,
    type SettingKey,
    type WizardRuntime,
} from '@hryvinskyi/datalayer-setup';
import { multiWebsiteConfig } from '../../test/fixtures/page-config.ts';
import { eventName, key, scope, step } from '../../test/fixtures/setup-state.ts';
import { createTestRuntime, DEFAULT_STEPS, providerFor } from '../../test/wizard-harness.tsx';

afterEach(cleanup);

function bindSetting(setting: SettingKey, runtime: WizardRuntime = createTestRuntime()) {
    return renderHook(() => ({ setting: useSetting(setting), scope: useScope(), wizard: useWizard() }), { wrapper: providerFor(runtime) });
}

describe('useSetting', () => {
    it('reads the value, where it comes from and whether it can be changed here', () => {
        const { result } = bindSetting(key('container_id'));

        assert.equal(result.current.setting.value, 'GTM-AB12CD3');
        assert.equal(result.current.setting.own, true);
        assert.equal(result.current.setting.inheritedFrom, BUILT_IN);
        assert.equal(result.current.setting.editable, true);
        assert.equal(result.current.setting.definition.kind, 'text');

        act(() => result.current.scope.select(scope('store:1')));
        assert.deepEqual(
            [result.current.setting.own, result.current.setting.inheritedFrom, result.current.setting.editable],
            [false, 'default', false],
            'a store view inherits until it overrides',
        );
    });

    it('sets, overrides and inherits at the current scope', () => {
        const { result } = bindSetting(key('container_id'));
        act(() => result.current.scope.select(scope('store:1')));

        act(() => result.current.setting.override());
        assert.deepEqual([result.current.setting.own, result.current.setting.editable], [true, true]);
        act(() => result.current.setting.set('GTM-ST0RE1'));
        assert.equal(result.current.setting.value, 'GTM-ST0RE1');
        assert.equal(result.current.wizard.dirty, true);

        act(() => result.current.setting.inherit());
        assert.deepEqual([result.current.setting.value, result.current.wizard.dirty], ['GTM-AB12CD3', false]);
    });

    it('reports the lock and the reach of the scope', () => {
        const { result } = bindSetting(key('hidden_price'));
        act(() => result.current.scope.select(scope('website:1')));
        assert.deepEqual([result.current.setting.lock, result.current.setting.editable], ['lock.deployment', false]);

        const days = bindSetting(key('sample_days'));
        act(() => days.result.current.scope.select(scope('store:3')));
        assert.deepEqual([days.result.current.setting.withinReach, days.result.current.setting.editable], [false, false]);
    });

    it('shows a problem only once the field was touched, and forgets the touch on another scope', () => {
        const { result } = bindSetting(key('script_host'));
        act(() => result.current.setting.set('not a host'));
        assert.equal(result.current.setting.error, null);

        act(() => result.current.setting.touch());
        assert.equal(result.current.setting.error, 'format');

        act(() => result.current.scope.select(scope('website:1')));
        assert.equal(result.current.setting.touched, false);
    });

    it('fails loudly for a key the page does not hold', () => {
        assert.throws(() => bindSetting(key('no_such_setting')), { name: 'UnknownSettingError' });
    });
});

describe('useEventsSetting', () => {
    const bind = () => renderHook(() => ({ events: useEventsSetting(), scope: useScope() }), { wrapper: providerFor(createTestRuntime()) });

    it('names the preset the selection equals, and applies another', () => {
        const { result } = bind();
        assert.equal(result.current.events.presetKey, 'standard');

        const minimal = result.current.events.presets.find((preset) => preset.key === 'minimal');
        assert.ok(minimal);
        act(() => result.current.events.applyPreset(minimal.key));
        assert.equal(result.current.events.presetKey, 'minimal');
        assert.equal(result.current.events.selection.off.has(eventName('add_to_cart')), true);
    });

    it('toggles and routes events, ignoring what the catalogue refuses', () => {
        const { result } = bind();
        act(() => result.current.events.toggle(eventName('login')));
        assert.equal(result.current.events.selection.off.has(eventName('login')), true);
        assert.equal(result.current.events.presetKey, 'custom');

        act(() => result.current.events.route(eventName('purchase'), 'both'));
        assert.equal(result.current.events.selection.channels.get(eventName('purchase')), 'both');

        const before = result.current.events.selection;
        act(() => result.current.events.route(eventName('refund'), 'browser'));
        assert.equal(result.current.events.selection, before, 'a fixed channel stays');
    });

    it('inherits and overrides like any setting', () => {
        const { result } = bind();
        act(() => result.current.scope.select(scope('website:1')));
        assert.deepEqual([result.current.events.own, result.current.events.editable, result.current.events.inheritedFrom], [false, false, 'default']);

        act(() => result.current.events.override());
        assert.deepEqual([result.current.events.own, result.current.events.editable], [true, true]);
        act(() => result.current.events.inherit());
        assert.equal(result.current.events.own, false);
    });
});

describe('page-wide hooks', () => {
    it('give the wording, a plugin\'s data and the steps with what holds each back', () => {
        const runtime = createTestRuntime(multiWebsiteConfig, {
            steps: [...DEFAULT_STEPS, {
                id: step('sample'),
                icon: 'tune',
                title: 'step.sample.title',
                component: () => null,
                issues: () => [{ key: key('sample_days'), code: 'range' }],
            }],
        });
        const { result } = renderHook(
            () => ({ t: useT(), data: useExtensionData('sample'), steps: useSteps(), scope: useScope() }),
            { wrapper: providerFor(runtime) },
        );

        assert.equal(result.current.t.t('wizard.title'), 'wizard.title');
        assert.equal(result.current.data, undefined);
        assert.deepEqual(result.current.steps.steps.map((item) => item.id), ['connect', 'products', 'sample']);

        const [connect, , sample] = result.current.steps.steps;
        assert.ok(connect && sample);
        assert.deepEqual(result.current.steps.issuesOf(sample), [{ key: 'sample_days', code: 'range' }]);
        assert.deepEqual(result.current.steps.issuesOf(connect), [], 'the default: issues of the step\'s editable settings');
    });

    it('answers no server delivery until a module contributes one, then its answer for the scope', () => {
        const without = renderHook(() => useServerDelivery(), { wrapper: providerFor(createTestRuntime()) });
        assert.deepEqual(without.result.current, { on: false, stepId: null });

        const runtime = createTestRuntime();
        runtime.sdk.registerServerDelivery({ stepId: step('sample'), isOn: (view) => view.scope.type === 'website' });
        const { result } = renderHook(() => ({ delivery: useServerDelivery(), scope: useScope() }), { wrapper: providerFor(runtime) });
        assert.deepEqual(result.current.delivery, { on: false, stepId: 'sample' });
        act(() => result.current.scope.select(scope('website:2')));
        assert.deepEqual(result.current.delivery, { on: true, stepId: 'sample' });
    });
});
