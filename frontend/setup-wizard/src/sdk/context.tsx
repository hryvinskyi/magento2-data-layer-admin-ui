/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The two contexts every wizard hook reads, split by how often they change: the page's runtime (ports, wording,
 * registries, the ordered steps — fixed for the life of the page) and the store (the wizard state, changing on
 * every edit).
 *
 * The shell and every step plugin must read the very same context objects, which is why they exist only in the
 * SDK file and are reached only through its bare specifier.
 */
import { createContext, type ComponentChildren, type JSX } from 'preact';
import { useContext, useMemo, useReducer } from 'preact/hooks';
import {
    createWizardState,
    reduceWizard,
    type WizardAction,
    type WizardState,
} from '../application/wizard-store.ts';
import type { StepId } from '../domain/steps.ts';
import type { WizardRuntime } from './runtime.ts';
import { createStepCalls, type StepCalls } from './step-calls.ts';
import type { StepContribution } from './steps.ts';

export interface RuntimeValue {
    readonly runtime: WizardRuntime;
    /** The placed steps, in wizard order. */
    readonly steps: readonly StepContribution[];
    /** Asks the steps for their summaries and checks, keeping one broken step from breaking the rest. */
    readonly calls: StepCalls;
}

export interface StoreValue {
    readonly state: WizardState;
    readonly dispatch: (action: WizardAction) => void;
}

const RuntimeContext = createContext<RuntimeValue | null>(null);
const StoreContext = createContext<StoreValue | null>(null);

export interface WizardProviderProps {
    readonly runtime: WizardRuntime;
    /** The step shown first; left out, the first placed step. */
    readonly initialStep?: StepId;
    readonly children?: ComponentChildren;
}

/**
 * Provides the runtime and a store started from the page config: its stored snapshot, its initial scope and the
 * steps registered so far (registration is over once the wizard renders).
 *
 * @throws RangeError when no step could be placed, or the initial step is not one of them
 */
export function WizardProvider({ runtime, initialStep, children }: WizardProviderProps): JSX.Element {
    const value = useMemo((): RuntimeValue => ({
        runtime,
        steps: runtime.steps.ordered().placed,
        calls: createStepCalls(runtime.logger),
    }), [runtime]);
    const [state, dispatch] = useReducer<WizardState, WizardAction, RuntimeValue>(
        reduceWizard,
        value,
        (start: RuntimeValue): WizardState => createWizardState({
            state: start.runtime.config.state,
            scope: start.runtime.config.initialScope,
            steps: start.steps.map((step) => step.id),
            ...(initialStep === undefined ? {} : { step: initialStep }),
        }),
    );
    const store = useMemo((): StoreValue => ({ state, dispatch }), [state, dispatch]);
    return (
        <RuntimeContext.Provider value={value}>
            <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
        </RuntimeContext.Provider>
    );
}

/** @throws Error outside a WizardProvider */
export function useRuntimeValue(): RuntimeValue {
    const value = useContext(RuntimeContext);
    if (value === null) {
        throw new Error('A wizard hook was used outside <WizardProvider>');
    }
    return value;
}

/** @throws Error outside a WizardProvider */
export function useStoreValue(): StoreValue {
    const value = useContext(StoreContext);
    if (value === null) {
        throw new Error('A wizard hook was used outside <WizardProvider>');
    }
    return value;
}
