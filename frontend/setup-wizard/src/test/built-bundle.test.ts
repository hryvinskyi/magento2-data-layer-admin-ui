/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The built files, run as the page runs them. The sources are built into a temporary directory; a resolve hook
 * plays the page's import map, sending the bare specifiers (`preact`, `preact/hooks`, `preact/jsx-runtime`, the SDK
 * and a step plugin) to the built files; then wizard.js starts on a page holding a page configuration that names a
 * plugin. The plugin is plain JavaScript importing the SDK the way a separately built plugin does.
 *
 * The plugin's step reads its setting through the SDK's `useSetting()`. That only works when wizard.js and the
 * plugin share one SDK, and so one context: a second copy anywhere would leave the plugin's hook without a provider.
 * Tests of the sources cannot see that, because there every import resolves to the same file.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, before, it, mock } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { waitFor } from '@testing-library/preact';
import { multiWebsiteConfig } from './fixtures/page-config.ts';

const PACKAGE = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PLUGIN = '@test/sample-step';

/** A step plugin as its own build would emit it: bare imports only. */
const PLUGIN_SOURCE = `
import { jsx } from 'preact/jsx-runtime';
import { requireSettingKey, requireStepId, useSetting } from '@hryvinskyi/datalayer-setup';

function SampleStep() {
    const days = useSetting(requireSettingKey('sample_days'));
    return jsx('p', { 'data-testid': 'sample-days', children: String(days.value) });
}

export default function register(sdk) {
    sdk.registerStep({ id: requireStepId('sample'), icon: 'tune', title: 'step.sample.title', component: SampleStep });
}
`;

let built = '';

before(async () => {
    // The real path: module URLs name it, and a temporary directory is often reached through a symbolic link.
    built = await realpath(await mkdtemp(join(tmpdir(), 'datalayer-setup-built-')));
    execFileSync(process.execPath, [join(PACKAGE, 'scripts/build.mjs'), '--out', built], { stdio: 'pipe' });
    await writeFile(join(built, 'sample-step.js'), PLUGIN_SOURCE);
    // The browser runs every file as an ES module; so does Node, once the directory says so.
    await writeFile(join(built, 'package.json'), '{"type":"module"}');

    const importMap: Readonly<Record<string, string>> = {
        preact: pathToFileURL(join(built, 'vendor/preact.js')).href,
        'preact/hooks': pathToFileURL(join(built, 'vendor/preact-hooks.js')).href,
        'preact/jsx-runtime': pathToFileURL(join(built, 'vendor/preact-jsx-runtime.js')).href,
        '@hryvinskyi/datalayer-setup': pathToFileURL(join(built, 'sdk.js')).href,
        [PLUGIN]: pathToFileURL(join(built, 'sample-step.js')).href,
    };
    const builtUrl = pathToFileURL(built).href;
    registerHooks({
        resolve: (specifier, context, nextResolve) => {
            const url = importMap[specifier];
            return url !== undefined && context.parentURL?.startsWith(builtUrl) === true
                ? { url, shortCircuit: true, format: 'module' }
                : nextResolve(specifier, context);
        },
    });
});

after(async () => {
    await rm(built, { recursive: true, force: true });
});

it('renders a plugin step reading the value the shell provides, from the built files', async () => {
    const logged = mock.method(console, 'error', () => undefined);
    const config = {
        ...multiWebsiteConfig,
        initialScope: 'website:2',
        plugins: [{ id: 'sample', module: PLUGIN }],
        phrases: { ...multiWebsiteConfig.phrases, 'step.sample.title': 'step.sample.title' },
    };
    const root = document.createElement('div');
    root.setAttribute('data-role', 'hdl-setup');
    const script = document.createElement('script');
    script.type = 'application/json';
    script.setAttribute('data-role', 'hdl-setup-config');
    script.textContent = JSON.stringify(config);
    root.append(script);
    document.body.append(root);

    await import(pathToFileURL(join(built, 'wizard.js')).href);

    // The shell's own steps come first; the plugin's step is opened from the stepper, as a person would.
    const stepButton = await waitFor(() => {
        const button = [...root.querySelectorAll('nav button')].find((item) => item.textContent?.includes('step.sample.title'));
        assert.ok(button instanceof HTMLElement, 'the stepper lists the plugin step');
        return button;
    });
    stepButton.click();

    await waitFor(() => assert.equal(root.querySelector('[data-testid="sample-days"]')?.textContent, '30'));
    assert.equal(root.querySelector('h2')?.textContent, 'step.sample.title');
    assert.deepEqual(logged.mock.calls.map((call) => call.arguments.map(String).join(' ')), []);
});
