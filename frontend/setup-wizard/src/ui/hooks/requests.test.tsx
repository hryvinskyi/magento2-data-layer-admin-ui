/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { act, cleanup, renderHook, waitFor } from '@testing-library/preact';
import {
    ContractError,
    RequestError,
    useLeaveGuard,
    usePreview,
    useProductSearch,
    useSave,
    useSetting,
    useWizard,
    type PreviewRequest,
    type PreviewState,
    type ProductHit,
    type Remote,
    type SaveResponse,
    type ScopeId,
} from '@hryvinskyi/datalayer-setup';
import { recordingGateway, recordingLogger, recordingNavigator, settle } from '../../test/fakes.ts';
import { multiWebsiteConfig } from '../../test/fixtures/page-config.ts';
import { key, scope, stateOf } from '../../test/fixtures/setup-state.ts';
import { createTestRuntime, providerFor } from '../../test/wizard-harness.tsx';

afterEach(cleanup);

const previewOf = (product: number): PreviewRequest => ({
    store: scope('store:1'),
    kind: 'view_item',
    product,
    priceVisible: true,
    settings: { enabled: true },
});

describe('usePreview', () => {
    it('shows only the newest answer when two requests overlap', async () => {
        const gateway = recordingGateway();
        const { result, rerender } = renderHook(
            ({ request }: { request: PreviewRequest }) => usePreview(request, { debounceMs: 0 }),
            { wrapper: providerFor(createTestRuntime(multiWebsiteConfig, { gateway })), initialProps: { request: previewOf(1) } },
        );
        await waitFor(() => assert.equal(gateway.previews.length, 1));
        rerender({ request: previewOf(2) });
        await waitFor(() => assert.equal(gateway.previews.length, 2));
        const [older, newer] = gateway.previews;
        assert.ok(older && newer);
        assert.equal(older.signal.aborted, true, 'a change aborts the request in flight');

        await act(async () => {
            newer.answer.resolve({ status: 'sent', event: { event: 'view_item', product: 2 } });
            await settle();
            older.answer.resolve({ status: 'sent', event: { event: 'view_item', product: 1 } });
            await settle();
        });

        assert.deepEqual(result.current, { status: 'loaded', event: { event: 'view_item', product: 2 } });
    });

    it('waits for the request to settle before asking', async () => {
        const gateway = recordingGateway();
        const { rerender } = renderHook(
            ({ request }: { request: PreviewRequest }) => usePreview(request, { debounceMs: 30 }),
            { wrapper: providerFor(createTestRuntime(multiWebsiteConfig, { gateway })), initialProps: { request: previewOf(1) } },
        );
        rerender({ request: previewOf(2) });
        rerender({ request: previewOf(3) });
        await act(() => new Promise((resolve) => setTimeout(resolve, 60)));

        assert.deepEqual(gateway.previews.map((call) => call.input.product), [3]);
    });

    it('asks nothing without a request, and again only when the request changes', async () => {
        const gateway = recordingGateway();
        const { result, rerender } = renderHook<PreviewState, { request: PreviewRequest | null }>(
            ({ request }) => usePreview(request, { debounceMs: 0 }),
            { wrapper: providerFor(createTestRuntime(multiWebsiteConfig, { gateway })), initialProps: { request: null } },
        );
        await act(settle);
        assert.deepEqual([result.current, gateway.previews.length], [{ status: 'idle' }, 0]);

        rerender({ request: previewOf(1) });
        rerender({ request: previewOf(1) });
        await act(settle);
        assert.equal(gateway.previews.length, 1, 'an equal request is the same request');
    });

    for (const [answer, expected] of [
        [{ status: 'not_sent', reason: 'Switched off.' }, { status: 'not_sent', reason: 'Switched off.' }],
        [{ status: 'unavailable', reason: 'No order yet.' }, { status: 'unavailable', reason: 'No order yet.' }],
    ] as const) {
        it(`passes ${answer.status} through with the server's reason`, async () => {
            const gateway = recordingGateway();
            const { result } = renderHook(() => usePreview(previewOf(1), { debounceMs: 0 }), {
                wrapper: providerFor(createTestRuntime(multiWebsiteConfig, { gateway })),
            });
            await waitFor(() => assert.equal(gateway.previews.length, 1));
            await act(async () => {
                gateway.previews[0]?.answer.resolve(answer);
                await settle();
            });

            assert.deepEqual(result.current, expected);
        });
    }

    it('reports a failed request by kind, and logs only what is not a request failure', async () => {
        const gateway = recordingGateway();
        const logger = recordingLogger();
        const { result, rerender } = renderHook(
            ({ request }: { request: PreviewRequest }) => usePreview(request, { debounceMs: 0 }),
            { wrapper: providerFor(createTestRuntime(multiWebsiteConfig, { gateway, logger })), initialProps: { request: previewOf(1) } },
        );
        await waitFor(() => assert.equal(gateway.previews.length, 1));
        await act(async () => {
            gateway.previews[0]?.answer.reject(new RequestError('expired'));
            await settle();
        });
        assert.deepEqual(result.current, { status: 'failed', failure: { kind: 'expired', serverMessage: null } });
        assert.equal(logger.errors.length, 0);

        rerender({ request: previewOf(2) });
        await waitFor(() => assert.equal(gateway.previews.length, 2));
        await act(async () => {
            gateway.previews[1]?.answer.reject(new ContractError('$.status', 'sent, not_sent or unavailable'));
            await settle();
        });
        assert.deepEqual(result.current, { status: 'failed', failure: { kind: 'server', serverMessage: null } });
        assert.equal(logger.errors.length, 1);
    });

    it('aborts the request in flight when the component unmounts', async () => {
        const gateway = recordingGateway();
        const { unmount } = renderHook(() => usePreview(previewOf(1), { debounceMs: 0 }), {
            wrapper: providerFor(createTestRuntime(multiWebsiteConfig, { gateway })),
        });
        await waitFor(() => assert.equal(gateway.previews.length, 1));
        unmount();

        assert.equal(gateway.previews[0]?.signal.aborted, true);
    });
});

describe('useProductSearch', () => {
    it('asks nothing for a blank query or without a store view, and sends the trimmed query', async () => {
        const gateway = recordingGateway();
        const { result, rerender } = renderHook<Remote<readonly ProductHit[]>, { store: ScopeId | null; query: string }>(
            ({ store, query }) => useProductSearch(store, query, { debounceMs: 0 }),
            { wrapper: providerFor(createTestRuntime(multiWebsiteConfig, { gateway })), initialProps: { store: scope('store:1'), query: '  ' } },
        );
        rerender({ store: null, query: 'shirt' });
        await act(settle);
        assert.equal(gateway.searches.length, 0);

        rerender({ store: scope('store:1'), query: ' shirt ' });
        await waitFor(() => assert.equal(gateway.searches.length, 1));
        assert.deepEqual(gateway.searches[0]?.input, { store: 'store:1', query: 'shirt' });
        await act(async () => {
            gateway.searches[0]?.answer.resolve([{ id: 4, sku: 'MS-01', name: 'Shirt' }]);
            await settle();
        });
        assert.deepEqual(result.current, { status: 'loaded', data: [{ id: 4, sku: 'MS-01', name: 'Shirt' }] });
    });
});

describe('useSave', () => {
    const saved = (response: Partial<SaveResponse> = {}): SaveResponse => ({
        results: [{ scope: scope('default'), key: key('enabled'), status: 'saved' }],
        state: stateOf(multiWebsiteConfig),
        ...response,
    });

    function bindSave(gateway = recordingGateway()) {
        const rendered = renderHook(() => ({ save: useSave(), enabled: useSetting(key('enabled')), wizard: useWizard() }), {
            wrapper: providerFor(createTestRuntime(multiWebsiteConfig, { gateway })),
        });
        return { ...rendered, gateway };
    }

    it('sends one request for a double click', async () => {
        const { result, gateway } = bindSave();
        act(() => result.current.enabled.set(false));
        act(() => {
            result.current.save.save();
            result.current.save.save();
        });
        await act(settle);

        assert.equal(gateway.saves.length, 1);
        assert.deepEqual(result.current.save.status, { status: 'saving' });
        await act(async () => {
            gateway.saves[0]?.answer.resolve(saved());
            await settle();
        });
        assert.deepEqual(result.current.save.status.status, 'saved');
        assert.equal(result.current.wizard.dirty, false);
    });

    it('sends nothing when nothing is pending', async () => {
        const { result, gateway } = bindSave();
        act(() => result.current.save.save());
        await act(settle);

        assert.deepEqual([gateway.saves.length, result.current.save.status], [0, { status: 'idle' }]);
    });

    it('keeps every edit when the request fails, and can be sent again', async () => {
        const { result, gateway } = bindSave();
        act(() => result.current.enabled.set(false));
        act(() => result.current.save.save());
        await act(async () => {
            await settle();
            gateway.saves[0]?.answer.reject(new RequestError('timeout'));
            await settle();
        });

        assert.deepEqual(result.current.save.status, { status: 'failed', reason: { kind: 'request', failure: { kind: 'timeout', serverMessage: null } } });
        assert.equal(result.current.wizard.dirty, true);

        act(() => result.current.save.save());
        await act(settle);
        assert.equal(gateway.saves.length, 2, 'never retried on its own, sent again on request');
    });

    it('aborts the save in flight when the page goes away', async () => {
        const { result, gateway, unmount } = bindSave();
        act(() => result.current.enabled.set(false));
        act(() => result.current.save.save());
        await act(settle);
        unmount();

        assert.equal(gateway.saves[0]?.signal.aborted, true);
    });
});

describe('useLeaveGuard', () => {
    function bindGuard(dirty: boolean, answer: boolean) {
        const navigator = recordingNavigator(answer);
        const rendered = renderHook(({ unsaved }: { unsaved: boolean }) => useLeaveGuard(unsaved), {
            wrapper: providerFor(createTestRuntime(multiWebsiteConfig, { navigator })),
            initialProps: { unsaved: dirty },
        });
        return { ...rendered, navigator };
    }

    const unload = (): Event => {
        const event = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(event);
        return event;
    };

    it('lets the browser ask before unloading only while there are unsaved changes', () => {
        const { rerender } = bindGuard(true, true);
        assert.equal(unload().defaultPrevented, true);

        rerender({ unsaved: false });
        assert.equal(unload().defaultPrevented, false);
    });

    it('asks before an in-app link leaves unsaved changes, and goes only when the person agrees', () => {
        const refused = bindGuard(true, false);
        act(() => refused.result.current.leave('https://admin.test/close/'));
        assert.deepEqual([refused.navigator.asked, refused.navigator.visited], [['leave.confirm'], []]);
        cleanup();

        const agreed = bindGuard(true, true);
        act(() => agreed.result.current.leave('https://admin.test/close/'));
        assert.deepEqual(agreed.navigator.visited, ['https://admin.test/close/']);
        assert.equal(unload().defaultPrevented, false, 'the browser does not ask a second time');
    });

    it('leaves without asking when nothing is unsaved', () => {
        const { result, navigator } = bindGuard(false, false);
        act(() => result.current.leave('https://admin.test/advanced/'));

        assert.deepEqual([navigator.asked, navigator.visited], [[], ['https://admin.test/advanced/']]);
    });
});
