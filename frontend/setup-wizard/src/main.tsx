/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The wizard's entry point (built into wizard.js): wires the browser — fetch, the window, the console as the log —
 * and starts the wizard on the page. The only module that does anything when imported.
 */
import { createBrowserNavigator, type Logger } from '@hryvinskyi/datalayer-setup';
import { startWizard } from './boot.tsx';
import { App } from './ui/App.tsx';
import { registerBuiltInSteps } from './ui/steps/index.ts';

const logger: Logger = {
    error: (message: string, detail?: unknown): void => console.error(message, detail),
};

startWizard(document, {
    App,
    builtIns: [registerBuiltInSteps],
    importModule: (specifier: string): Promise<unknown> => import(specifier),
    fetch: (url: string, init: RequestInit): Promise<Response> => fetch(url, init),
    navigator: createBrowserNavigator(window),
    logger,
});
