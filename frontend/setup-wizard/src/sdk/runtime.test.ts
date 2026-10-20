/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parsePageConfig } from '../adapters/contract.ts';
import { createDraft } from '../domain/draft.ts';
import { viewOf } from '../domain/view.ts';
import { recordingLogger, recordingNavigator } from '../test/fakes.ts';
import { multiWebsiteConfig } from '../test/fixtures/page-config.ts';
import { key, scope, step } from '../test/fixtures/setup-state.ts';
import { applyPlugin, createWizardRuntime, type WizardRuntime } from './runtime.ts';
import type { StepContribution } from './steps.ts';

const config = parsePageConfig(multiWebsiteConfig);
const Empty = (): null => null;
const stepNamed = (id: string, after?: string): StepContribution => ({
    id: step(id),
    ...(after === undefined ? {} : { after: step(after) }),
    icon: 'tune',
    title: `step.${id}.title`,
    component: Empty,
});

function runtime(logger = recordingLogger()): WizardRuntime {
    return createWizardRuntime(config, {
        fetch: () => Promise.reject(new Error('no network in tests')),
        baseUrl: 'https://admin.test/',
        navigator: recordingNavigator(),
        logger,
    });
}

describe('wizard runtime', () => {
    it('knows the wizard\'s own required rules from the start', () => {
        const view = viewOf(createDraft(config.state), scope('default'));

        assert.equal(runtime().requirements.isRequired(key('container_id'), view), true, 'tracking is on and pages load the container');
        assert.equal(runtime().requirements.isRequired(key('measurement_id'), view), false);
    });

    it('builds separate registries for each runtime', () => {
        const first = runtime();
        first.sdk.registerStep(stepNamed('a'));

        assert.equal(runtime().steps.has(step('a')), false);
    });

    it('logs a phrase the page config lacks and shows its key', () => {
        const logger = recordingLogger();

        assert.equal(runtime(logger).translator.t('no.such.phrase'), 'no.such.phrase');
        assert.deepEqual(logger.errors.map((entry) => entry.message), ['Missing phrase: no.such.phrase']);
    });
});

describe('applying a plugin', () => {
    it('adds its steps, rules and server delivery', () => {
        const target = runtime();
        target.sdk.registerStep(stepNamed('connect'));
        applyPlugin(target, (sdk) => {
            sdk.registerStep(stepNamed('sample', 'connect'));
            sdk.registerRequirement(key('sample_days'), () => true);
            sdk.registerServerDelivery({ stepId: step('sample'), isOn: () => true });
        });
        const view = viewOf(createDraft(config.state), scope('website:1'));

        assert.deepEqual(target.steps.ordered().placed.map((item) => item.id), ['connect', 'sample']);
        assert.equal(target.requirements.isRequired(key('sample_days'), view), true);
        assert.equal(target.serverDelivery.contribution()?.stepId, 'sample');
    });

    it('adds nothing when its register() throws half-way', () => {
        const target = runtime();

        assert.throws(() => applyPlugin(target, (sdk) => {
            sdk.registerStep(stepNamed('sample'));
            sdk.registerRequirement(key('sample_days'), () => true);
            throw new Error('plugin bug');
        }), /plugin bug/);
        assert.equal(target.steps.has(step('sample')), false);
        assert.equal(target.requirements.isRequired(key('sample_days'), viewOf(createDraft(config.state), scope('website:1'))), false);
    });

    it('adds nothing when one of its steps takes an id already registered', () => {
        const target = runtime();
        target.sdk.registerStep(stepNamed('connect'));

        assert.throws(() => applyPlugin(target, (sdk) => {
            sdk.registerStep(stepNamed('sample'));
            sdk.registerStep(stepNamed('connect'));
        }), (error: unknown) => error instanceof Error && error.name === 'StepTakenError');
        assert.equal(target.steps.has(step('sample')), false);
    });

    it('refuses a second server delivery, from the same plugin or another', () => {
        const target = runtime();
        const delivery = { stepId: step('sample'), isOn: () => true };
        applyPlugin(target, (sdk) => sdk.registerServerDelivery(delivery));

        assert.throws(() => applyPlugin(target, (sdk) => sdk.registerServerDelivery(delivery)), { name: 'ServerDeliveryTakenError' });
        assert.throws(() => applyPlugin(runtime(), (sdk) => {
            sdk.registerServerDelivery(delivery);
            sdk.registerServerDelivery(delivery);
        }), { name: 'ServerDeliveryTakenError' });
    });
});
