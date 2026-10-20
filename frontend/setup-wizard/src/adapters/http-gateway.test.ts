/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { multiWebsiteConfig } from '../test/fixtures/page-config.ts';
import { scope } from '../test/fixtures/setup-state.ts';
import { ContractError } from './contract.ts';
import { createHttpGateway, READ_DEADLINE_MS, SAVE_DEADLINE_MS } from './http-gateway.ts';
import { createJsonClient, type JsonClient, type JsonRequestOptions } from './json-client.ts';

interface ClientCall {
    readonly method: 'GET' | 'POST';
    readonly url: string;
    readonly body: unknown;
    readonly options: JsonRequestOptions;
}

function recordingClient(answer: unknown): { client: JsonClient; calls: ClientCall[] } {
    const calls: ClientCall[] = [];
    return {
        calls,
        client: {
            get: (url, options) => {
                calls.push({ method: 'GET', url, body: null, options });
                return Promise.resolve(answer);
            },
            post: (url, body, options) => {
                calls.push({ method: 'POST', url, body, options });
                return Promise.resolve(answer);
            },
        },
    };
}

const endpoints = multiWebsiteConfig.endpoints;
const current = (): typeof endpoints => endpoints;
const signal = new AbortController().signal;

describe('HTTP gateway', () => {
    it('saves through the save endpoint with the long deadline, and parses the answer', async () => {
        const { client, calls } = recordingClient({ results: [{ scope: 'default', key: 'enabled', status: 'saved' }], state: multiWebsiteConfig.state });
        const request = { changes: [{ scope: 'default', key: 'enabled', op: 'set', value: true }] } as const;
        const response = await createHttpGateway(current, client).save(request, signal);

        assert.deepEqual(calls.map((call) => [call.method, call.url, call.body, call.options.timeoutMs]), [['POST', endpoints.save, request, SAVE_DEADLINE_MS]]);
        assert.equal(calls[0]?.options.signal, signal);
        assert.deepEqual(response.results, [{ scope: 'default', key: 'enabled', status: 'saved' }]);
        assert.ok(response.state.tree.has(scope('store:3')));
    });

    it('previews through the preview endpoint with the short deadline', async () => {
        const { client, calls } = recordingClient({ status: 'not_sent', reason: 'Tracking is off.' });
        const request = { store: scope('store:1'), kind: 'view_item', product: null, priceVisible: true, settings: {} } as const;

        assert.deepEqual(await createHttpGateway(current, client).preview(request, signal), { status: 'not_sent', reason: 'Tracking is off.' });
        assert.deepEqual(calls.map((call) => [call.method, call.url, call.body, call.options.timeoutMs]), [['POST', endpoints.preview, request, READ_DEADLINE_MS]]);
    });

    it('searches products with the store view and query as URL parameters', async () => {
        const { client, calls } = recordingClient([{ id: 4, sku: 'MS-01', name: 'Shirt' }]);

        assert.deepEqual(await createHttpGateway(current, client).products(scope('store:2'), 'shirt', signal), [{ id: 4, sku: 'MS-01', name: 'Shirt' }]);
        assert.deepEqual(calls.map((call) => [call.method, call.url, call.options.query, call.options.timeoutMs]), [
            ['GET', endpoints.products, { store: 'store:2', q: 'shirt' }, READ_DEADLINE_MS],
        ]);
    });

    it('reads the endpoints for every request, so renewed URLs apply to the next one', async () => {
        const { client, calls } = recordingClient({ status: 'not_sent', reason: 'off' });
        let save = 'https://admin.test/save/key/old/';
        const gateway = createHttpGateway(() => ({ ...endpoints, save, preview: `${save}preview` }), client);
        const request = { store: scope('store:1'), kind: 'view_item', product: null, priceVisible: true, settings: {} } as const;
        await gateway.preview(request, signal);
        save = 'https://admin.test/save/key/new/';
        await gateway.preview(request, signal);

        assert.deepEqual(calls.map((call) => call.url), ['https://admin.test/save/key/old/preview', 'https://admin.test/save/key/new/preview']);
    });

    it('refuses JSON of the wrong shape with a contract error naming the path', async () => {
        const client = createJsonClient({
            formKey: () => 'fk',
            baseUrl: 'https://admin.test/',
            fetch: () => Promise.resolve({ status: 200, redirected: false, text: () => Promise.resolve('{"status":"maybe"}') }),
        });

        await assert.rejects(createHttpGateway(current, client).preview(
            { store: scope('store:1'), kind: 'purchase', product: null, priceVisible: true, settings: {} },
            signal,
        ), (error: unknown) => error instanceof ContractError && error.path === '$.status');
    });
});
