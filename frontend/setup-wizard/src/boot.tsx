/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Starting the wizard on a page: find each root, read the page configuration printed beside it, build the page's
 * runtime, load the step plugins it names, let the shell and each plugin register, and render.
 *
 * - Each root mounts once, however often starting is asked for.
 * - Starting works whether the document is still loading or long finished.
 * - A configuration that cannot be read shows the server's failure text in the root's loading line (the details go
 *   to the log); nothing half-read reaches the screen.
 * - A plugin that fails to load or to register is logged and left out; the rest of the wizard works. So is a step
 *   whose anchor step never appeared, and a plugin that has not loaded by the deadline: the wizard does not wait for
 *   it forever.
 *
 * Shared pieces come only through the SDK's bare specifier, so this bundle holds no copy of them.
 */
import { render, type ComponentType } from 'preact';
import {
    applyPlugin,
    createWizardRuntime,
    isContractError,
    parsePageConfig,
    WizardProvider,
    type Fetch,
    type Logger,
    type Navigator,
    type PageConfig,
    type PluginRegister,
    type WizardRuntime,
} from '@hryvinskyi/datalayer-setup';

/** The element the wizard renders into; the server prints a loading line inside it. */
export const ROOT_SELECTOR = '[data-role="hdl-setup"]';
/** The JSON page configuration, inside the root or beside it. */
export const CONFIG_SELECTOR = '[data-role="hdl-setup-config"]';
/** The loading line inside the root; it shows the failure text when the wizard cannot start. */
export const LOADING_SELECTOR = '[data-role="hdl-setup-loading"]';
/** The root's attribute holding the translated text shown when the wizard cannot start. */
export const FAILED_TEXT_ATTRIBUTE = 'data-failed-text';

/** How long the wizard waits for a plugin module to load before it starts without it. */
export const PLUGIN_DEADLINE_MS = 15_000;

export interface BootDependencies {
    readonly App: ComponentType;
    /** The shell's own step registrations, applied before any plugin's. */
    readonly builtIns: readonly PluginRegister[];
    /** Loads a plugin module by the bare specifier the page's import map resolves. */
    readonly importModule: (specifier: string) => Promise<unknown>;
    readonly fetch: Fetch;
    readonly navigator: Navigator;
    readonly logger: Logger;
    /** How long to wait for each plugin module; PLUGIN_DEADLINE_MS when left out. */
    readonly pluginDeadlineMs?: number;
}

/** A plugin module that did not load by the deadline. */
class PluginDeadlineError extends Error {
    constructor(specifier: string, deadlineMs: number) {
        super(`${specifier} did not load within ${deadlineMs} ms`);
        this.name = 'PluginDeadlineError';
    }
}

/** Loads a plugin module, or rejects once the deadline passed; the timer never outlives the race. */
function importWithin(dependencies: BootDependencies, specifier: string): Promise<unknown> {
    const deadlineMs = dependencies.pluginDeadlineMs ?? PLUGIN_DEADLINE_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new PluginDeadlineError(specifier, deadlineMs)), deadlineMs);
    });
    return Promise.race([dependencies.importModule(specifier), deadline]).finally(() => clearTimeout(timer));
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === 'object' && value !== null;

/** A plugin module's `register`: its default export, when that is a function. */
function registerOf(module: unknown): PluginRegister | null {
    const register: unknown = isRecord(module) ? module['default'] : undefined;
    return isPluginRegister(register) ? register : null;
}

function isPluginRegister(value: unknown): value is PluginRegister {
    return typeof value === 'function';
}

function configText(root: HTMLElement): string | null {
    const script = root.querySelector(CONFIG_SELECTOR) ?? root.parentElement?.querySelector(CONFIG_SELECTOR) ?? null;
    return script?.textContent ?? null;
}

function readConfig(root: HTMLElement): PageConfig {
    const text = configText(root);
    if (text === null) {
        throw new Error(`No page configuration (${CONFIG_SELECTOR}) beside the wizard root`);
    }
    const value: unknown = JSON.parse(text);
    return parsePageConfig(value);
}

function showFailure(root: HTMLElement): void {
    const text = root.getAttribute(FAILED_TEXT_ATTRIBUTE);
    if (text !== null && text.trim() !== '') {
        (root.querySelector(LOADING_SELECTOR) ?? root).textContent = text;
    }
}

async function loadPlugins(runtime: WizardRuntime, dependencies: BootDependencies): Promise<void> {
    const plugins = runtime.config.plugins;
    const loaded = await Promise.allSettled(plugins.map((plugin) => importWithin(dependencies, plugin.module)));
    loaded.forEach((result, index) => {
        const plugin = plugins[index];
        if (plugin === undefined) {
            return;
        }
        if (result.status === 'rejected') {
            dependencies.logger.error(`The setup plugin ${plugin.id} (${plugin.module}) could not be loaded`, result.reason);
            return;
        }
        const register = registerOf(result.value);
        if (register === null) {
            dependencies.logger.error(`The setup plugin ${plugin.id} (${plugin.module}) exports no register function`);
            return;
        }
        try {
            applyPlugin(runtime, register);
        } catch (error) {
            dependencies.logger.error(`The setup plugin ${plugin.id} (${plugin.module}) could not register`, error);
        }
    });
}

async function start(root: HTMLElement, dependencies: BootDependencies): Promise<void> {
    let config: PageConfig;
    try {
        config = readConfig(root);
    } catch (error) {
        const where = isContractError(error) ? ` at ${error.path}` : '';
        dependencies.logger.error(`The setup page configuration could not be read${where}`, error);
        showFailure(root);
        return;
    }

    const runtime = createWizardRuntime(config, {
        fetch: dependencies.fetch,
        baseUrl: root.ownerDocument.baseURI,
        navigator: dependencies.navigator,
        logger: dependencies.logger,
    });
    dependencies.builtIns.forEach((register) => applyPlugin(runtime, register));
    await loadPlugins(runtime, dependencies);

    const { placed, unplaced } = runtime.steps.ordered();
    unplaced.forEach((step) => dependencies.logger.error(`The setup step ${step.id} follows ${String(step.after)}, which is not there`));
    if (placed.length === 0) {
        throw new Error('No setup step could be placed');
    }
    const App = dependencies.App;
    // Rendering adds to what the root holds; the server's loading line (and the config, already read) must go.
    root.replaceChildren();
    render(<WizardProvider runtime={runtime}><App /></WizardProvider>, root);
}

const mounted = new WeakSet<HTMLElement>();

/** Mounts the wizard into one root, once. Never rejects: a failure is logged and shown in the root. */
export async function mountWizard(root: HTMLElement, dependencies: BootDependencies): Promise<void> {
    if (mounted.has(root)) {
        return;
    }
    mounted.add(root);
    try {
        await start(root, dependencies);
    } catch (error) {
        dependencies.logger.error('The setup wizard could not start', error);
        showFailure(root);
    }
}

/** Mounts every wizard root of the document, now or once the document has loaded. */
export function startWizard(document: Document, dependencies: BootDependencies): void {
    const mountAll = (): void => {
        document.querySelectorAll<HTMLElement>(ROOT_SELECTOR).forEach((root) => void mountWizard(root, dependencies));
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountAll, { once: true });
    } else {
        mountAll();
    }
}
