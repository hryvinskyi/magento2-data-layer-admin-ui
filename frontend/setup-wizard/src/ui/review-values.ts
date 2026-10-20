/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * How a value reads in the review: a switch as Yes or No, a choice as its option's label, a secret as a mask that
 * never carries the text, the events setting as its preset and how many events it sends, and a scope by its name.
 * All wording arrives through the translator.
 */
import {
    flagOf,
    isEmptyValue,
    presetOf,
    sentCount,
    textOf,
    type EventSelection,
    type EventsState,
    type Scope,
    type SettingDefinition,
    type SettingKind,
    type SettingValue,
    type Translator,
} from '@hryvinskyi/datalayer-setup';

type Formatter = (definition: SettingDefinition, value: SettingValue, translator: Translator) => string;

const withFallback = (text: string, translator: Translator): string => (text.trim() === '' ? translator.t('review.empty') : text);

/** What each kind of setting shows; a closed set, so a new kind does not compile until it has an arm. */
const FORMATTERS = {
    flag: (_definition, value, translator) => translator.t(flagOf(value) ? 'switch.yes' : 'switch.no'),
    choice: (definition, value, translator) => {
        const text = textOf(value);
        return withFallback(definition.options.find((option) => option.value === text)?.label ?? text, translator);
    },
    text: (_definition, value, translator) => withFallback(textOf(value), translator),
    number: (_definition, value, translator) => withFallback(textOf(value), translator),
    secret: (_definition, value, translator) => (isEmptyValue(value) ? translator.t('review.empty') : translator.t('review.secret')),
} as const satisfies { readonly [K in SettingKind]: Formatter };

/** A setting's value for display. A secret shows only whether one is set, never its text. */
export function formatSetting(definition: SettingDefinition, value: SettingValue, translator: Translator): string {
    return FORMATTERS[definition.kind](definition, value, translator);
}

/** The name of the preset a selection equals, or "Custom" when it equals none. */
export function presetName(events: Pick<EventsState, 'catalogue' | 'presets'>, selection: EventSelection, translator: Translator): string {
    const key = presetOf(events.catalogue, selection, events.presets);
    return events.presets.find((preset) => preset.key === key)?.label ?? translator.t('preset.custom');
}

/** The events setting for display: the preset it equals (else "Custom") and how many events it sends. */
export function formatSelection(events: Pick<EventsState, 'catalogue' | 'presets'>, selection: EventSelection, translator: Translator): string {
    return translator.t(
        'review.events',
        presetName(events, selection, translator),
        translator.n(sentCount(events.catalogue, selection)),
        translator.n(events.catalogue.events.length),
    );
}

/** A scope's name: the server's name for a website or store view, a short word for the default scope. */
export function scopeName(scope: Pick<Scope, 'type' | 'name'>, translator: Translator): string {
    return scope.type === 'default' ? translator.t('field.reach.default') : scope.name;
}
