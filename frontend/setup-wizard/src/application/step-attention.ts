/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * When the stepper marks a step "Needs attention". A step needs a look when:
 *
 * - its own check says so (a warning it shows), or
 * - a field the person touched has a problem, or
 * - it was completed or skipped and has problems now (an edit elsewhere, another scope, made it wrong).
 *
 * A step nobody has reached yet with empty required fields is simply still to do.
 */
import type { StepProgress } from '../domain/steps.ts';
import type { SettingIssue } from '../domain/validation.ts';
import type { FieldKey } from './wizard-store.ts';

export interface AttentionFacts {
    readonly progress: StepProgress;
    readonly issues: readonly SettingIssue[];
    readonly touched: ReadonlySet<FieldKey>;
    /** What the step's own check answered. */
    readonly flagged: boolean;
}

export function needsAttention(facts: AttentionFacts): boolean {
    if (facts.flagged) {
        return true;
    }
    if (facts.issues.some((issue) => facts.touched.has(issue.key))) {
        return true;
    }
    return facts.progress !== 'todo' && facts.issues.length > 0;
}
