/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The wizard store bound to the component tree, with what most components derive from it: the draft seen from
 * the current scope, and the pending changes.
 */
import { useMemo } from 'preact/hooks';
import { isSaving, type WizardAction, type WizardState } from '../../application/wizard-store.ts';
import { changes, type Change } from '../../domain/diff.ts';
import { viewOf, type SettingsView } from '../../domain/view.ts';
import { useStoreValue } from '../../sdk/context.tsx';

export interface WizardBinding {
    readonly state: WizardState;
    readonly dispatch: (action: WizardAction) => void;
    /** The draft at the current scope. */
    readonly view: SettingsView;
    /** Every pending change, across all scopes. */
    readonly pending: readonly Change[];
    /** Whether anything would be lost by leaving. */
    readonly dirty: boolean;
}

export function useWizard(): WizardBinding {
    const { state, dispatch } = useStoreValue();
    const view = useMemo(() => viewOf(state.draft, state.scope), [state.draft, state.scope]);
    const pending = useMemo(() => changes(state.draft), [state.draft]);
    return { state, dispatch, view, pending, dirty: pending.length > 0 };
}

/**
 * Whether the wizard holds still for a save in flight: edits, the scope and the step cannot change until it settles,
 * so controls that change them are shown unavailable.
 */
export function useEditLock(): boolean {
    return isSaving(useStoreValue().state);
}
