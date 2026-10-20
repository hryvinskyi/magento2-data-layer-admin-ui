/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * A wizard runtime for tests: a page config fixture parsed as the page would parse it, fake ports, and steps
 * (by default two empty ones owning the connect and products settings). A phrase the fixture lacks fails the test.
 * Everything shared is reached through the SDK specifier, as the shell reaches it.
 */
import type { ComponentChildren, JSX } from 'preact';
import {
    CONNECT_STEP,
    createWizardRuntime,
    parsePageConfig,
    PRODUCTS_STEP,
    WizardProvider,
    type Logger,
    type Navigator,
    type SetupGateway,
    type StepContribution,
    type WizardRuntime,
} from '@hryvinskyi/datalayer-setup';
import type { WirePageConfig } from '../adapters/contract.ts';
import { recordingGateway, recordingLogger, recordingNavigator } from './fakes.ts';
import { multiWebsiteConfig } from './fixtures/page-config.ts';

export interface TestRuntimeOptions {
    readonly gateway?: SetupGateway;
    readonly navigator?: Navigator;
    readonly logger?: Logger;
    readonly steps?: readonly StepContribution[];
}

const Empty = (): null => null;

export const DEFAULT_STEPS: readonly StepContribution[] = [
    { id: CONNECT_STEP, icon: 'link', title: 'step.connect.title', component: Empty },
    { id: PRODUCTS_STEP, icon: 'inventory', title: 'step.products.title', component: Empty },
];

export function createTestRuntime(config: WirePageConfig = multiWebsiteConfig, options: TestRuntimeOptions = {}): WizardRuntime {
    const runtime = createWizardRuntime(parsePageConfig(config), {
        fetch: () => Promise.reject(new Error('Tests talk to a fake gateway, never to the network')),
        baseUrl: 'https://admin.test/',
        navigator: options.navigator ?? recordingNavigator(),
        logger: options.logger ?? recordingLogger(),
        gateway: options.gateway ?? recordingGateway(),
        onMissingPhrase: (key: string): void => {
            throw new Error(`Missing phrase: ${key}`);
        },
    });
    (options.steps ?? DEFAULT_STEPS).forEach((step) => runtime.sdk.registerStep(step));
    return runtime;
}

/** A Testing Library wrapper providing the runtime. */
export function providerFor(runtime: WizardRuntime): (props: { readonly children?: ComponentChildren }) => JSX.Element {
    return ({ children }) => <WizardProvider runtime={runtime}>{children}</WizardProvider>;
}
