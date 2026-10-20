/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The "Scope" step: which scope the wizard edits. The default scope is a full-width card; each website is a card
 * with its store views nested beneath it. A card shows whether tracking is on there, the container it loads and
 * one badge per setting it overrides, or that it takes everything from above. Picking a card is the same act as
 * choosing the scope in the scope bar. A shop with one website and one store view has nothing to choose, and the
 * step says so and offers to move on.
 */
import type { JSX } from 'preact';
import { useMemo } from 'preact/hooks';
import {
    Badge,
    Icon,
    MessageStrip,
    useScope,
    useStepNavigation,
    useT,
    useWizard,
    type IconName,
    type ScopeId,
    type ScopeType,
    type StepBehaviour,
    type Translator,
} from '@hryvinskyi/datalayer-setup';
import { scopeCards, type ScopeCard, type WebsiteCard } from './scope-cards.ts';

const RADIO_NAME = 'hdl-setup-scope-choice';

const SCOPE_ICON = {
    default: 'public',
    website: 'storefront',
    store: 'translate',
} as const satisfies Record<ScopeType, IconName>;

/** The phrase naming a scope in the stepper's summary: its kind and, below the default scope, its name. */
const SCOPE_SUMMARY = {
    default: 'scope.default',
    website: 'scope.website',
    store: 'scope.store',
} as const satisfies Record<ScopeType, string>;

interface CardProps {
    readonly card: ScopeCard;
    readonly selected: boolean;
    readonly onSelect: (scope: ScopeId) => void;
}

/** One badge per setting the scope sets itself. */
const overrideBadges = (card: ScopeCard): JSX.Element[] =>
    card.overrides.map((label) => <Badge key={label} variant="override" icon="edit">{label}</Badge>);

/** The line under a website's name: its domain, when it has one, and how many store views it holds. */
function websiteSubtitle(website: WebsiteCard, translator: Translator): string {
    const count = website.views.length;
    const domain = website.scope.domain;
    return domain === undefined
        ? translator.tn('scope.website.views', count)
        : translator.tn('scope.website.sub', count, domain);
}

function StoreViewRow({ card, selected, onSelect, parent }: CardProps & { readonly parent: string }): JSX.Element {
    const { t } = useT();
    return (
        <label class="hdl-setup-scope-view" data-selected={selected ? 'true' : 'false'}>
            <Icon name="subdirectory_arrow_right" size={18} class="hdl-setup-scope-view__arrow" />
            <span class="hdl-setup-scope-view__name">{card.scope.name}</span>
            <span class="hdl-setup-scope-view__kind">{t('scope.store.kind')}</span>
            {card.overrides.length === 0
                ? <span class="hdl-setup-scope-view__inherit">{t('scope.inherits_from', parent)}</span>
                : overrideBadges(card)}
            <input
                type="radio"
                class="hdl-setup-scope-view__radio"
                name={RADIO_NAME}
                value={card.scope.id}
                checked={selected}
                aria-label={card.scope.name}
                onChange={() => onSelect(card.scope.id)}
            />
        </label>
    );
}

interface ScopeCardViewProps extends CardProps {
    /** Translated: where the scope applies. */
    readonly subtitle: string;
    /** Translated; shown when the scope sets nothing itself. Left out for the default scope, which sets everything. */
    readonly inheritNote?: string;
    readonly wide?: boolean;
    readonly children?: JSX.Element[];
}

function ScopeCardView({ card, selected, onSelect, subtitle, inheritNote, wide = false, children }: ScopeCardViewProps): JSX.Element {
    const { t } = useT();
    return (
        <div class={wide ? 'hdl-setup-scope-card hdl-setup-scope-card--wide' : 'hdl-setup-scope-card'} data-selected={selected ? 'true' : 'false'}>
            <label class="hdl-setup-scope-card__main">
                <span class="hdl-setup-scope-card__tile"><Icon name={SCOPE_ICON[card.scope.type]} size={22} /></span>
                <span class="hdl-setup-scope-card__body">
                    <span class="hdl-setup-scope-card__name-row">
                        <span class="hdl-setup-scope-card__name">{card.scope.name}</span>
                        <input
                            type="radio"
                            class="hdl-setup-scope-card__radio"
                            name={RADIO_NAME}
                            value={card.scope.id}
                            checked={selected}
                            aria-label={card.scope.name}
                            onChange={() => onSelect(card.scope.id)}
                        />
                    </span>
                    <span class="hdl-setup-scope-card__sub">{subtitle}</span>
                    <span class="hdl-setup-scope-card__badges">
                        <Badge variant={card.tracking ? 'on' : 'off'}>
                            {card.tracking ? t('scope.tracking.on') : t('scope.tracking.off')}
                        </Badge>
                        <Badge variant="code">{card.container === '' ? t('scope.no_container') : card.container}</Badge>
                        {overrideBadges(card)}
                        {inheritNote === undefined || card.overrides.length > 0
                            ? null
                            : <span class="hdl-setup-scope-card__inherit">{inheritNote}</span>}
                    </span>
                </span>
            </label>
            {children === undefined || children.length === 0
                ? null
                : <div class="hdl-setup-scope-card__views">{children}</div>}
        </div>
    );
}

interface WebsiteCardProps {
    readonly website: WebsiteCard;
    readonly current: ScopeId;
    readonly onSelect: (scope: ScopeId) => void;
}

function WebsiteCardView({ website, current, onSelect }: WebsiteCardProps): JSX.Element {
    const translator = useT();
    return (
        <ScopeCardView
            card={website}
            selected={website.scope.id === current}
            onSelect={onSelect}
            subtitle={websiteSubtitle(website, translator)}
            inheritNote={translator.t('scope.uses_default')}
        >
            {website.views.map((view) => (
                <StoreViewRow
                    key={view.scope.id}
                    card={view}
                    selected={view.scope.id === current}
                    onSelect={onSelect}
                    parent={website.scope.name}
                />
            ))}
        </ScopeCardView>
    );
}

export function ScopeStep(): JSX.Element {
    const translator = useT();
    const { t } = translator;
    const { scope, select } = useScope();
    const { state } = useWizard();
    const navigation = useStepNavigation();
    const eventsLabel = t('track.events');
    const cards = useMemo(() => scopeCards(state.draft, eventsLabel), [state.draft, eventsLabel]);

    return (
        <>
            {cards.singleWebsite
                ? (
                    <MessageStrip tone="success" action={{ label: t('scope.skip_to_connect'), onClick: navigation.continue }}>
                        {t('scope.single_website')}
                    </MessageStrip>
                )
                : null}
            <div role="radiogroup" aria-label={t('scope.cards.label')} class="hdl-setup-scope-cards">
                <ScopeCardView
                    card={cards.root}
                    selected={cards.root.scope.id === scope.id}
                    onSelect={select}
                    subtitle={t('scope.default.sub')}
                    wide
                />
                {cards.websites.map((website) => (
                    <WebsiteCardView key={website.scope.id} website={website} current={scope.id} onSelect={select} />
                ))}
            </div>
        </>
    );
}

/** What this step contributes when the shell registers it. */
export const scopeStep: StepBehaviour = {
    component: ScopeStep,
    summary: ({ view, t: translator }) => translator.t(SCOPE_SUMMARY[view.scope.type], view.scope.name),
};
