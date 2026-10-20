/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The scope being edited: a select over the scope tree (default, each website, its store views indented under it)
 * and a line saying what the scope's values apply to. Changing it keeps every edit and forgets which fields were
 * touched, as each scope shows its own problems. While a save is in flight the scope cannot change.
 */
import type { JSX } from 'preact';
import type { Scope, ScopeType } from '../../domain/scope.ts';
import type { Translator } from '../i18n/translator.ts';
import { useT } from '../hooks/use-runtime.ts';
import { useScope } from '../hooks/use-setting.ts';
import { useEditLock } from '../hooks/use-wizard.ts';
import { Icon } from './icons.tsx';
import { SelectInput } from './SelectInput.tsx';

/** Non-breaking spaces that indent a store view under its website; a select cannot be styled per option. */
const INDENT = '    ';

/** A scope as the select lists it. */
const OPTION_LABEL = {
    default: (_scope, translator) => translator.t('scope.default'),
    website: (scope, translator) => translator.t('scope.website', scope.name),
    store: (scope, translator) => INDENT + translator.t('scope.store', scope.name),
} as const satisfies Record<ScopeType, (scope: Scope, translator: Translator) => string>;

/** What a scope's values apply to. */
const APPLIES = {
    default: (_scope, translator) => translator.t('scope.default.applies'),
    website: (scope, translator) => translator.t('scope.website.applies', scope.name),
    store: (scope, translator) => translator.t('scope.store.applies', scope.name),
} as const satisfies Record<ScopeType, (scope: Scope, translator: Translator) => string>;

export interface ScopeBarProps {
    readonly id?: string | undefined;
}

export function ScopeBar({ id = 'hdl-setup-scope' }: ScopeBarProps): JSX.Element {
    const translator = useT();
    const { scope, tree, select } = useScope();
    const locked = useEditLock();
    const options = tree.scopes.map((item) => ({ value: item.id, label: OPTION_LABEL[item.type](item, translator) }));
    return (
        <div class="hdl-setup-scopebar">
            <label for={id} class="hdl-setup-scopebar__label">
                <Icon name="language" size={18} />
                {translator.t('scope.label')}
            </label>
            <SelectInput
                id={id}
                value={scope.id}
                options={options}
                width="auto"
                strong
                disabled={locked}
                onChange={(value) => {
                    const next = tree.scopes.find((item) => item.id === value);
                    if (next !== undefined) {
                        select(next.id);
                    }
                }}
            />
            <span class="hdl-setup-scopebar__line">{APPLIES[scope.type](scope, translator)}</span>
        </div>
    );
}
