/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Mounts the whole wizard for a test, as the page mounts it: the page config fixture parsed as the page parses it,
 * the shell's own steps registered first, then the given step plugins, and `<App>` rendered inside the provider.
 * The ports are fakes: the gateway records every request and answers only when the test settles it, the navigator
 * records where the wizard went and what it asked, the logger records errors. A phrase the fixture lacks fails the
 * test.
 *
 * `renderWizard()` opens the first step; `renderStep()` opens the named one. Both return Testing Library's queries
 * (bound to the rendered wizard) with the fakes and the runtime.
 */
import { render, type RenderResult } from '@testing-library/preact';
import {
    applyPlugin,
    requireStepId,
    WizardProvider,
    type PluginRegister,
    type StepId,
    type WizardRuntime,
} from '@hryvinskyi/datalayer-setup';
import type { WirePageConfig } from '../adapters/contract.ts';
import { App } from '../ui/App.tsx';
import { registerBuiltInSteps } from '../ui/steps/index.ts';
import {
    recordingGateway,
    recordingLogger,
    recordingNavigator,
    type RecordingGateway,
    type RecordingLogger,
    type RecordingNavigator,
} from './fakes.ts';
import { multiWebsiteConfig } from './fixtures/page-config.ts';
import { createTestRuntime } from './wizard-harness.tsx';

export interface RenderWizardOptions {
    readonly gateway?: RecordingGateway;
    readonly navigator?: RecordingNavigator;
    readonly logger?: RecordingLogger;
    /** Step plugins registered after the shell's own steps, as the page registers them. */
    readonly plugins?: readonly PluginRegister[];
}

export type RenderedWizard = RenderResult & {
    readonly gateway: RecordingGateway;
    readonly navigator: RecordingNavigator;
    readonly logger: RecordingLogger;
    readonly runtime: WizardRuntime;
};

function mount(config: WirePageConfig, options: RenderWizardOptions, step: StepId | undefined): RenderedWizard {
    const gateway = options.gateway ?? recordingGateway();
    const navigator = options.navigator ?? recordingNavigator();
    const logger = options.logger ?? recordingLogger();
    const runtime = createTestRuntime(config, { gateway, navigator, logger, steps: [] });
    applyPlugin(runtime, registerBuiltInSteps);
    (options.plugins ?? []).forEach((register) => applyPlugin(runtime, register));

    const rendered = render(
        <WizardProvider runtime={runtime} {...(step === undefined ? {} : { initialStep: step })}>
            <App />
        </WizardProvider>,
    );
    return Object.assign(rendered, { gateway, navigator, logger, runtime });
}

/** The wizard on its first step. */
export function renderWizard(config: WirePageConfig = multiWebsiteConfig, options: RenderWizardOptions = {}): RenderedWizard {
    return mount(config, options, undefined);
}

/** The wizard opened on one step (a built-in one, or a plugin's from `options.plugins`). */
export function renderStep(
    step: StepId | string,
    config: WirePageConfig = multiWebsiteConfig,
    options: RenderWizardOptions = {},
): RenderedWizard {
    return mount(config, options, requireStepId(step));
}
