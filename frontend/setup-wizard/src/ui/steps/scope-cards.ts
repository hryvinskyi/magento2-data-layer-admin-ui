/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * What the scope step shows for each scope: whether tracking is on there, which container it loads, and which
 * settings it overrides, all as the draft stands. A pure read of the draft, so the cards update as edits are made
 * in other steps.
 */
import {
    CONTAINER_ID,
    DEFAULT_SCOPE,
    ENABLED,
    flagOf,
    textOf,
    viewOf,
    type Draft,
    type Scope,
    type ScopeId,
} from '@hryvinskyi/datalayer-setup';

export interface ScopeCard {
    readonly scope: Scope;
    /** Whether sending is on at this scope. */
    readonly tracking: boolean;
    /** The container ID that applies here; empty when none does. */
    readonly container: string;
    /** The labels of the settings this scope sets itself (never for the default scope, which sets everything). */
    readonly overrides: readonly string[];
}

export interface WebsiteCard extends ScopeCard {
    readonly views: readonly ScopeCard[];
}

export interface ScopeCards {
    readonly root: ScopeCard;
    readonly websites: readonly WebsiteCard[];
    /** One website with one store view: nothing to choose between. */
    readonly singleWebsite: boolean;
}

/**
 * @param eventsLabel the translated name of the events setting, which has no definition of its own
 * @throws UnknownScopeError
 */
function cardOf(draft: Draft, id: ScopeId, eventsLabel: string): ScopeCard {
    const view = viewOf(draft, id);
    const own = id === DEFAULT_SCOPE
        ? []
        : [
            ...view.definitions().filter((definition) => view.isOwn(definition.key)).map((definition) => definition.label),
            ...(view.isEventsOwn() ? [eventsLabel] : []),
        ];
    return {
        scope: view.scope,
        tracking: flagOf(view.value(ENABLED)),
        container: textOf(view.value(CONTAINER_ID)).trim(),
        overrides: own,
    };
}

/** @throws UnknownScopeError */
export function scopeCards(draft: Draft, eventsLabel: string): ScopeCards {
    const tree = draft.state.tree;
    const websites = tree.childrenOf(DEFAULT_SCOPE).map((website): WebsiteCard => ({
        ...cardOf(draft, website, eventsLabel),
        views: tree.childrenOf(website).map((view) => cardOf(draft, view, eventsLabel)),
    }));
    const only = websites[0];
    return {
        root: cardOf(draft, DEFAULT_SCOPE, eventsLabel),
        websites,
        singleWebsite: websites.length === 1 && only !== undefined && only.views.length === 1,
    };
}
