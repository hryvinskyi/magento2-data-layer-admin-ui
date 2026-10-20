/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { RequestError, type PreviewResponse, type ProductHit } from '@hryvinskyi/datalayer-setup';
import type { WirePageConfig, WireSetting } from '../../adapters/contract.ts';
import { settle, type RecordingGateway } from '../../test/fakes.ts';
import { multiWebsiteConfig, singleWebsiteConfig, withState } from '../../test/fixtures/page-config.ts';
import { renderStep } from '../../test/render-wizard.tsx';

afterEach(cleanup);

const choice = (key: string, values: readonly string[], builtIn: string): WireSetting => ({
    key,
    path: `test/products/${key}`,
    kind: 'choice',
    step: 'products',
    label: key,
    options: values.map((value) => ({ value, label: `${key}.${value}` })),
    reach: 'store',
    builtIn,
    values: {},
    locks: {},
});

const flag = (key: string, builtIn: boolean): WireSetting => ({
    key,
    path: `test/products/${key}`,
    kind: 'flag',
    step: 'products',
    label: key,
    options: [],
    reach: 'store',
    builtIn,
    values: {},
    locks: {},
});

/** The fixture plus the order-value settings it does not hold. */
function withOrderSettings(config: WirePageConfig): WirePageConfig {
    return withState(config, {
        settings: [
            ...config.state.settings,
            flag('tax_cart', true),
            choice('purchase_value', ['grand_total', 'subtotal'], 'grand_total'),
            flag('deduct_tax', false),
            flag('include_tax', true),
            flag('include_shipping', true),
            choice('checkout_value', ['items', 'grand'], 'items'),
        ],
    });
}

const FULL = withOrderSettings(multiWebsiteConfig);

const chooseScope = (scope: string): void => {
    fireEvent.change(screen.getByRole('combobox', { name: 'scope.label' }), { target: { value: scope } });
};

/** Waits for the nth preview request and returns it. */
async function previewRequest(gateway: RecordingGateway, index: number): Promise<RecordingGateway['previews'][number]> {
    await waitFor(() => assert.ok(gateway.previews[index], `preview request ${index} was made`));
    const call = gateway.previews[index];
    assert.ok(call);
    return call;
}

async function answerPreview(call: RecordingGateway['previews'][number], answer: PreviewResponse): Promise<void> {
    await act(async () => {
        call.answer.resolve(answer);
        await settle();
    });
}

/** Whether the note holding `text` is drawn as a grey aside. */
const isMutedNote = (text: string): boolean =>
    screen.getByText(text).closest('.hdl-setup-notice')?.classList.contains('hdl-setup-notice--muted') === true;

const HITS: readonly ProductHit[] = [
    { id: 11, sku: 'BP-2040', name: 'Canvas backpack' },
    { id: 12, sku: 'BP-2041', name: 'Leather backpack' },
];

describe('the fields', () => {
    it('shows the cards with every field the page state holds, labelled and optioned by the server', () => {
        renderStep('products', FULL);

        for (const card of ['products.card.items', 'products.card.prices', 'products.card.values', 'products.card.lists']) {
            assert.ok(screen.getByRole('heading', { name: card }), card);
        }
        const itemId = screen.getByRole<HTMLSelectElement>('combobox', { name: 'item_id' });
        assert.deepEqual([...itemId.options].map((option) => [option.value, option.textContent]), [
            ['sku', 'item_id.sku'],
            ['entity_id', 'item_id.entity_id'],
        ]);
        assert.equal(itemId.value, 'sku');
        assert.equal(screen.getByRole('switch', { name: 'tax_catalog' }).getAttribute('aria-checked'), 'true');
        assert.equal(screen.getByRole<HTMLInputElement>('radio', { name: 'purchase_value.grand_total' }).checked, true);
        assert.ok(screen.getByRole('radiogroup', { name: 'checkout_value' }));
        assert.ok(screen.getByText('field.item_id.help'));
    });

    it('leaves out a setting the page state does not hold, and a card left without fields', () => {
        renderStep('products');

        assert.equal(screen.queryByRole('switch', { name: 'tax_cart' }), null);
        assert.equal(screen.queryByRole('radiogroup', { name: 'purchase_value' }), null);
        assert.equal(screen.queryByRole('heading', { name: 'products.card.values' }), null);
        assert.ok(screen.getByRole('switch', { name: 'tax_catalog' }));
    });

    it('offers "deduct tax" only while the purchase value is the grand total', () => {
        renderStep('products', FULL);
        assert.ok(screen.getByRole('switch', { name: 'deduct_tax' }));

        fireEvent.click(screen.getByRole('radio', { name: 'purchase_value.subtotal' }));
        assert.equal(screen.queryByRole('switch', { name: 'deduct_tax' }), null);

        fireEvent.click(screen.getByRole('radio', { name: 'purchase_value.grand_total' }));
        assert.ok(screen.getByRole('switch', { name: 'deduct_tax' }));
    });

    it('edits the draft, and the footer counts the change', () => {
        renderStep('products', FULL);
        fireEvent.change(screen.getByRole('combobox', { name: 'item_id' }), { target: { value: 'entity_id' } });
        fireEvent.click(screen.getByRole('switch', { name: 'tax_catalog' }));

        assert.equal(screen.getByRole<HTMLSelectElement>('combobox', { name: 'item_id' }).value, 'entity_id');
        assert.equal(screen.getByRole('switch', { name: 'tax_catalog' }).getAttribute('aria-checked'), 'false');
        assert.ok(screen.getByText('footer.unsaved.other'));
    });

    it('keeps an inherited value read-only until it is overridden here', () => {
        renderStep('products', FULL);
        chooseScope('store:2');
        const brand = (): HTMLSelectElement => screen.getByRole<HTMLSelectElement>('combobox', { name: 'brand' });
        assert.equal(brand().disabled, true);

        const field = brand().closest<HTMLElement>('.hdl-setup-field');
        assert.ok(field);
        fireEvent.click(within(field).getByRole('button', { name: 'action.override' }));

        assert.equal(brand().disabled, false);
    });

    it('shows a value locked by the deployment as read-only', () => {
        renderStep('products', FULL);
        chooseScope('website:1');

        assert.equal(screen.getByRole<HTMLSelectElement>('combobox', { name: 'hidden_price' }).disabled, true);
    });
});

describe('the preview', () => {
    it('asks for the first store view beneath the scope, with the draft values, and says which', async () => {
        const wizard = renderStep('products', FULL);
        const call = await previewRequest(wizard.gateway, 0);

        assert.equal(call.input.store, 'store:1');
        assert.equal(call.input.kind, 'view_item');
        assert.equal(call.input.product, null);
        assert.equal(call.input.priceVisible, true);
        assert.equal(call.input.settings.enabled, true);
        assert.equal(call.input.settings.container_id, 'GTM-AB12CD3');
        assert.equal(call.input.settings.item_id, 'entity_id', 'the store view\'s own value applies');
        assert.deepEqual(call.input.settings.events, { off: ['refund'], channels: {} });
        assert.ok(screen.getByText('preview.store.under'));
    });

    it('shows a placeholder while the event is built, and the server\'s reason when there is no product yet', async () => {
        const wizard = renderStep('products', FULL);
        const call = await previewRequest(wizard.gateway, 0);

        assert.ok(screen.getByText('preview.loading'));
        await answerPreview(call, { status: 'unavailable', reason: 'Choose a product to preview.' });

        assert.equal(screen.queryByText('preview.loading'), null);
        assert.ok(screen.getByText('Choose a product to preview.'));
        assert.equal(isMutedNote('Choose a product to preview.'), true, 'the reason is a grey aside');
    });

    it('draws the event as text, one line per member, never as markup', async () => {
        const wizard = renderStep('products', FULL);
        const call = await previewRequest(wizard.gateway, 0);
        await answerPreview(call, {
            status: 'sent',
            event: { event: 'view_item', ecommerce: { items: [{ item_name: '<img src=x onerror=alert(1)>', price: 59.9 }] } },
        });

        const region = screen.getByRole('region', { name: 'preview.title.view_item' });
        assert.ok(region.textContent?.includes('"event": "view_item"'));
        assert.ok(region.textContent?.includes('"item_name": "<img src=x onerror=alert(1)>"'));
        assert.equal(region.querySelector('img'), null);
        assert.equal(region.querySelector('[data-token="key"]')?.textContent, '"event"');
        assert.equal(region.querySelector('[data-token="number"]')?.textContent, '59.9');
    });

    it('shows the server\'s reason for an event that is not sent', async () => {
        const wizard = renderStep('products', FULL);
        await answerPreview(await previewRequest(wizard.gateway, 0), {
            status: 'not_sent',
            reason: 'view_item is switched off for this store view.',
        });

        assert.ok(screen.getByText('view_item is switched off for this store view.'));
        assert.equal(isMutedNote('view_item is switched off for this store view.'), true, 'the reason is a grey aside');
        assert.equal(screen.queryByRole('region', { name: 'preview.title.view_item' }), null);
    });

    it('says only that the preview failed, whatever the cause', async () => {
        const wizard = renderStep('products', FULL);
        const call = await previewRequest(wizard.gateway, 0);
        await act(async () => {
            call.answer.reject(new RequestError('server'));
            await settle();
        });

        assert.ok(screen.getByText('preview.failed'));
        assert.equal(isMutedNote('preview.failed'), false, 'a failure is a warning, not an aside');
    });

    it('asks again with the new value when a field changes', async () => {
        const wizard = renderStep('products', FULL);
        await previewRequest(wizard.gateway, 0);
        fireEvent.change(screen.getByRole('combobox', { name: 'brand' }), { target: { value: 'manufacturer' } });

        const second = await previewRequest(wizard.gateway, 1);
        assert.equal(second.input.settings.brand, 'manufacturer');
        assert.equal(wizard.gateway.previews[0]?.signal.aborted, true, 'the earlier request is dropped');
    });

    it('previews the store view itself at a store view, without a line naming a stand-in', async () => {
        const wizard = renderStep('products', FULL);
        chooseScope('store:2');

        await waitFor(() => assert.equal(wizard.gateway.previews.at(-1)?.input.store, 'store:2'));
        assert.equal(screen.queryByText('preview.store.under'), null);
    });

    it('previews the first store view of a website at that website', async () => {
        const wizard = renderStep('products', FULL);
        chooseScope('website:2');

        await waitFor(() => assert.equal(wizard.gateway.previews.at(-1)?.input.store, 'store:3'));
    });

    it('asks for nothing when the scope has no store view beneath it', async () => {
        const bare = withState(singleWebsiteConfig, {
            scopes: singleWebsiteConfig.state.scopes.filter((scope) => scope.type !== 'store'),
        });
        const urls = (all: Readonly<Record<string, string>>): Record<string, string> =>
            Object.fromEntries(Object.entries(all).filter(([scope]) => bare.state.scopes.some((known) => known.id === scope)));
        const wizard = renderStep('products', {
            ...bare,
            endpoints: { ...bare.endpoints, advanced: urls(bare.endpoints.advanced), close: urls(bare.endpoints.close) },
        });
        await act(settle);

        assert.ok(screen.getByText('preview.no_store'));
        assert.equal(wizard.gateway.previews.length, 0);
    });
});

describe('the product search', () => {
    it('searches the previewed store view, lists the matches and previews the one picked', async () => {
        const wizard = renderStep('products', FULL);
        await previewRequest(wizard.gateway, 0);
        fireEvent.input(screen.getByRole('searchbox', { name: 'preview.product' }), { target: { value: 'back' } });

        await waitFor(() => assert.equal(wizard.gateway.searches.length, 1));
        assert.deepEqual(wizard.gateway.searches[0]?.input, { store: 'store:1', query: 'back' });
        await act(async () => {
            wizard.gateway.searches[0]?.answer.resolve(HITS);
            await settle();
        });
        const matches = screen.getAllByRole('button', { name: /backpack/ });
        assert.deepEqual(matches.map((match) => match.textContent), ['Canvas backpackBP-2040', 'Leather backpackBP-2041']);

        const leather = matches[1];
        assert.ok(leather);
        fireEvent.click(leather);

        assert.equal(screen.getByRole<HTMLInputElement>('searchbox', { name: 'preview.product' }).value, 'Leather backpack');
        assert.equal(screen.queryByRole('button', { name: /Canvas backpack/ }), null, 'the list closes');
        const call = await waitFor(() => {
            const latest = wizard.gateway.previews.at(-1);
            assert.equal(latest?.input.product, 12);
            return latest;
        });
        assert.ok(call);
    });

    it('says when nothing matches and when the search failed', async () => {
        const wizard = renderStep('products', FULL);
        const box = screen.getByRole('searchbox', { name: 'preview.product' });
        fireEvent.input(box, { target: { value: 'zzz' } });
        await waitFor(() => assert.equal(wizard.gateway.searches.length, 1));
        assert.ok(screen.getByText('preview.search.loading'));
        await act(async () => {
            wizard.gateway.searches[0]?.answer.resolve([]);
            await settle();
        });
        assert.ok(screen.getByText('preview.search.empty'));

        fireEvent.input(box, { target: { value: 'zzzz' } });
        await waitFor(() => assert.equal(wizard.gateway.searches.length, 2));
        await act(async () => {
            wizard.gateway.searches[1]?.answer.reject(new RequestError('network'));
            await settle();
        });
        assert.ok(screen.getByText('preview.search.failed'));
    });

    it('forgets the product when the box is edited again', async () => {
        const wizard = renderStep('products', FULL);
        const box = screen.getByRole('searchbox', { name: 'preview.product' });
        fireEvent.input(box, { target: { value: 'back' } });
        await waitFor(() => assert.equal(wizard.gateway.searches.length, 1));
        await act(async () => {
            wizard.gateway.searches[0]?.answer.resolve(HITS);
            await settle();
        });
        fireEvent.click(screen.getByRole('button', { name: /Canvas backpack/ }));
        await waitFor(() => assert.equal(wizard.gateway.previews.at(-1)?.input.product, 11));

        fireEvent.input(box, { target: { value: 'Canvas' } });

        await waitFor(() => assert.equal(wizard.gateway.previews.at(-1)?.input.product, null));
    });

    it('forgets the product when the preview moves to another store view, whose catalogue it was not found in', async () => {
        const wizard = renderStep('products', FULL);
        fireEvent.input(screen.getByRole('searchbox', { name: 'preview.product' }), { target: { value: 'back' } });
        await waitFor(() => assert.equal(wizard.gateway.searches.length, 1));
        await act(async () => {
            wizard.gateway.searches[0]?.answer.resolve(HITS);
            await settle();
        });
        fireEvent.click(screen.getByRole('button', { name: /Canvas backpack/ }));
        await waitFor(() => assert.equal(wizard.gateway.previews.at(-1)?.input.product, 11));

        chooseScope('store:2');

        await waitFor(() => {
            const latest = wizard.gateway.previews.at(-1)?.input;
            assert.equal(latest?.store, 'store:2');
            assert.equal(latest?.product, null);
        });
        assert.equal(screen.getByRole<HTMLInputElement>('searchbox', { name: 'preview.product' }).value, '');

        chooseScope('website:1');
        await waitFor(() => assert.equal(wizard.gateway.previews.at(-1)?.input.store, 'store:1'));
        assert.equal(wizard.gateway.previews.at(-1)?.input.product, null, 'nor is it remembered for the first store view');
    });
});

describe('the visitor and the event', () => {
    it('previews a visitor who may not see prices when asked', async () => {
        const wizard = renderStep('products', FULL);
        await previewRequest(wizard.gateway, 0);
        const visible = screen.getByRole('radio', { name: 'preview.viewer.visible' });
        assert.equal(visible.getAttribute('aria-checked'), 'true');

        fireEvent.click(screen.getByRole('radio', { name: 'preview.viewer.hidden' }));

        await waitFor(() => assert.equal(wizard.gateway.previews.at(-1)?.input.priceVisible, false));
        assert.equal(screen.getByRole('radio', { name: 'preview.viewer.hidden' }).getAttribute('aria-checked'), 'true');
    });

    it('moves the viewer choice with the arrow keys, keeping only the chosen button in the tab order', async () => {
        const wizard = renderStep('products', FULL);
        await previewRequest(wizard.gateway, 0);
        const visible = screen.getByRole('radio', { name: 'preview.viewer.visible' });
        const hidden = screen.getByRole('radio', { name: 'preview.viewer.hidden' });
        assert.deepEqual([visible.tabIndex, hidden.tabIndex], [0, -1]);

        fireEvent.keyDown(visible, { key: 'ArrowRight' });

        assert.equal(hidden.getAttribute('aria-checked'), 'true');
        assert.deepEqual([visible.tabIndex, hidden.tabIndex], [-1, 0]);
    });

    it('previews the latest order on the purchase tab, with no product search and no visitor choice', async () => {
        const wizard = renderStep('products', FULL);
        await previewRequest(wizard.gateway, 0);
        fireEvent.click(screen.getByRole('radio', { name: 'preview.viewer.hidden' }));
        await waitFor(() => assert.equal(wizard.gateway.previews.at(-1)?.input.priceVisible, false));

        fireEvent.click(screen.getByRole('tab', { name: 'preview.tab.purchase' }));

        await waitFor(() => assert.equal(wizard.gateway.previews.at(-1)?.input.kind, 'purchase'));
        const request = wizard.gateway.previews.at(-1)?.input;
        assert.equal(request?.product, null);
        assert.equal(request?.priceVisible, true, 'order lines are never price-hidden');
        assert.equal(screen.queryByRole('searchbox'), null);
        assert.equal(screen.queryByRole('radiogroup', { name: 'preview.viewer' }), null);
        assert.ok(screen.getByText('preview.order.latest'));
        assert.equal(screen.getByRole('heading', { name: 'preview.title.purchase' }).tagName, 'H3');
    });

    it('switches tabs with the arrow keys and names the panel by the chosen tab', async () => {
        const wizard = renderStep('products', FULL);
        await previewRequest(wizard.gateway, 0);
        const productTab = screen.getByRole('tab', { name: 'preview.tab.view_item' });
        assert.equal(productTab.getAttribute('aria-selected'), 'true');
        assert.equal(screen.getByRole('tabpanel').getAttribute('aria-labelledby'), productTab.id);

        fireEvent.keyDown(productTab, { key: 'ArrowRight' });

        const purchaseTab = screen.getByRole('tab', { name: 'preview.tab.purchase' });
        assert.equal(purchaseTab.getAttribute('aria-selected'), 'true');
        assert.equal(screen.getByRole('tabpanel').getAttribute('aria-labelledby'), purchaseTab.id);
    });
});

describe('the step\'s scope', () => {
    it('shows no setting of another step', () => {
        renderStep('products', FULL);

        for (const key of ['enabled', 'container_id', 'measurement_id']) {
            assert.equal(screen.queryByLabelText(key), null, key);
        }
    });
});
