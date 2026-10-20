/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The preview card beside the product settings: the event a store view would push with the values as they stand
 * now, saved or not. A product page event is previewed for a product found by search and for a visitor who may or
 * may not see prices; a purchase event is previewed from the store view's latest order, which no visitor choice
 * changes.
 *
 * The server builds events for a store view, so at the default scope or a website the first store view beneath it
 * stands in, and a line says which. A product is found in one store view's catalogue, so a product chosen for one
 * store view is forgotten when the preview moves to another.
 */
import { useMemo, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import {
    Icon,
    Notice,
    Panel,
    previewRequestOf,
    previewStoreOf,
    usePreview,
    useT,
    useWizard,
    viewOf,
    type PreviewKind,
    type PreviewState,
    type ScopeId,
} from '@hryvinskyi/datalayer-setup';
import { ChoiceGroup, type ChoiceOption } from './ChoiceGroup.tsx';
import { PreviewOutput } from './PreviewOutput.tsx';
import { ProductSearch, type ProductChoice } from './ProductSearch.tsx';

const KINDS: readonly PreviewKind[] = ['view_item', 'purchase'];

type Viewer = 'visible' | 'hidden';

const PANEL_ID = 'hdl-setup-preview-panel';
const tabId = (kind: PreviewKind): string => `hdl-setup-preview-tab-${kind}`;

const NO_PRODUCT: ProductChoice = { text: '', product: null };

/** A product choice and the store view whose catalogue it was found in. */
interface StoreChoice {
    readonly store: ScopeId | null;
    readonly choice: ProductChoice;
}

/** An idle preview that was asked for is about to load: it shows the placeholder rather than a gap. */
const settled = (state: PreviewState, requested: boolean): PreviewState =>
    (state.status === 'idle' && requested ? { status: 'loading' } : state);

export function EventPreview(): JSX.Element {
    const { t } = useT();
    const { state, view } = useWizard();
    const storeId = previewStoreOf(view.tree, view.scope.id);
    const [kind, setKind] = useState<PreviewKind>('view_item');
    const [picked, setPicked] = useState<StoreChoice>({ store: storeId, choice: NO_PRODUCT });
    const [viewer, setViewer] = useState<Viewer>('visible');

    // Another store view: the choice belonged to the previous one's catalogue, so it is dropped for good.
    if (picked.store !== storeId) {
        setPicked({ store: storeId, choice: NO_PRODUCT });
    }
    const choice = picked.store === storeId ? picked.choice : NO_PRODUCT;
    const setChoice = (next: ProductChoice): void => setPicked({ store: storeId, choice: next });
    const storeName = storeId === null ? '' : view.tree.get(storeId).name;
    const storeView = useMemo(() => (storeId === null ? null : viewOf(state.draft, storeId)), [state.draft, storeId]);
    const productPage = kind === 'view_item';
    const request = useMemo(
        () => (storeView === null
            ? null
            : previewRequestOf(storeView, {
                kind,
                product: productPage ? (choice.product?.id ?? null) : null,
                priceVisible: !productPage || viewer === 'visible',
            })),
        [storeView, kind, productPage, choice.product, viewer],
    );
    const preview = usePreview(request);

    const tabs: readonly ChoiceOption<PreviewKind>[] = KINDS.map((value) => ({
        value,
        label: t(`preview.tab.${value}`),
        id: tabId(value),
    }));
    const viewers: readonly ChoiceOption<Viewer>[] = [
        { value: 'visible', label: t('preview.viewer.visible'), icon: 'person' },
        { value: 'hidden', label: t('preview.viewer.hidden'), icon: 'person_off' },
    ];

    return (
        <div class="hdl-setup-preview">
            <Panel title={t(`preview.title.${kind}`)} icon="data_object">
                <ChoiceGroup semantics="tabs" label={t('preview.tabs')} options={tabs} value={kind} onChange={setKind} controls={storeId === null ? undefined : PANEL_ID} />
                {storeId === null ? <Notice tone="info">{t('preview.no_store')}</Notice> : (
                    <>
                        {productPage && storeId !== view.scope.id ? (
                            <p class="hdl-setup-preview__line">
                                <Icon name="storefront" size={16} />
                                <span>{t('preview.store.under', storeName)}</span>
                            </p>
                        ) : null}
                        {productPage ? null : (
                            <p class="hdl-setup-preview__line">
                                <Icon name="receipt_long" size={16} />
                                <span>{t('preview.order.latest', storeName)}</span>
                            </p>
                        )}
                        {productPage ? <ProductSearch store={storeId} choice={choice} onChange={setChoice} /> : null}
                        {productPage ? (
                            <ChoiceGroup semantics="radios" label={t('preview.viewer')} options={viewers} value={viewer} onChange={setViewer} />
                        ) : null}
                        <div role="tabpanel" id={PANEL_ID} aria-labelledby={tabId(kind)}>
                            <PreviewOutput state={settled(preview, request !== null)} label={t(`preview.title.${kind}`)} />
                        </div>
                    </>
                )}
            </Panel>
        </div>
    );
}
