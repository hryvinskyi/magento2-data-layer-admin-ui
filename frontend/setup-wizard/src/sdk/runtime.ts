/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Everything one wizard page shares: the parsed page configuration, the ports, the wording and the registries
 * the shell and the step plugins fill. Each page builds exactly one; nothing here is module-level state, so a test
 * builds as many as it likes.
 *
 * A plugin registers through the `SetupSdk` it is handed. Its registrations are collected first and applied only
 * when its `register()` returned and none of them collides with what is already registered, so a plugin that
 * fails half-way contributes nothing rather than half a step.
 */
import type { Logger, Navigator, SetupGateway } from '../application/ports.ts';
import { createSessionSource, type Session, type SessionSource } from '../application/session.ts';
import { parseSession, sessionOf, type PageConfig } from '../adapters/contract.ts';
import { createHttpGateway } from '../adapters/http-gateway.ts';
import { createJsonClient, DEFAULT_DEADLINE_MS, type Fetch, type JsonClient } from '../adapters/json-client.ts';
import {
    createServerDeliveryRegistry,
    ServerDeliveryTakenError,
    type ServerDeliveryContribution,
    type ServerDeliveryRegistry,
} from '../domain/server-delivery.ts';
import type { SettingKey } from '../domain/setting.ts';
import {
    createRequirementRegistry,
    registerCoreRequirements,
    type RequirementRegistry,
    type RequirementRule,
} from '../domain/validation.ts';
import { createTranslator, type Translator } from '../ui/i18n/translator.ts';
import { createStepRegistry, StepTakenError, type StepContribution, type StepRegistry } from './steps.ts';

/** What a step plugin's `register()` receives. */
export interface SetupSdk {
    /** @throws StepTakenError (when applied) */
    registerStep(step: StepContribution): void;
    registerRequirement(key: SettingKey, rule: RequirementRule): void;
    /** @throws ServerDeliveryTakenError (when applied) */
    registerServerDelivery(contribution: ServerDeliveryContribution): void;
    /**
     * The data the server sent for one plugin, unparsed. A plugin parses it while it registers, so data of the wrong
     * shape keeps the plugin out of the page instead of breaking its step later.
     */
    extensionData(pluginId: string): unknown;
}

/** A step plugin module's default export. */
export type PluginRegister = (sdk: SetupSdk) => void;

export interface WizardRuntime {
    readonly config: PageConfig;
    /** The form key, endpoints and links valid now; renewed after the person signs in again. */
    readonly session: SessionSource;
    readonly gateway: SetupGateway;
    /** The JSON client with the wizard's request rules, for plugins calling their own endpoints. */
    readonly client: JsonClient;
    readonly navigator: Navigator;
    readonly logger: Logger;
    readonly translator: Translator;
    readonly steps: StepRegistry;
    readonly requirements: RequirementRegistry;
    readonly serverDelivery: ServerDeliveryRegistry;
    /** Registers straight into this runtime's registries (the shell's own steps use it). */
    readonly sdk: SetupSdk;
}

export interface RuntimeDependencies {
    readonly fetch: Fetch;
    /** What relative endpoint URLs resolve against. */
    readonly baseUrl: string;
    readonly navigator: Navigator;
    readonly logger: Logger;
    /** Replaces the HTTP gateway (tests). */
    readonly gateway?: SetupGateway;
    /** Called for a phrase key the page config lacks; by default the logger reports it. */
    readonly onMissingPhrase?: (key: string) => void;
}

export function createWizardRuntime(config: PageConfig, dependencies: RuntimeDependencies): WizardRuntime {
    // The session is renewed through the client, and the client signs every request with the session's form key.
    const session = createSessionSource(sessionOf(config), async (now: Session, signal: AbortSignal): Promise<Session> =>
        parseSession(await client.get(now.endpoints.session, { signal, timeoutMs: DEFAULT_DEADLINE_MS }), now));
    const client = createJsonClient({ formKey: () => session.current().formKey, baseUrl: dependencies.baseUrl, fetch: dependencies.fetch });
    const steps = createStepRegistry();
    const requirements = createRequirementRegistry();
    registerCoreRequirements(requirements);
    const serverDelivery = createServerDeliveryRegistry();
    const logger = dependencies.logger;

    const extensionData = (pluginId: string): unknown => config.extensions.get(pluginId);

    return Object.freeze({
        config,
        session,
        gateway: dependencies.gateway ?? createHttpGateway(() => session.current().endpoints, client),
        client,
        navigator: dependencies.navigator,
        logger,
        translator: createTranslator({
            locale: config.locale,
            phrases: config.phrases,
            onMissing: dependencies.onMissingPhrase ?? ((key: string): void => logger.error(`Missing phrase: ${key}`)),
        }),
        steps,
        requirements,
        serverDelivery,
        sdk: Object.freeze({
            registerStep: (step: StepContribution): void => steps.register(step),
            registerRequirement: (key: SettingKey, rule: RequirementRule): void => requirements.register(key, rule),
            registerServerDelivery: (contribution: ServerDeliveryContribution): void => serverDelivery.register(contribution),
            extensionData,
        }),
    });
}

/**
 * Runs a plugin's `register()` and applies what it registered, all or nothing.
 *
 * @throws whatever `register()` throws, StepTakenError, ServerDeliveryTakenError
 */
export function applyPlugin(runtime: WizardRuntime, register: PluginRegister): void {
    const steps: StepContribution[] = [];
    const requirements: [SettingKey, RequirementRule][] = [];
    const deliveries: ServerDeliveryContribution[] = [];
    register(Object.freeze({
        registerStep: (step: StepContribution): void => void steps.push(step),
        registerRequirement: (key: SettingKey, rule: RequirementRule): void => void requirements.push([key, rule]),
        registerServerDelivery: (contribution: ServerDeliveryContribution): void => void deliveries.push(contribution),
        extensionData: runtime.sdk.extensionData,
    }));

    const ids = new Set<string>();
    for (const step of steps) {
        if (ids.has(step.id) || runtime.steps.has(step.id)) {
            throw new StepTakenError(step.id);
        }
        ids.add(step.id);
    }
    const [delivery, second] = deliveries;
    const taken = runtime.serverDelivery.contribution();
    if (delivery !== undefined && (second !== undefined || taken !== null)) {
        throw new ServerDeliveryTakenError(taken?.stepId ?? delivery.stepId);
    }

    steps.forEach((step) => runtime.sdk.registerStep(step));
    requirements.forEach(([key, rule]) => runtime.sdk.registerRequirement(key, rule));
    deliveries.forEach((contribution) => runtime.sdk.registerServerDelivery(contribution));
}
