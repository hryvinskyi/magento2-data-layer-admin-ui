/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { waitFor } from '@testing-library/preact';
import type { JSX } from 'preact';
import { requireSettingKey, requireStepId, useSetting, type PluginRegister } from '@hryvinskyi/datalayer-setup';
import { mountWizard, startWizard, type BootDependencies } from './boot.tsx';
import type { WirePageConfig } from './adapters/contract.ts';
import { recordingLogger, recordingNavigator, settle, type RecordingLogger } from './test/fakes.ts';
import { multiWebsiteConfig } from './test/fixtures/page-config.ts';
import { DEFAULT_STEPS } from './test/wizard-harness.tsx';
import { App } from './ui/App.tsx';

afterEach(() => {
    document.body.replaceChildren();
});

/** A step plugin as a module exports it: its step shows the website-only `sample_days` value. */
function SampleStep(): JSX.Element {
    const days = useSetting(requireSettingKey('sample_days'));
    return <p data-testid="sample-days">{String(days.value)}</p>;
}

const samplePlugin: PluginRegister = (sdk) => {
    sdk.registerStep({ id: requireStepId('sample'), icon: 'tune', title: 'step.sample.title', component: SampleStep });
};

/** The page the server renders: the root with its loading line, and the page config beside it. */
function page(config: unknown, failedText = 'wizard.failed'): HTMLElement {
    const root = document.createElement('div');
    root.setAttribute('data-role', 'hdl-setup');
    root.setAttribute('data-failed-text', failedText);
    const loading = document.createElement('p');
    loading.setAttribute('data-role', 'hdl-setup-loading');
    loading.textContent = 'wizard.loading';
    const script = document.createElement('script');
    script.type = 'application/json';
    script.setAttribute('data-role', 'hdl-setup-config');
    script.textContent = typeof config === 'string' ? config : JSON.stringify(config);
    root.append(loading, script);
    document.body.append(root);
    return root;
}

function withPlugins(plugins: WirePageConfig['plugins']): WirePageConfig {
    return {
        ...multiWebsiteConfig,
        initialScope: 'website:2',
        plugins,
        phrases: { ...multiWebsiteConfig.phrases, 'step.sample.title': 'step.sample.title' },
    };
}

interface Booted {
    readonly dependencies: BootDependencies;
    readonly logger: RecordingLogger;
    readonly imported: string[];
}

function boot(modules: Readonly<Record<string, () => Promise<unknown>>>, builtIns: BootDependencies['builtIns'] = []): Booted {
    const logger = recordingLogger();
    const imported: string[] = [];
    return {
        logger,
        imported,
        dependencies: {
            App,
            builtIns,
            importModule: (specifier) => {
                imported.push(specifier);
                const load = modules[specifier];
                return load === undefined ? Promise.reject(new Error(`Cannot find module ${specifier}`)) : load();
            },
            fetch: () => Promise.reject(new Error('no network in tests')),
            navigator: recordingNavigator(),
            logger,
        },
    };
}

describe('starting the wizard', () => {
    it('renders a plugin step reading the value the page config holds', async () => {
        const root = page(withPlugins([{ id: 'sample', module: '@test/sample' }]));
        const { dependencies, logger } = boot({ '@test/sample': () => Promise.resolve({ default: samplePlugin }) });
        await mountWizard(root, dependencies);

        assert.equal(root.querySelector('[data-testid="sample-days"]')?.textContent, '30');
        assert.equal(root.querySelector('h2')?.textContent, 'step.sample.title');
        assert.equal(root.querySelector('[data-role="hdl-setup-loading"]') === null, true, 'the loading line is gone');
        assert.deepEqual(logger.errors.map((entry) => `${entry.message}: ${String(entry.detail)}`), []);
    });

    it('mounts each root once, however often it is started', async () => {
        const root = page(withPlugins([{ id: 'sample', module: '@test/sample' }]));
        const { dependencies, imported } = boot({ '@test/sample': () => Promise.resolve({ default: samplePlugin }) });
        startWizard(document, dependencies);
        startWizard(document, dependencies);
        await mountWizard(root, dependencies);
        await waitFor(() => assert.ok(root.querySelector('[data-testid="sample-days"]')));
        await settle();

        assert.equal(root.querySelectorAll('section').length, 1);
        assert.deepEqual(imported, ['@test/sample']);
    });

    it('waits for the document when it is still loading', async () => {
        const root = page(withPlugins([{ id: 'sample', module: '@test/sample' }]));
        const { dependencies } = boot({ '@test/sample': () => Promise.resolve({ default: samplePlugin }) });
        Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true });
        try {
            startWizard(document, dependencies);
            await settle();
            assert.equal(root.querySelector('section') === null, true, 'nothing before the document has loaded');
            document.dispatchEvent(new Event('DOMContentLoaded'));
        } finally {
            Reflect.deleteProperty(document, 'readyState');
        }
        await waitFor(() => assert.ok(root.querySelector('[data-testid="sample-days"]')));
    });

    it('leaves out a plugin that fails to load or exports no register function, and runs the rest', async () => {
        const root = page(withPlugins([
            { id: 'broken', module: '@test/broken' },
            { id: 'empty', module: '@test/empty' },
            { id: 'sample', module: '@test/sample' },
        ]));
        const { dependencies, logger } = boot({
            '@test/empty': () => Promise.resolve({ default: 'not a function' }),
            '@test/sample': () => Promise.resolve({ default: samplePlugin }),
        });
        await mountWizard(root, dependencies);

        assert.equal(root.querySelector('[data-testid="sample-days"]')?.textContent, '30');
        assert.deepEqual(logger.errors.map((entry) => entry.message), [
            'The setup plugin broken (@test/broken) could not be loaded',
            'The setup plugin empty (@test/empty) exports no register function',
        ]);
    });

    it('starts without a plugin that has not loaded by the deadline, and logs it', async () => {
        const root = page(withPlugins([
            { id: 'stuck', module: '@test/stuck' },
            { id: 'sample', module: '@test/sample' },
        ]));
        const { dependencies, logger } = boot({
            '@test/stuck': () => new Promise<unknown>(() => undefined),
            '@test/sample': () => Promise.resolve({ default: samplePlugin }),
        });
        await mountWizard(root, { ...dependencies, pluginDeadlineMs: 20 });

        assert.equal(root.querySelector('[data-testid="sample-days"]')?.textContent, '30');
        assert.deepEqual(logger.errors.map((entry) => entry.message), ['The setup plugin stuck (@test/stuck) could not be loaded']);
        const detail = logger.errors[0]?.detail;
        assert.ok(detail instanceof Error && detail.name === 'PluginDeadlineError', 'the log says it was the deadline');
    });

    it('leaves out a plugin whose register() throws', async () => {
        const root = page(withPlugins([{ id: 'throws', module: '@test/throws' }]));
        const throwing: PluginRegister = (sdk) => {
            sdk.registerStep({ id: requireStepId('half'), icon: 'tune', title: 'step.sample.title', component: SampleStep });
            throw new Error('plugin bug');
        };
        const { dependencies, logger } = boot({ '@test/throws': () => Promise.resolve({ default: throwing }) }, [
            (sdk) => DEFAULT_STEPS.forEach((step) => sdk.registerStep(step)),
        ]);
        await mountWizard(root, dependencies);

        assert.equal(root.querySelector('h2')?.textContent, 'step.connect.title');
        assert.equal(root.querySelector('[data-testid="sample-days"]') === null, true);
        assert.deepEqual(logger.errors.map((entry) => entry.message), ['The setup plugin throws (@test/throws) could not register']);
    });

    it('shows the failure text and logs the path when the page config cannot be read', async () => {
        const root = page({ ...multiWebsiteConfig, formKey: 42 }, 'The setup could not be loaded.');
        const { dependencies, logger } = boot({});
        await mountWizard(root, dependencies);

        assert.equal(root.querySelector('[data-role="hdl-setup-loading"]')?.textContent, 'The setup could not be loaded.');
        assert.deepEqual(logger.errors.map((entry) => entry.message), ['The setup page configuration could not be read at $.formKey']);
    });

    it('shows the failure text when the config is not JSON, or when no step could be placed', async () => {
        const notJson = page('{not json');
        const first = boot({});
        await mountWizard(notJson, first.dependencies);
        assert.equal(notJson.querySelector('[data-role="hdl-setup-loading"]')?.textContent, 'wizard.failed');

        const noSteps = page(withPlugins([]));
        const second = boot({});
        await mountWizard(noSteps, second.dependencies);
        assert.equal(noSteps.querySelector('[data-role="hdl-setup-loading"]')?.textContent, 'wizard.failed');
        assert.deepEqual(second.logger.errors.map((entry) => entry.message), ['The setup wizard could not start']);
    });
});
