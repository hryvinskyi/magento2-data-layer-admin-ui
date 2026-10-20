/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The steps of the wizard, as the shell and step plugins register them. The set is open: the shell's own steps
 * and every plugin's register into the one registry the composition root created.
 */
import type { ComponentType } from 'preact';
import { orderSteps, type StepOrder } from '../application/step-order.ts';
import type { ServerDelivery } from '../domain/server-delivery.ts';
import type { StepId } from '../domain/steps.ts';
import type { RequirementRegistry, SettingIssue } from '../domain/validation.ts';
import type { SettingsView } from '../domain/view.ts';
import type { Translator } from '../ui/i18n/translator.ts';

export interface StepSummaryContext {
    readonly view: SettingsView;
    readonly t: Translator;
    /** Whether anything delivers events from the server at the current scope, and which step sets it up. */
    readonly delivery: ServerDelivery;
}

export interface StepContribution {
    readonly id: StepId;
    /** The step this one follows; left out, the step follows the steps registered before it. */
    readonly after?: StepId;
    /** A glyph name the shell draws in the stepper. */
    readonly icon: string;
    /** The phrase key of the step's title. */
    readonly title: string;
    /** The phrase key of the line under the title; left out, the step has none. */
    readonly intro?: string;
    /** Whether the step offers "Skip this step": for optional steps the rest of the setup works without. */
    readonly skippable?: boolean;
    /** Rendered while the step is current; reads everything through the SDK's hooks. */
    readonly component: ComponentType;
    /** One line of translated text describing what the step is set to, for overviews. */
    readonly summary?: (context: StepSummaryContext) => string;
    /** What holds Continue back. Left out: every issue of an editable setting this step owns. */
    readonly issues?: (view: SettingsView, requirements: RequirementRegistry) => readonly SettingIssue[];
    /**
     * Whether the step needs a look for a reason other than its issues (a warning it shows, such as events counted
     * twice). The stepper marks such a step "Needs attention".
     */
    readonly attention?: (context: StepSummaryContext) => boolean;
    /**
     * For a step whose summary or attention also reads state of its own (a test's outcome): calls the listener
     * whenever that state changes, so the stepper reads them again. Returns the unsubscribe.
     */
    readonly subscribe?: (listener: () => void) => () => void;
}

/**
 * What a step's own file contributes: how it renders, sums up and checks itself. The shell adds the id, place,
 * glyph and wording keys when it registers the step.
 */
export type StepBehaviour = Pick<StepContribution, 'component' | 'summary' | 'issues' | 'attention' | 'subscribe'>;

/** Two steps with one id: the page could only show one of them, so registration fails loudly. */
export class StepTakenError extends Error {
    readonly stepId: StepId;

    constructor(stepId: StepId) {
        super(`A step with id ${stepId} is already registered`);
        this.name = 'StepTakenError';
        this.stepId = stepId;
    }
}

export interface StepRegistry {
    /** @throws StepTakenError */
    register(step: StepContribution): void;
    has(id: StepId): boolean;
    /** The steps in wizard order, and those whose anchor never appeared. */
    ordered(): StepOrder<StepContribution>;
}

export function createStepRegistry(): StepRegistry {
    const steps: StepContribution[] = [];
    const has = (id: StepId): boolean => steps.some((step) => step.id === id);
    return Object.freeze({
        register: (step: StepContribution): void => {
            if (has(step.id)) {
                throw new StepTakenError(step.id);
            }
            steps.push(step);
        },
        has,
        ordered: (): StepOrder<StepContribution> => orderSteps(steps),
    });
}
