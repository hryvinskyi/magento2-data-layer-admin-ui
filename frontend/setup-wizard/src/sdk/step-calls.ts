/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Asking a step what it contributes besides its component — its summary line, whether it needs attention, what
 * holds it back — without letting one broken step take the stepper, the footer or the other steps down. A call that
 * throws is reported to the log once per step and question, and answers as if the step had said nothing: no
 * summary, no attention, no issues (the store checks every value again when it saves).
 */
import type { Logger } from '../application/ports.ts';
import { stepIssues, type RequirementRegistry, type SettingIssue } from '../domain/validation.ts';
import type { SettingsView } from '../domain/view.ts';
import type { StepContribution, StepSummaryContext } from './steps.ts';

export interface StepCalls {
    /** The step's summary line; null when it has none, or its summary failed. */
    summary(step: StepContribution, context: StepSummaryContext): string | null;
    /** Whether the step's own check flags it; false when it has none, or the check failed. */
    attention(step: StepContribution, context: StepSummaryContext): boolean;
    /** What holds the step back in the view: its own check, or the issues of the settings it owns. */
    issues(step: StepContribution, view: SettingsView, requirements: RequirementRegistry): readonly SettingIssue[];
}

type Question = 'summary' | 'attention' | 'issues';

export function createStepCalls(logger: Logger): StepCalls {
    const reported = new Set<string>();
    const guarded = <T>(step: StepContribution, question: Question, fallback: T, call: () => T): T => {
        try {
            return call();
        } catch (error) {
            const key = `${step.id} ${question}`;
            if (!reported.has(key)) {
                reported.add(key);
                logger.error(`The setup step ${step.id} failed to answer its ${question}`, error);
            }
            return fallback;
        }
    };
    const NO_ISSUES: readonly SettingIssue[] = [];

    return Object.freeze({
        summary: (step: StepContribution, context: StepSummaryContext): string | null => {
            const summary = step.summary;
            return summary === undefined ? null : guarded(step, 'summary', null, () => summary(context));
        },
        attention: (step: StepContribution, context: StepSummaryContext): boolean => {
            const attention = step.attention;
            return attention === undefined ? false : guarded(step, 'attention', false, () => attention(context));
        },
        issues: (step: StepContribution, view: SettingsView, requirements: RequirementRegistry): readonly SettingIssue[] => {
            const issues = step.issues;
            return guarded(step, 'issues', NO_ISSUES, () => (issues === undefined
                ? stepIssues(step.id, view, requirements)
                : issues(view, requirements)));
        },
    });
}
