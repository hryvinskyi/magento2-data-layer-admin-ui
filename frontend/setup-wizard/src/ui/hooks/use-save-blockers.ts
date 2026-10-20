/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The steps that hold Save all back: each placed step with issues at a scope that has pending changes, with its
 * place in the wizard and the scope, so the review can name them and lead to each.
 */
import { useMemo } from 'preact/hooks';
import { saveBlockers, type StepCheck } from '../../application/save-readiness.ts';
import type { Scope } from '../../domain/scope.ts';
import type { SettingIssue } from '../../domain/validation.ts';
import type { StepContribution } from '../../sdk/steps.ts';
import { useSteps } from './use-runtime.ts';
import { useWizard } from './use-wizard.ts';

export interface StepBlocker {
    readonly step: StepContribution;
    /** The step's 1-based place in the wizard. */
    readonly number: number;
    readonly scope: Scope;
    readonly issues: readonly SettingIssue[];
}

export function useSaveBlockers(): readonly StepBlocker[] {
    const { steps, issuesAt } = useSteps();
    const { state } = useWizard();
    const draft = state.draft;
    return useMemo((): readonly StepBlocker[] => {
        const checks: readonly StepCheck[] = steps.map((step) => ({ id: step.id, issuesAt: (view) => issuesAt(step, view) }));
        return saveBlockers(draft, checks).flatMap((blocker): readonly StepBlocker[] => {
            const index = steps.findIndex((step) => step.id === blocker.step);
            const step = steps[index];
            return step === undefined
                ? []
                : [{ step, number: index + 1, scope: draft.state.tree.get(blocker.scope), issues: blocker.issues }];
        });
    }, [steps, issuesAt, draft]);
}
