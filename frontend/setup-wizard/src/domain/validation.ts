/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Feedback rules for settings. They mirror the store's checks with the store's own parameters (each format pattern
 * and range comes from the server) and add the wizard's "required" rules; the store checks again on save and stays
 * the authority. Every rule answers a code, never wording.
 *
 * Required rules come from a registry instance the composition root creates and hands to each step plugin, so
 * every part of the page registers into, and reads from, the same one.
 */
import { CONTAINER_ID, ENABLED, MEASUREMENT_ID } from './core-keys.ts';
import { isEmptyValue, flagOf, type SettingDefinition, type SettingKey, type SettingKind, type SettingValue } from './setting.ts';
import type { StepId } from './steps.ts';
import type { SettingsView } from './view.ts';

export type IssueCode = 'required' | 'format' | 'range';

export interface SettingIssue {
    readonly key: SettingKey;
    readonly code: IssueCode;
}

/** A whole number of zero or more, as the store keeps every number setting: no sign, no decimals. */
const WHOLE_NUMBER = /^\d+$/;
const ONLY_ASTERISKS = /^\*+$/;

/** The text the store would check: trimmed, upper-cased for a case-insensitive setting. */
export function normalisedText(definition: SettingDefinition, text: string): string {
    const trimmed = text.trim();
    return definition.caseInsensitive ? trimmed.toUpperCase() : trimmed;
}

const matchesPattern = (definition: SettingDefinition, text: string): boolean =>
    definition.pattern === undefined || definition.pattern.test(normalisedText(definition, text));

type FormatCheck = (definition: SettingDefinition, value: SettingValue) => boolean;

const noFormat: FormatCheck = () => true;

/**
 * Whether a value has an acceptable form, per kind. Blank text passes (whether a value is needed is a required
 * rule's question). A number is a whole number without a sign or decimals, as the store refuses anything else. A
 * replacement secret made only of asterisks is refused: the store reads that as "keep the current secret" and would
 * silently save nothing.
 */
const FORMAT_CHECKS = {
    flag: noFormat,
    choice: noFormat,
    text: (definition, value) => typeof value !== 'string' || value.trim() === '' || matchesPattern(definition, value),
    number: (_definition, value) => typeof value !== 'string' || WHOLE_NUMBER.test(value.trim()),
    secret: (definition, value) => typeof value !== 'object' || !('replace' in value) || value.replace.trim() === ''
        || (!ONLY_ASTERISKS.test(value.replace.trim()) && matchesPattern(definition, value.replace)),
} as const satisfies Record<SettingKind, FormatCheck>;

export function checkFormat(definition: SettingDefinition, value: SettingValue): 'format' | null {
    return FORMAT_CHECKS[definition.kind](definition, value) ? null : 'format';
}

/** Outside the definition's minimum or maximum. Only a well-formed number is compared. */
export function checkRange(definition: SettingDefinition, value: SettingValue): 'range' | null {
    if (typeof value !== 'string' || !WHOLE_NUMBER.test(value.trim())) {
        return null;
    }
    const number = Number(value.trim());
    const tooLow = definition.min !== undefined && number < definition.min;
    const tooHigh = definition.max !== undefined && number > definition.max;
    return tooLow || tooHigh ? 'range' : null;
}

/** Whether the setting needs a value in this view. */
export type RequirementRule = (view: SettingsView) => boolean;

export interface RequirementRegistry {
    register(key: SettingKey, rule: RequirementRule): void;
    /** Required when any rule registered for the key says so. */
    isRequired(key: SettingKey, view: SettingsView): boolean;
    /** `required` when the setting is required here and has no value. */
    issuesFor(key: SettingKey, view: SettingsView): readonly IssueCode[];
}

export function createRequirementRegistry(): RequirementRegistry {
    const rules = new Map<SettingKey, RequirementRule[]>();
    const isRequired = (key: SettingKey, view: SettingsView): boolean =>
        (rules.get(key) ?? []).some((rule) => rule(view));

    return Object.freeze({
        register: (key: SettingKey, rule: RequirementRule): void => {
            rules.set(key, [...(rules.get(key) ?? []), rule]);
        },
        isRequired,
        issuesFor: (key: SettingKey, view: SettingsView): readonly IssueCode[] =>
            (isRequired(key, view) && isEmptyValue(view.value(key)) ? ['required'] : []),
    });
}

/**
 * The wizard's own required rules: while events are sent, the container ID is needed unless pages load gtag.js
 * only, and the measurement ID unless they load the container only.
 */
export function registerCoreRequirements(registry: RequirementRegistry): void {
    registry.register(CONTAINER_ID, (view) => flagOf(view.value(ENABLED)) && view.mode() !== 'gtag');
    registry.register(MEASUREMENT_ID, (view) => flagOf(view.value(ENABLED)) && view.mode() !== 'gtm');
}

/** Every issue of one setting in the view: required first, then format, then range. */
export function settingIssues(key: SettingKey, view: SettingsView, registry: RequirementRegistry): readonly IssueCode[] {
    const definition = view.definition(key);
    const value = view.value(key);
    if (definition === undefined || value === undefined) {
        return [];
    }
    const required = registry.issuesFor(key, view);
    if (required.length > 0) {
        return required;
    }
    const replacementBlank = typeof value === 'object' && 'replace' in value && value.replace.trim() === '';
    if (replacementBlank) {
        return ['required'];
    }
    return [checkFormat(definition, value), checkRange(definition, value)].filter((code) => code !== null);
}

/**
 * The issues that block continuing past a step. Only settings a person can change here count: a store view is
 * not held back by a website-only setting, a locked one, or a value it inherits and did not set.
 */
export function stepIssues(step: StepId, view: SettingsView, registry: RequirementRegistry): readonly SettingIssue[] {
    return view.definitions()
        .filter((definition) => definition.step === step && view.isEditable(definition.key))
        .flatMap((definition) => settingIssues(definition.key, view, registry)
            .map((code) => ({ key: definition.key, code })));
}
