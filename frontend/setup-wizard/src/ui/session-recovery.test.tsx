/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Recovering from an ended admin session, through the real JSON client and HTTP gateway over a fake network: the
 * save is refused as expired, the person signs in again elsewhere and retries, the page renews its form key and
 * URLs and sends the save again with them.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import {
    applyPlugin,
    createWizardRuntime,
    parsePageConfig,
    requireStepId,
    WizardProvider,
    type HttpResponse,
} from '@hryvinskyi/datalayer-setup';
import { recordingLogger, recordingNavigator, settle } from '../test/fakes.ts';
import { multiWebsiteConfig } from '../test/fixtures/page-config.ts';
import { App } from './App.tsx';
import { registerBuiltInSteps } from './steps/index.ts';

/**
 * Ends what the page left running: every request starts a deadline timer in the DOM's own timer queue, which would
 * keep the test process waiting long after the test.
 */
async function stopTimers(): Promise<void> {
    const page: unknown = Reflect.get(globalThis, 'happyDOM');
    const abort: unknown = typeof page === 'object' && page !== null ? Reflect.get(page, 'abort') : undefined;
    if (typeof abort === 'function') {
        await Promise.resolve(abort.call(page));
    }
}

afterEach(async () => {
    cleanup();
    await stopTimers();
});

interface FetchCall {
    readonly url: URL;
    readonly init: RequestInit;
    answer(status: number, body: unknown): void;
}

function recordingFetch(): { readonly calls: FetchCall[]; fetch(url: string, init: RequestInit): Promise<HttpResponse> } {
    const calls: FetchCall[] = [];
    return {
        calls,
        fetch: (url, init) => new Promise((resolve) => {
            calls.push({
                url: new URL(url),
                init,
                answer: (status, body) => resolve({ status, redirected: false, text: () => Promise.resolve(JSON.stringify(body)) }),
            });
        }),
    };
}

const RENEWED = {
    formKey: 'renewed-key',
    endpoints: {
        save: 'https://admin.test/save/key/renewed/',
        preview: 'https://admin.test/preview/key/renewed/',
        products: 'https://admin.test/products/key/renewed/',
    },
    links: {
        advanced: { default: 'https://admin.test/advanced/key/renewed/' },
        close: { default: 'https://admin.test/close/key/renewed/' },
    },
};

const EXPIRED = { ajaxExpired: 1, ajaxRedirect: 'https://admin.test/admin/' };

function mount(): { readonly network: ReturnType<typeof recordingFetch>; readonly navigator: ReturnType<typeof recordingNavigator> } {
    const network = recordingFetch();
    const navigator = recordingNavigator();
    const runtime = createWizardRuntime(parsePageConfig(multiWebsiteConfig), {
        fetch: network.fetch,
        baseUrl: 'https://admin.test/',
        navigator,
        logger: recordingLogger(),
        onMissingPhrase: (key: string): void => {
            throw new Error(`Missing phrase: ${key}`);
        },
    });
    applyPlugin(runtime, registerBuiltInSteps);
    render(<WizardProvider runtime={runtime} initialStep={requireStepId('connect')}><App /></WizardProvider>);
    return { network, navigator };
}

/** Changes the container ID, goes to the review and clicks Save all: the first request on the network. */
function editAndSave(network: ReturnType<typeof recordingFetch>): FetchCall {
    fireEvent.input(screen.getByLabelText('container_id'), { target: { value: 'GTM-RETRY1' } });
    fireEvent.click(within(screen.getByRole('navigation', { name: 'stepper.label' })).getByRole('button', { name: /step\.review\.title/ }));
    fireEvent.click(screen.getByRole('button', { name: 'action.save_all' }));
    const call = network.calls.at(-1);
    assert.ok(call !== undefined, 'the save went out');
    return call;
}

async function answer(call: FetchCall | undefined, status: number, body: unknown): Promise<void> {
    assert.ok(call !== undefined, 'a request is waiting for its answer');
    await act(async () => {
        call.answer(status, body);
        await settle();
        await settle();
    });
}

describe('an ended admin session', () => {
    it('is renewed once the person signed in again, and the save is sent again with the new form key', async () => {
        const { network, navigator } = mount();
        const first = editAndSave(network);
        assert.equal(first.url.searchParams.get('form_key'), 'form-key-fixture');
        await answer(first, 200, EXPIRED);

        const strip = screen.getByRole('alert');
        assert.equal(strip.querySelector('.hdl-setup-strip__text')?.textContent, 'request.expired');
        fireEvent.click(within(strip).getByRole('button', { name: 'action.retry' }));

        const renewal = network.calls[1];
        assert.equal(renewal?.url.pathname, '/hryvinskyi_datalayer/setup/session/');
        assert.equal(renewal?.init.method, 'GET');
        await answer(renewal, 200, RENEWED);

        const retried = network.calls[2];
        assert.ok(retried !== undefined, 'the save went out again');
        assert.equal(`${retried.url.origin}${retried.url.pathname}`, 'https://admin.test/save/key/renewed/');
        assert.equal(retried.url.searchParams.get('form_key'), 'renewed-key');
        assert.deepEqual(JSON.parse(String(retried.init.body)), {
            changes: [{ scope: 'default', key: 'container_id', op: 'set', value: 'GTM-RETRY1' }],
        });
        await answer(retried, 200, {
            results: [{ scope: 'default', key: 'container_id', status: 'saved' }],
            state: multiWebsiteConfig.state,
        });
        assert.equal(screen.queryByText('request.expired') === null, true);
        assert.ok(screen.getByText('footer.all_saved'));

        fireEvent.click(screen.getByRole('button', { name: 'action.close' }));
        assert.deepEqual(navigator.visited, ['https://admin.test/close/key/renewed/'], 'the links are the renewed ones');
    });

    it('keeps the message and every edit while the session is still not valid', async () => {
        const { network } = mount();
        await answer(editAndSave(network), 200, EXPIRED);

        fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'action.retry' }));
        await answer(network.calls[1], 200, EXPIRED);

        assert.equal(network.calls.length, 2, 'nothing is saved with a session that is still not valid');
        assert.equal(screen.getByRole('alert').querySelector('.hdl-setup-strip__text')?.textContent, 'request.expired');
        assert.ok(within(screen.getByRole('alert')).getByRole('button', { name: 'action.retry' }), 'it can be tried again');
        assert.ok(screen.getByText('footer.unsaved.one'), 'the edit is kept');
    });
});
