/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The "Review and save" step: the pending changes, side by side with what is stored, and what happened when they
 * were saved. The shell registers it, shows its heading, the stepper and the footer around it; Save all lives in the
 * footer, so this step only reads where the save stands:
 *
 * - nothing pending: "Nothing to save";
 * - changes pending: the table of changes, grouped by the step that owns each setting. Each pending change can be
 *   discarded on its own, or all of them at once (asked once more in place). After a save that stored only some of
 *   them, a strip says how many and each row carries its outcome (saved, or the store's reason);
 * - everything stored: what was saved at each scope, links onward, and a checklist for the tag container.
 *
 * While a step has problems at a scope the save would write, Save all waits, and a strip above the table names each
 * such step and scope with a way to go there. A save that failed as a whole is already said above the step by the
 * shell; the table simply stays as it was.
 */
import type { JSX } from 'preact';
import { useMemo, useRef, useState } from 'preact/hooks';
import {
    Button,
    DEFAULT_SCOPE,
    ExternalLink,
    Icon,
    iconOr,
    MessageStrip,
    useSaveBlockers,
    useScope,
    useStepNavigation,
    useT,
    usePageLinks,
    useWizard,
    type IconName,
    type SaveStatus,
    type ScopeType,
    type StepBehaviour,
    type StepBlocker,
    type StepView,
    type Translator,
} from '@hryvinskyi/datalayer-setup';
import {
    checklistOf,
    groupRows,
    marksOf,
    phaseOf,
    rowsOf,
    savedScopes,
    scopeCount,
    sentEvents,
    tallyOf,
    type CheckId,
    type CheckItem,
    type ReviewGroup,
    type ReviewRow,
    type RowMark,
    type SavedScope,
} from '../review-rows.ts';
import { scopeName } from '../review-values.ts';

const TAG_ASSISTANT = 'https://tagassistant.google.com/';
const TABLE_TITLE_ID = 'hdl-setup-review-title';

const SCOPE_ICON = {
    default: 'public',
    website: 'storefront',
    store: 'translate',
} as const satisfies Record<ScopeType, IconName>;

/**
 * The rows as they stood when a save was sent. A save that stores only some changes removes those from the pending
 * list, but the table keeps listing them (marked saved) next to the ones that failed, for as long as this step
 * stays on screen; coming back to the step later lists only what is still pending.
 */
function useListedRows(pending: readonly ReviewRow[], save: SaveStatus): readonly ReviewRow[] {
    const sent = useRef<readonly ReviewRow[]>([]);
    if (save.status === 'idle' || save.status === 'saving') {
        sent.current = pending;
    }
    const partlySaved = save.status === 'failed' && save.reason.kind === 'changes';
    return partlySaved && sent.current.length > 0 ? sent.current : pending;
}

function EmptyState({ translator }: { readonly translator: Translator }): JSX.Element {
    return (
        <div class="hdl-setup-empty">
            <span class="hdl-setup-empty__tile"><Icon name="done_all" size={30} /></span>
            <h3 class="hdl-setup-empty__title">{translator.t('review.nothing.title')}</h3>
            <p class="hdl-setup-empty__text">{translator.t('review.nothing.text')}</p>
        </div>
    );
}

function ScopeBadge({ row }: { readonly row: ReviewRow }): JSX.Element {
    const variant = row.scopeType === 'default' ? 'hdl-setup-badge' : 'hdl-setup-badge hdl-setup-badge--override';
    return (
        <span class={`${variant} hdl-setup-badge--scope`}>
            <Icon name={SCOPE_ICON[row.scopeType]} size={14} />
            {row.scopeName}
        </span>
    );
}

function Outcome({ mark, translator }: { readonly mark: RowMark | undefined; readonly translator: Translator }): JSX.Element | null {
    if (mark === undefined) {
        return null;
    }
    if (mark.kind === 'saved') {
        return (
            <span class="hdl-setup-review__saved">
                <Icon name="check_circle" size={16} filled />
                {translator.t('review.saved')}
            </span>
        );
    }
    return (
        <span class="hdl-setup-review__failed">
            <Icon name="error" size={16} filled />
            <span>{mark.message ?? translator.t('review.failed')}</span>
        </span>
    );
}

interface ChangeRowProps {
    readonly row: ReviewRow;
    readonly mark: RowMark | undefined;
    readonly translator: Translator;
    /** Drops the row's pending change; left out for a row that is no longer pending (saved). */
    readonly onDiscard?: (() => void) | undefined;
}

function ChangeRow({ row, mark, translator, onDiscard }: ChangeRowProps): JSX.Element {
    return (
        <div class="hdl-setup-table__row" role="row" data-result={mark?.kind === 'failed' ? 'failed' : undefined}>
            <div role="rowheader" class="hdl-setup-review__label">{row.label}</div>
            <div role="cell" class="hdl-setup-review__current">
                <span class="hdl-setup-review__struck">{row.current}</span>
                {row.currentNote === null ? null : <span class="hdl-setup-review__sub">{row.currentNote}</span>}
            </div>
            <div role="cell" class="hdl-setup-review__arrow" aria-hidden="true"><Icon name="arrow_forward" size={18} /></div>
            <div role="cell" class="hdl-setup-review__new">
                <span class="hdl-setup-review__value">{row.next}</span>
                {row.nextNote === null ? null : <span class="hdl-setup-review__sub">{row.nextNote}</span>}
                <Outcome mark={mark} translator={translator} />
            </div>
            <div role="cell" class="hdl-setup-review__scope">
                <ScopeBadge row={row} />
                {onDiscard === undefined ? null : (
                    <Button variant="link" onClick={onDiscard} label={translator.t('review.discard_row', row.label, row.scopeName)}>
                        {translator.t('review.discard')}
                    </Button>
                )}
            </div>
        </div>
    );
}

/** "Discard all", asked once more in place before every pending change is dropped. */
function DiscardAll({ translator, onDiscardAll }: { readonly translator: Translator; readonly onDiscardAll: () => void }): JSX.Element {
    const [asking, setAsking] = useState(false);
    const { t } = translator;
    if (!asking) {
        return <Button variant="tertiary" onClick={() => setAsking(true)}>{t('review.discard_all')}</Button>;
    }
    return (
        <span class="hdl-setup-review__confirm" role="group" aria-label={t('review.discard_all.confirm')}>
            <span>{t('review.discard_all.confirm')}</span>
            <Button variant="tertiary" onClick={onDiscardAll}>{t('review.discard_all.yes')}</Button>
            <Button variant="link" onClick={() => setAsking(false)}>{t('review.discard_all.no')}</Button>
        </span>
    );
}

interface BlockedStepsProps {
    readonly blockers: readonly StepBlocker[];
    readonly translator: Translator;
    readonly onGo: (blocker: StepBlocker) => void;
}

/** The steps that hold Save all back, each with the scope it has problems at and a way to go there. */
function BlockedSteps({ blockers, translator, onGo }: BlockedStepsProps): JSX.Element {
    const { t, n } = translator;
    return (
        <div class="hdl-setup-strip" data-tone="warning" role="alert">
            <Icon name="warning" size={22} filled class="hdl-setup-strip__icon" />
            <div class="hdl-setup-strip__text">
                <p class="hdl-setup-review__blocked-title">{t('review.blocked')}</p>
                <ul class="hdl-setup-review__blocked">
                    {blockers.map((blocker) => (
                        <li key={`${blocker.scope.id} ${blocker.step.id}`} class="hdl-setup-review__blocked-item">
                            <span>{t('review.blocked.item', t(blocker.step.title), scopeName(blocker.scope, translator))}</span>
                            <Button variant="tertiary" onClick={() => onGo(blocker)}>{t('action.go_to_step', n(blocker.number))}</Button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

interface GroupHeading {
    readonly icon: IconName;
    readonly label: string;
}

function headingOf(group: ReviewGroup, steps: readonly StepView[], translator: Translator): GroupHeading {
    const view = steps.find((candidate) => candidate.step.id === group.step);
    if (view === undefined) {
        return { icon: 'tune', label: translator.t('review.group.other') };
    }
    return {
        icon: iconOr(view.step.icon, 'tune'),
        label: translator.t('review.group', translator.n(view.number), translator.t(view.step.title)),
    };
}

interface ChangesTableProps {
    readonly rows: readonly ReviewRow[];
    readonly groups: readonly ReviewGroup[];
    readonly steps: readonly StepView[];
    readonly marks: ReadonlyMap<string, RowMark>;
    readonly saving: boolean;
    readonly translator: Translator;
    readonly onDiscard: (row: ReviewRow) => void;
    readonly onDiscardAll: () => void;
}

function ChangesTable({ rows, groups, steps, marks, saving, translator, onDiscard, onDiscardAll }: ChangesTableProps): JSX.Element {
    const { t, tn } = translator;
    return (
        <div class="hdl-setup-table hdl-setup-review">
            <div class="hdl-setup-table__head">
                <div class="hdl-setup-table__title">
                    <span class="hdl-setup-card__tile"><Icon name="difference" size={20} /></span>
                    <h3 id={TABLE_TITLE_ID}>{t('review.changes')}</h3>
                </div>
                <div class="hdl-setup-table__counters">
                    <span class="hdl-setup-table__count">{t('review.count', tn('changes', rows.length), tn('review.scopes', scopeCount(rows)))}</span>
                    <DiscardAll translator={translator} onDiscardAll={onDiscardAll} />
                </div>
            </div>
            <div class="hdl-setup-table__body" role="table" aria-labelledby={TABLE_TITLE_ID} aria-disabled={saving ? 'true' : undefined}>
                <div class="hdl-setup-table__header" role="row">
                    <div role="columnheader">{t('review.column.setting')}</div>
                    <div role="columnheader">{t('review.column.current')}</div>
                    <div aria-hidden="true" />
                    <div role="columnheader">{t('review.column.new')}</div>
                    <div role="columnheader">{t('scope.label')}</div>
                </div>
                {groups.map((group) => {
                    const heading = headingOf(group, steps, translator);
                    return (
                        <div key={group.step ?? 'other'} role="rowgroup" aria-label={heading.label}>
                            <div class="hdl-setup-table__group" role="row">
                                <Icon name={heading.icon} size={18} />
                                <span role="rowheader" aria-colspan={5}>{heading.label}</span>
                            </div>
                            {group.rows.map((row) => {
                                const mark = marks.get(row.id);
                                return (
                                    <ChangeRow
                                        key={row.id}
                                        row={row}
                                        mark={mark}
                                        translator={translator}
                                        onDiscard={mark?.kind === 'saved' ? undefined : () => onDiscard(row)}
                                    />
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function Checklist({ items, translator }: { readonly items: readonly CheckItem[]; readonly translator: Translator }): JSX.Element {
    const [done, setDone] = useState<ReadonlySet<CheckId>>(new Set());
    const toggle = (id: CheckId): void => setDone((current) => {
        const next = new Set(current);
        if (!next.delete(id)) {
            next.add(id);
        }
        return next;
    });
    return (
        <div class="hdl-setup-checklist">
            <div class="hdl-setup-checklist__head">
                <span class="hdl-setup-card__tile"><Icon name="rocket_launch" size={20} /></span>
                <h3>{translator.t('checklist.title')}</h3>
            </div>
            {items.map((item) => {
                const textId = `hdl-setup-check-${item.id}`;
                return (
                    <label key={item.id} class="hdl-setup-checklist__item">
                        <input
                            type="checkbox"
                            class="hdl-setup-checklist__check"
                            aria-labelledby={textId}
                            checked={done.has(item.id)}
                            onChange={() => toggle(item.id)}
                        />
                        <span class="hdl-setup-checklist__text">
                            <span id={textId}>{item.text}</span>
                            {item.codes.length === 0 ? null : (
                                <span class="hdl-setup-codes">
                                    {item.codes.map((code) => <span key={code} class="hdl-setup-code">{code}</span>)}
                                </span>
                            )}
                        </span>
                    </label>
                );
            })}
        </div>
    );
}

interface SavedPanelProps {
    readonly total: number;
    readonly scopes: readonly SavedScope[];
    readonly advanced: string | null;
    readonly checks: readonly CheckItem[];
    readonly translator: Translator;
}

function SavedPanel({ total, scopes, advanced, checks, translator }: SavedPanelProps): JSX.Element {
    const { t, tn } = translator;
    return (
        <>
            <div class="hdl-setup-success" role="status">
                <div class="hdl-setup-success__head">
                    <span class="hdl-setup-success__tile"><Icon name="check" size={28} /></span>
                    <div class="hdl-setup-success__titles">
                        <h3 class="hdl-setup-success__title">{tn('success.count', total)}</h3>
                        <span class="hdl-setup-success__text">{t('success.text')}</span>
                    </div>
                </div>
                <div class="hdl-setup-success__scopes">
                    {scopes.map((scope) => (
                        <div key={scope.scope} class="hdl-setup-success__scope">
                            <span class="hdl-setup-success__scope-name">
                                <Icon name={SCOPE_ICON[scope.scopeType]} size={18} />
                                {scope.name}
                            </span>
                            {scope.items.map((item) => (
                                <span key={item.label} class="hdl-setup-success__item">
                                    <Icon name="check" size={16} />
                                    <span><strong>{item.label}</strong><span aria-hidden="true"> {t('review.separator')} </span>{item.value}</span>
                                </span>
                            ))}
                        </div>
                    ))}
                </div>
                <div class="hdl-setup-success__actions">
                    <ExternalLink href={TAG_ASSISTANT}>{t('checklist.open_preview')}</ExternalLink>
                    {advanced === null ? null : (
                        <a class="hdl-setup-button hdl-setup-button--quiet hdl-setup-button--anchor" href={advanced}>
                            <Icon name="tune" size={18} />
                            {t('action.advanced')}
                        </a>
                    )}
                </div>
            </div>
            <Checklist items={checks} translator={translator} />
        </>
    );
}

export function ReviewStep(): JSX.Element {
    const translator = useT();
    const { state, pending, dispatch } = useWizard();
    const navigation = useStepNavigation();
    const { select } = useScope();
    const links = usePageLinks();
    const blockers = useSaveBlockers();
    const save = state.save;
    const goTo = (blocker: StepBlocker): void => {
        select(blocker.scope.id);
        navigation.visit(blocker.step.id);
    };

    const live = useMemo(() => rowsOf(state.draft, pending, translator), [state.draft, pending, translator]);
    const rows = useListedRows(live, save);
    const phase = phaseOf(save, pending.length);

    if (phase === 'nothing') {
        return <EmptyState translator={translator} />;
    }
    if (phase === 'saved' && save.status === 'saved') {
        const checks = checklistOf(sentEvents(state.draft, DEFAULT_SCOPE), translator);
        return (
            <SavedPanel
                total={tallyOf(save.results).saved}
                scopes={savedScopes(state.draft.state, save.results, translator)}
                advanced={links.advanced}
                checks={checks}
                translator={translator}
            />
        );
    }

    const tally = save.status === 'failed' && save.reason.kind === 'changes' ? tallyOf(save.reason.results) : null;
    return (
        <>
            {tally === null ? null : (
                <MessageStrip tone="error">
                    {translator.t('save.partial', translator.n(tally.saved), translator.n(tally.total), translator.n(tally.failed))}
                </MessageStrip>
            )}
            {blockers.length === 0 ? null : <BlockedSteps blockers={blockers} translator={translator} onGo={goTo} />}
            <ChangesTable
                rows={rows}
                groups={groupRows(rows, navigation.steps.map((view) => view.step.id))}
                steps={navigation.steps}
                marks={marksOf(save)}
                saving={save.status === 'saving'}
                translator={translator}
                onDiscard={(row) => dispatch({ type: 'discardChange', ref: { scope: row.scope, key: row.key } })}
                onDiscardAll={() => dispatch({ type: 'discardAll' })}
            />
        </>
    );
}

/** What this step contributes when the shell registers it. */
export const reviewStep: StepBehaviour = { component: ReviewStep };
