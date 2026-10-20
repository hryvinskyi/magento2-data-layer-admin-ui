/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The wizard's working state and the one reducer that changes it: the draft, the scope being edited, the step
 * machine, the fields a person has touched at this scope, and where the last save stands.
 *
 * Actions form a closed set handled by an exhaustive map, so an action without a handler does not compile. A
 * refused change (a locked scope, a field out of reach, the default scope asked to inherit) leaves the state as it
 * is: the page only offers what the draft accepts, so a refusal here is a guard, not a message.
 *
 * While a save is in flight the draft, the scope and the step stay as they are, so what was sent is what the person
 * sees: every edit and every move is ignored until the save settles.
 */
import { chooseMode } from '../domain/connection.ts';
import {
    createDraft,
    effectiveAt,
    eventsAt,
    inheritEvents,
    inheritValue,
    reset,
    resetAt,
    setEvents,
    setValue,
    type Draft,
    type DraftRefusal,
    type EditRef,
} from '../domain/draft.ts';
import type { EventSelection } from '../domain/events.ts';
import type { Mode } from '../domain/mode.ts';
import type { Result } from '../domain/result.ts';
import { DEFAULT_SCOPE, type ScopeId } from '../domain/scope.ts';
import type { EditValue, EventsKey, SettingKey, SettingValue } from '../domain/setting.ts';
import type { SetupState } from '../domain/setup-state.ts';
import {
    continueStep,
    createStepMachine,
    skipStep,
    visitStep,
    type StepId,
    type StepMachine,
} from '../domain/steps.ts';
import type { SettingIssue } from '../domain/validation.ts';
import type { RequestFailure } from './request-error.ts';
import type { SaveResult } from './responses.ts';
import { failedResults, settleSave } from './save-all.ts';

export type FieldKey = SettingKey | EventsKey;

/** Why a save did not store everything: some changes were refused, or the request failed as a whole. */
export type SaveFailure =
    | { readonly kind: 'changes'; readonly results: readonly SaveResult[] }
    | { readonly kind: 'request'; readonly failure: RequestFailure };

export type SaveStatus =
    | { readonly status: 'idle' }
    | { readonly status: 'saving' }
    | { readonly status: 'saved'; readonly results: readonly SaveResult[] }
    | { readonly status: 'failed'; readonly reason: SaveFailure };

export interface WizardState {
    readonly draft: Draft;
    readonly scope: ScopeId;
    readonly steps: StepMachine;
    /** Fields whose problems are shown at the current scope: touched by the person, or named by a refused Continue. */
    readonly touched: ReadonlySet<FieldKey>;
    readonly save: SaveStatus;
}

/** Payload per action type. */
export interface WizardActions {
    set: { readonly scope: ScopeId; readonly key: SettingKey; readonly value: EditValue };
    inherit: { readonly scope: ScopeId; readonly key: SettingKey };
    /** Give the scope its own value, starting from the one it inherits (a secret starts blank: it is never known here). */
    override: { readonly scope: ScopeId; readonly key: SettingKey };
    setEvents: { readonly scope: ScopeId; readonly selection: EventSelection };
    inheritEvents: { readonly scope: ScopeId };
    overrideEvents: { readonly scope: ScopeId };
    chooseMode: { readonly scope: ScopeId; readonly mode: Mode };
    /** Switch the scope being edited; what was touched belongs to the old scope and is forgotten, the draft stays. */
    setScope: { readonly scope: ScopeId };
    visitStep: { readonly step: StepId };
    /** Complete the current step unless `issues` hold it back; then the fields they name are shown as touched. */
    continueStep: { readonly issues: readonly SettingIssue[] };
    skipStep: Readonly<Record<never, never>>;
    touch: { readonly key: FieldKey };
    discardChange: { readonly ref: EditRef };
    discardAll: Readonly<Record<never, never>>;
    saveStarted: Readonly<Record<never, never>>;
    /** The server answered; `sent` is the draft the request was built from. */
    saveCompleted: { readonly sent: Draft; readonly state: SetupState; readonly results: readonly SaveResult[] };
    saveFailed: { readonly failure: RequestFailure };
    /** The save ended with nothing to report (aborted, or there was nothing to send): back to idle. */
    saveCancelled: Readonly<Record<never, never>>;
}

export type WizardAction<K extends keyof WizardActions = keyof WizardActions> = {
    [P in K]: { readonly type: P } & WizardActions[P];
}[K];

export interface WizardStart {
    readonly state: SetupState;
    readonly scope: ScopeId;
    /** Every step, in order; must not be empty. */
    readonly steps: readonly StepId[];
    /** The step shown first; left out, the first of `steps`. */
    readonly step?: StepId;
}

/** @throws RangeError when the steps are empty or repeat an id, the start step is not among them, or the scope is not in the tree. */
export function createWizardState(start: WizardStart): WizardState {
    const machine = createStepMachine(start.steps, start.step);
    if (!machine.ok) {
        throw new RangeError(`The wizard cannot start with these steps: ${machine.error.code}`);
    }
    if (!start.state.tree.has(start.scope)) {
        throw new RangeError(`The wizard cannot start at an unknown scope: ${start.scope}`);
    }
    return {
        draft: createDraft(start.state),
        scope: start.scope,
        steps: machine.value,
        touched: new Set(),
        save: { status: 'idle' },
    };
}

/** The value a scope starts with when it overrides what it inherits. */
function overrideValueOf(value: SettingValue): EditValue {
    return typeof value === 'object' ? { replace: '' } : value;
}

function withDraft(state: WizardState, result: Result<Draft, DraftRefusal>): WizardState {
    return result.ok ? { ...state, draft: result.value } : state;
}

function withMachine(state: WizardState, result: Result<StepMachine, unknown>): WizardState {
    return result.ok ? { ...state, steps: result.value } : state;
}

const NO_TOUCHED: ReadonlySet<FieldKey> = new Set();

const handlers: { readonly [K in keyof WizardActions]: (state: WizardState, action: WizardAction<K>) => WizardState } = {
    set: (state, action) => withDraft(state, setValue(state.draft, action.scope, action.key, action.value)),
    inherit: (state, action) => withDraft(state, inheritValue(state.draft, action.scope, action.key)),
    override: (state, action) => {
        if (!state.draft.state.tree.has(action.scope) || !state.draft.state.settings.has(action.key)) {
            return state;
        }
        const value = overrideValueOf(effectiveAt(state.draft, action.scope, action.key));
        return withDraft(state, setValue(state.draft, action.scope, action.key, value));
    },
    setEvents: (state, action) => withDraft(state, setEvents(state.draft, action.scope, action.selection)),
    inheritEvents: (state, action) => withDraft(state, inheritEvents(state.draft, action.scope)),
    overrideEvents: (state, action) => (state.draft.state.tree.has(action.scope)
        ? withDraft(state, setEvents(state.draft, action.scope, eventsAt(state.draft, action.scope)))
        : state),
    chooseMode: (state, action) => withDraft(state, chooseMode(state.draft, action.scope, action.mode)),
    setScope: (state, action) => (state.draft.state.tree.has(action.scope) && action.scope !== state.scope
        ? { ...state, scope: action.scope, touched: NO_TOUCHED }
        : state),
    visitStep: (state, action) => withMachine(state, visitStep(state.steps, action.step)),
    continueStep: (state, action) => {
        const next = continueStep(state.steps, action.issues);
        if (next.ok) {
            return { ...state, steps: next.value };
        }
        if (next.error.code !== 'blocked') {
            return state;
        }
        return { ...state, touched: new Set([...state.touched, ...action.issues.map((issue) => issue.key)]) };
    },
    skipStep: (state) => withMachine(state, skipStep(state.steps)),
    touch: (state, action) => (state.touched.has(action.key)
        ? state
        : { ...state, touched: new Set([...state.touched, action.key]) }),
    discardChange: (state, action) => ({ ...state, draft: resetAt(state.draft, action.ref) }),
    discardAll: (state) => ({ ...state, draft: reset(state.draft) }),
    saveStarted: (state) => ({ ...state, save: { status: 'saving' } }),
    saveCompleted: (state, action) => {
        const draft = settleSave(state.draft, action.sent, { state: action.state, results: action.results });
        const failed = failedResults(action.results);
        const save: SaveStatus = failed.length === 0
            ? { status: 'saved', results: action.results }
            : { status: 'failed', reason: { kind: 'changes', results: action.results } };
        // A scope deleted meanwhile is no longer in the snapshot; the default scope always is.
        const scope = action.state.tree.has(state.scope) ? state.scope : DEFAULT_SCOPE;
        return { ...state, draft, save, scope };
    },
    saveFailed: (state, action) => ({ ...state, save: { status: 'failed', reason: { kind: 'request', failure: action.failure } } }),
    saveCancelled: (state) => (state.save.status === 'saving' ? { ...state, save: { status: 'idle' } } : state),
};

/** Which actions may change the state while a save is in flight: only touching a field and settling the save. */
const ALLOWED_WHILE_SAVING = {
    set: false,
    inherit: false,
    override: false,
    setEvents: false,
    inheritEvents: false,
    overrideEvents: false,
    chooseMode: false,
    setScope: false,
    visitStep: false,
    continueStep: false,
    skipStep: false,
    touch: true,
    discardChange: false,
    discardAll: false,
    saveStarted: false,
    saveCompleted: true,
    saveFailed: true,
    saveCancelled: true,
} as const satisfies { readonly [K in keyof WizardActions]: boolean };

/** Whether the wizard holds still for a save in flight. */
export const isSaving = (state: WizardState): boolean => state.save.status === 'saving';

export function reduceWizard<K extends keyof WizardActions>(state: WizardState, action: WizardAction<K>): WizardState {
    if (isSaving(state) && !ALLOWED_WHILE_SAVING[action.type]) {
        return state;
    }
    const handler: (state: WizardState, action: WizardAction<K>) => WizardState = handlers[action.type];
    return handler(state, action);
}
