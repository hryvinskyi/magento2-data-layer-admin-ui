/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Finding the product to preview: a search box over the store view's catalogue and the matches to pick from.
 * Choosing a match fills the box with its name and closes the list; typing again forgets the choice.
 */
import type { JSX } from 'preact';
import {
    Icon,
    TextInput,
    useProductSearch,
    useT,
    type ProductHit,
    type Remote,
    type ScopeId,
} from '@hryvinskyi/datalayer-setup';

export interface ProductChoice {
    /** What the box shows. */
    readonly text: string;
    readonly product: ProductHit | null;
}

export interface ProductSearchProps {
    readonly store: ScopeId | null;
    readonly choice: ProductChoice;
    readonly onChange: (choice: ProductChoice) => void;
}

const SEARCH_ID = 'hdl-setup-preview-search';

/** What the matches area says, or lists, for the search in its current state. */
function Matches({ search, onPick }: { readonly search: Remote<readonly ProductHit[]>; readonly onPick: (hit: ProductHit) => void }): JSX.Element {
    const { t } = useT();
    if (search.status === 'failed') {
        return <p class="hdl-setup-preview__line" role="status">{t('preview.search.failed')}</p>;
    }
    if (search.status !== 'loaded') {
        return <p class="hdl-setup-preview__line" role="status">{t('preview.search.loading')}</p>;
    }
    if (search.data.length === 0) {
        return <p class="hdl-setup-preview__line" role="status">{t('preview.search.empty')}</p>;
    }
    return (
        <ul class="hdl-setup-search-results">
            {search.data.map((hit) => (
                <li key={hit.id}>
                    <button type="button" class="hdl-setup-search-result" onClick={() => onPick(hit)}>
                        <span>{hit.name}</span>
                        <span class="hdl-setup-search-result__sku">{hit.sku}</span>
                    </button>
                </li>
            ))}
        </ul>
    );
}

export function ProductSearch({ store, choice, onChange }: ProductSearchProps): JSX.Element {
    const { t } = useT();
    const searching = choice.product === null && choice.text.trim() !== '';
    const search = useProductSearch(store, searching ? choice.text : '');

    return (
        <>
            <div class="hdl-setup-search">
                <Icon name="search" size={18} class="hdl-setup-search__icon" />
                <TextInput
                    id={SEARCH_ID}
                    type="search"
                    width="full"
                    label={t('preview.product')}
                    placeholder={t('preview.search')}
                    value={choice.text}
                    onInput={(text) => onChange({ text, product: null })}
                />
            </div>
            {searching ? <Matches search={search} onPick={(hit) => onChange({ text: hit.name, product: hit })} /> : null}
        </>
    );
}
