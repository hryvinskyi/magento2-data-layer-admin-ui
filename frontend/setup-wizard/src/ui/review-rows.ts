/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * What the review step shows: one row per pending change (the stored value, the new value, where each comes from),
 * the rows grouped by the step that owns the setting, the marks a partly failed save leaves on its rows, and, once
 * everything is stored, what was saved at each scope and which events the container needs tags for.
 *
 * Everything is derived from the draft, the pending changes and the save result; the step only draws it.
 */
import {
    BUILT_IN,
    DEFAULT_SCOPE,
    effectiveValue,
    EVENTS_KEY,
    eventsAt,
    eventsOwnValues,
    inheritedFrom,
    isOn,
    ownValues,
    parseSettingKey,
    TRACK_STEP,
    type Change,
    type Draft,
    type Edit,
    type EventName,
    type OwnValues,
    type SaveResult,
    type SaveStatus,
    type ScopeId,
    type ScopeTree,
    type ScopeType,
    type SettingKey,
    type SetupState,
    type StepId,
    type Translator,
    type ValueSource,
} from '@hryvinskyi/datalayer-setup';
import { formatSelection, formatSetting, scopeName } from './review-values.ts';

type RowKey = SettingKey | typeof EVENTS_KEY;

export interface ReviewRow {
    /** Names the row among the others: its scope and setting. */
    readonly id: string;
    readonly scope: ScopeId;
    readonly scopeType: ScopeType;
    readonly scopeName: string;
    readonly key: RowKey;
    /** The step that owns the setting; the events setting belongs to the step that picks events. */
    readonly step: StepId;
    readonly label: string;
    /** The value stored now, or the one the scope takes without a value of its own. */
    readonly current: string;
    /** Where `current` comes from when the scope has no value of its own. */
    readonly currentNote: string | null;
    /** The new value, or "Use inherited value". */
    readonly next: string;
    /** For "Use inherited value": the value the scope will take, and from where. */
    readonly nextNote: string | null;
}

export interface ReviewGroup {
    /** The owning step; null for rows whose step is not placed on the page. */
    readonly step: StepId | null;
    readonly rows: readonly ReviewRow[];
}

export interface SavedScope {
    readonly scope: ScopeId;
    readonly scopeType: ScopeType;
    readonly name: string;
    readonly items: readonly { readonly label: string; readonly value: string }[];
}

/** What the step has to say: nothing pending, changes waiting (maybe after a partial failure), or all stored. */
export type ReviewPhase = 'nothing' | 'changes' | 'saved';

export type RowMark =
    | { readonly kind: 'saved' }
    | { readonly kind: 'failed'; readonly message: string | null };

export interface SaveTally {
    readonly total: number;
    readonly saved: number;
    readonly failed: number;
}

export const rowId = (scope: ScopeId, key: RowKey): string => `${scope} ${key}`;

/** Both sides of a change for one kind of value: the stored rows, the rows with the edits applied, how to show one. */
interface Comparison<V> {
    readonly tree: ScopeTree;
    readonly scope: ScopeId;
    readonly before: OwnValues<V>;
    readonly after: OwnValues<V>;
    readonly builtIn: V;
    readonly show: (value: V) => string;
    readonly translator: Translator;
}

type Sides = Pick<ReviewRow, 'current' | 'currentNote' | 'next' | 'nextNote'>;

function nameOf<V>(comparison: Comparison<V>, scope: ScopeId): string {
    return scopeName(comparison.tree.get(scope), comparison.translator);
}

/** Where a scope without a value of its own takes its value from, said as a note under the value. */
function inheritedNote<V>(comparison: Comparison<V>, source: ValueSource): string {
    const { translator, scope } = comparison;
    if (source !== BUILT_IN) {
        return translator.t('origin.inherited', nameOf(comparison, source));
    }
    return translator.t(scope === DEFAULT_SCOPE ? 'review.built_in' : 'origin.inherited_built_in');
}

function sidesOf<V>(comparison: Comparison<V>, edit: Edit<V>): Sides {
    const { tree, scope, before, after, builtIn, show, translator } = comparison;
    const own = before.get(scope);
    const current = own === undefined
        ? { current: show(effectiveValue(tree, before, builtIn, scope)), currentNote: inheritedNote(comparison, inheritedFrom(tree, before, scope)) }
        : { current: show(own), currentNote: null };
    if (edit.op === 'set') {
        return { ...current, next: show(edit.value), nextNote: null };
    }
    const source = inheritedFrom(tree, after, scope);
    const sourceName = source === BUILT_IN ? translator.t('review.built_in') : nameOf(comparison, source);
    return {
        ...current,
        next: translator.t('action.inherit'),
        nextNote: translator.t('review.inherited_value', sourceName, show(effectiveValue(tree, after, builtIn, scope))),
    };
}

interface RowParts {
    readonly key: RowKey;
    readonly step: StepId;
    readonly label: string;
}

function rowOf(draft: Draft, scope: ScopeId, parts: RowParts, sides: Sides, translator: Translator): ReviewRow {
    const target = draft.state.tree.get(scope);
    return {
        id: rowId(scope, parts.key),
        scope,
        scopeType: target.type,
        scopeName: scopeName(target, translator),
        ...parts,
        ...sides,
    };
}

/** How each kind of change becomes a row; null for a setting the snapshot no longer holds. */
const ROW_BUILDERS: {
    readonly [K in Change['target']]: (draft: Draft, change: Extract<Change, { readonly target: K }>, translator: Translator) => ReviewRow | null;
} = {
    setting: (draft, change, translator) => {
        const setting = draft.state.settings.get(change.key);
        if (setting === undefined) {
            return null;
        }
        const sides = sidesOf({
            tree: draft.state.tree,
            scope: change.scope,
            before: setting.stored,
            after: ownValues(draft, change.key),
            builtIn: setting.builtIn,
            show: (value) => formatSetting(setting.definition, value, translator),
            translator,
        }, change.edit);
        return rowOf(draft, change.scope, { key: change.key, step: setting.definition.step, label: setting.definition.label }, sides, translator);
    },
    events: (draft, change, translator) => {
        const events = draft.state.events;
        const sides = sidesOf({
            tree: draft.state.tree,
            scope: change.scope,
            before: events.stored,
            after: eventsOwnValues(draft),
            builtIn: events.builtIn,
            show: (selection) => formatSelection(events, selection, translator),
            translator,
        }, change.edit);
        return rowOf(draft, change.scope, { key: EVENTS_KEY, step: TRACK_STEP, label: translator.t('track.events') }, sides, translator);
    },
};

function rowFor<K extends Change['target']>(draft: Draft, change: Extract<Change, { readonly target: K }>, translator: Translator): ReviewRow | null {
    const build: (draft: Draft, change: Extract<Change, { readonly target: K }>, translator: Translator) => ReviewRow | null = ROW_BUILDERS[change.target];
    return build(draft, change, translator);
}

/** One row per pending change, in the order the changes come (scope by scope, settings in the server's order). */
export function rowsOf(draft: Draft, pending: readonly Change[], translator: Translator): readonly ReviewRow[] {
    return pending.flatMap((change) => rowFor(draft, change, translator) ?? []);
}

/** Rows gathered under the step that owns them, in step order; rows of a step that is not placed come last. */
export function groupRows(rows: readonly ReviewRow[], order: readonly StepId[]): readonly ReviewGroup[] {
    const placed = order.flatMap((step) => {
        const own = rows.filter((row) => row.step === step);
        return own.length === 0 ? [] : [{ step, rows: own }];
    });
    const unplaced = rows.filter((row) => !order.includes(row.step));
    return unplaced.length === 0 ? placed : [...placed, { step: null, rows: unplaced }];
}

/** How many scopes the rows touch. */
export const scopeCount = (rows: readonly ReviewRow[]): number => new Set(rows.map((row) => row.scope)).size;

export function phaseOf(save: SaveStatus, pending: number): ReviewPhase {
    if (pending > 0) {
        return 'changes';
    }
    return save.status === 'saved' ? 'saved' : 'nothing';
}

/** Marks for the rows of a save that stored only some changes; any other outcome leaves the rows unmarked. */
export function marksOf(save: SaveStatus): ReadonlyMap<string, RowMark> {
    if (save.status !== 'failed' || save.reason.kind !== 'changes') {
        return new Map();
    }
    return new Map(save.reason.results.map((result): [string, RowMark] => [
        rowId(result.scope, result.key),
        result.status === 'saved' ? { kind: 'saved' } : { kind: 'failed', message: result.message ?? null },
    ]));
}

/** How many changes a save stored and how many it refused. */
export function tallyOf(results: readonly SaveResult[]): SaveTally {
    const saved = results.filter((result) => result.status === 'saved').length;
    return { total: results.length, saved, failed: results.length - saved };
}

/** What was stored at each scope, read back from the snapshot the store holds now, in scope order. */
export function savedScopes(state: SetupState, results: readonly SaveResult[], translator: Translator): readonly SavedScope[] {
    const inherits = translator.t('action.inherit');
    const valueOf = (result: SaveResult): { readonly label: string; readonly value: string } | null => {
        if (result.key === EVENTS_KEY) {
            const own = state.events.stored.get(result.scope);
            return { label: translator.t('track.events'), value: own === undefined ? inherits : formatSelection(state.events, own, translator) };
        }
        const key = parseSettingKey(result.key);
        const setting = key === null ? undefined : state.settings.get(key);
        if (setting === undefined) {
            return null;
        }
        const own = setting.stored.get(result.scope);
        return { label: setting.definition.label, value: own === undefined ? inherits : formatSetting(setting.definition, own, translator) };
    };
    const saved = results.filter((result) => result.status === 'saved' && state.tree.has(result.scope));
    return state.tree.scopes.flatMap((scope) => {
        const items = saved.filter((result) => result.scope === scope.id).flatMap((result) => valueOf(result) ?? []);
        return items.length === 0
            ? []
            : [{ scope: scope.id, scopeType: scope.type, name: scopeName(scope, translator), items }];
    });
}

/** The events sent at a scope, in catalogue order: the ones a container needs tags for. */
export function sentEvents(draft: Draft, scope: ScopeId): readonly EventName[] {
    const selection = eventsAt(draft, scope);
    return draft.state.events.catalogue.events.filter((event) => isOn(selection, event.name)).map((event) => event.name);
}

export type CheckId = 'tags' | 'preview' | 'publish';

export interface CheckItem {
    readonly id: CheckId;
    readonly text: string;
    /** Event names to show beside the item. */
    readonly codes: readonly EventName[];
}

/** What is left to do in the tag container once the settings are stored; tags are listed only when events are sent. */
export function checklistOf(events: readonly EventName[], translator: Translator): readonly CheckItem[] {
    const tags: readonly CheckItem[] = events.length === 0
        ? []
        : [{ id: 'tags', text: translator.tn('checklist.tags', events.length, translator.t('field.reach.default')), codes: events }];
    return [
        ...tags,
        { id: 'preview', text: translator.t('checklist.preview'), codes: [] },
        { id: 'publish', text: translator.t('checklist.publish'), codes: [] },
    ];
}
