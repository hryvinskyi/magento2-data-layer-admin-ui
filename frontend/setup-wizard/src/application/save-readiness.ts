/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Whether Save all may send the draft. A step with issues holds its own Continue back; Save all is held back the
 * same way, at every scope it would write: while any step has issues at a scope with pending changes, nothing is
 * sent, and each such step is named with that scope so the person can go and fix it.
 *
 * A scope without pending changes is not checked: saving does not touch it, so its problems are not this save's.
 */
import { changes } from '../domain/diff.ts';
import type { Draft } from '../domain/draft.ts';
import type { ScopeId } from '../domain/scope.ts';
import type { StepId } from '../domain/steps.ts';
import type { SettingIssue } from '../domain/validation.ts';
import { viewOf, type SettingsView } from '../domain/view.ts';

/** One step's check: what holds it back in a view. */
export interface StepCheck {
    readonly id: StepId;
    issuesAt(view: SettingsView): readonly SettingIssue[];
}

/** A step that has issues at a scope Save all would write. */
export interface SaveBlocker {
    readonly step: StepId;
    readonly scope: ScopeId;
    readonly issues: readonly SettingIssue[];
}

/** The scopes with pending changes, in tree order. */
function changedScopes(draft: Draft): readonly ScopeId[] {
    return [...new Set(changes(draft).map((change) => change.scope))];
}

/** Every step with issues at a scope with pending changes: by scope (tree order), then in step order. */
export function saveBlockers(draft: Draft, steps: readonly StepCheck[]): readonly SaveBlocker[] {
    return changedScopes(draft).flatMap((scope) => {
        const view = viewOf(draft, scope);
        return steps
            .map((step): SaveBlocker => ({ step: step.id, scope, issues: step.issuesAt(view) }))
            .filter((blocker) => blocker.issues.length > 0);
    });
}
