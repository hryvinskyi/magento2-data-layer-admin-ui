/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The page-wide pieces a component may read: wording, plugin data, the JSON client for a plugin's own endpoints,
 * the log, and the steps in order with what holds each back.
 */
import { useCallback } from 'preact/hooks';
import type { Logger } from '../../application/ports.ts';
import type { JsonClient } from '../../adapters/json-client.ts';
import type { SettingIssue } from '../../domain/validation.ts';
import type { SettingsView } from '../../domain/view.ts';
import { useRuntimeValue } from '../../sdk/context.tsx';
import type { StepContribution } from '../../sdk/steps.ts';
import type { Translator } from '../i18n/translator.ts';
import { useWizard } from './use-wizard.ts';

/** Wording: `t`, `tn`, `n` and `issue` over the phrases the server sent. */
export function useT(): Translator {
    return useRuntimeValue().runtime.translator;
}

/** The data the server sent for one plugin, unparsed: the plugin parses its own data. */
export function useExtensionData(pluginId: string): unknown {
    return useRuntimeValue().runtime.config.extensions.get(pluginId);
}

/** The JSON client with the wizard's request rules (form key, AJAX marker, deadline, error kinds). */
export function useJsonClient(): JsonClient {
    return useRuntimeValue().runtime.client;
}

/** Where details for developers go (a failed answer's shape, a step that broke); a person never reads them. */
export function useLogger(): Logger {
    return useRuntimeValue().runtime.logger;
}

export interface StepsBinding {
    /** The placed steps, in wizard order. */
    readonly steps: readonly StepContribution[];
    /** What currently holds a step's Continue back, at the current scope. */
    issuesOf(step: StepContribution): readonly SettingIssue[];
    /** What holds a step back in another view (another scope). */
    issuesAt(step: StepContribution, view: SettingsView): readonly SettingIssue[];
}

export function useSteps(): StepsBinding {
    const { runtime, steps, calls } = useRuntimeValue();
    const { view } = useWizard();
    const issuesAt = useCallback(
        (step: StepContribution, at: SettingsView): readonly SettingIssue[] => calls.issues(step, at, runtime.requirements),
        [calls, runtime],
    );
    const issuesOf = useCallback((step: StepContribution): readonly SettingIssue[] => issuesAt(step, view), [issuesAt, view]);
    return { steps, issuesOf, issuesAt };
}
