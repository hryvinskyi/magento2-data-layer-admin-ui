/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The steps as the stepper, the heading and the footer show them, and the moves between them: visit any step,
 * go back one, continue (refused while the step has issues, which then show on their fields), skip.
 *
 * A step's summary line appears once the step was left or completed; while a step is on screen for the first time
 * it has nothing to sum up yet. Summaries and checks are read again whenever a step announces that state of its
 * own changed; a step whose summary or check throws is logged and shown without them.
 */
import { useMemo } from 'preact/hooks';
import { needsAttention } from '../../application/step-attention.ts';
import { completedCount, statusOf, type StepId, type StepProgress, type StepStatus } from '../../domain/steps.ts';
import type { SettingIssue } from '../../domain/validation.ts';
import { useRuntimeValue } from '../../sdk/context.tsx';
import type { StepContribution, StepSummaryContext } from '../../sdk/steps.ts';
import { useChangeCount, type Subscribe } from './use-change-count.ts';
import { useSteps } from './use-runtime.ts';
import { useServerDelivery } from './use-server-delivery.ts';
import { useWizard } from './use-wizard.ts';

export interface StepView {
    readonly step: StepContribution;
    /** 1-based position. */
    readonly number: number;
    readonly status: StepStatus;
    /** What the step recorded: still to do, completed, or skipped. */
    readonly progress: StepProgress;
    /** Whether the step needs a look; true for the current step too when it does. */
    readonly attention: boolean;
    /** One line of what the step is set to, or null while there is nothing to sum up. */
    readonly summary: string | null;
}

export interface StepNavigation {
    readonly steps: readonly StepView[];
    readonly current: StepView;
    /** Steps completed or skipped. */
    readonly completed: number;
    readonly isFirst: boolean;
    readonly isLast: boolean;
    /** What holds the current step's Continue back. */
    readonly issues: readonly SettingIssue[];
    visit(step: StepId): void;
    back(): void;
    /** Completes the current step and moves on; with issues it stays and shows them on their fields. */
    continue(): void;
    /** Leaves the current step unset and moves on. */
    skip(): void;
}

/** @throws Error when the store's current step is not a placed step (the provider never lets that happen) */
export function useStepNavigation(): StepNavigation {
    const { runtime, calls } = useRuntimeValue();
    const { steps, issuesOf } = useSteps();
    const sources = useMemo(
        (): readonly Subscribe[] => steps.flatMap((step) => (step.subscribe === undefined ? [] : [step.subscribe])),
        [steps],
    );
    const changes = useChangeCount(sources);
    const { state, view, dispatch } = useWizard();
    const delivery = useServerDelivery();
    const machine = state.steps;
    const touched = state.touched;

    const views = useMemo((): readonly StepView[] => {
        const context: StepSummaryContext = { view, t: runtime.translator, delivery };
        return steps.map((step, index): StepView => {
            const progress = machine.progress.get(step.id) ?? 'todo';
            const attention = needsAttention({
                progress,
                issues: issuesOf(step),
                touched,
                flagged: calls.attention(step, context),
            });
            const status = statusOf(machine, step.id, attention);
            const showSummary = status !== 'todo' && (status !== 'current' || progress !== 'todo');
            return {
                step,
                number: index + 1,
                status,
                progress,
                attention,
                summary: showSummary ? calls.summary(step, context) : null,
            };
        });
    }, [steps, machine, touched, view, delivery, issuesOf, runtime, calls, changes]);

    const index = views.findIndex((item) => item.step.id === machine.current);
    const current = views[index];
    if (current === undefined) {
        throw new Error(`The current step ${machine.current} is not a placed step`);
    }
    const previous = views[index - 1];
    const issues = issuesOf(current.step);

    return {
        steps: views,
        current,
        completed: completedCount(machine),
        isFirst: previous === undefined,
        isLast: index === views.length - 1,
        issues,
        visit: (step: StepId): void => dispatch({ type: 'visitStep', step }),
        back: (): void => {
            if (previous !== undefined) {
                dispatch({ type: 'visitStep', step: previous.step.id });
            }
        },
        continue: (): void => dispatch({ type: 'continueStep', issues }),
        skip: (): void => dispatch({ type: 'skipStep' }),
    };
}
