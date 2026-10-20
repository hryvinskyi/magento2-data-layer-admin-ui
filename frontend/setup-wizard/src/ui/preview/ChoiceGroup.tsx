/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * A short row of buttons of which exactly one is chosen, either as tabs (the choice switches what is shown below)
 * or as radio buttons (the choice is a setting of the view). Only the chosen button is in the tab order; the arrow
 * keys move the choice, and focus, to the neighbour.
 */
import type { JSX } from 'preact';
import { Icon, type IconName } from '@hryvinskyi/datalayer-setup';
import { choiceAfterKey } from '../arrow-choice.ts';

export type ChoiceSemantics = 'tabs' | 'radios';

/** The roles, the stylesheet's classes and the attribute that marks the chosen button, per semantics. */
const SEMANTICS = {
    tabs: {
        group: 'tablist',
        item: 'tab',
        groupClass: 'hdl-setup-tabs',
        itemClass: 'hdl-setup-tab',
        chosen: (on: boolean) => ({ 'aria-selected': on }),
    },
    radios: {
        group: 'radiogroup',
        item: 'radio',
        groupClass: 'hdl-setup-segmented',
        itemClass: 'hdl-setup-segmented__option',
        chosen: (on: boolean) => ({ 'aria-checked': on }),
    },
} as const satisfies Record<ChoiceSemantics, {
    readonly group: string;
    readonly item: string;
    readonly groupClass: string;
    readonly itemClass: string;
    readonly chosen: (on: boolean) => Record<string, boolean>;
}>;

export interface ChoiceOption<V extends string> {
    readonly value: V;
    /** Translated. */
    readonly label: string;
    readonly icon?: IconName | undefined;
    /** The id of the button, for a panel that names it. */
    readonly id?: string | undefined;
}

export interface ChoiceGroupProps<V extends string> {
    readonly semantics: ChoiceSemantics;
    /** The group's accessible name; translated. */
    readonly label: string;
    readonly options: readonly ChoiceOption<V>[];
    readonly value: V;
    readonly onChange: (value: V) => void;
    /** The id of the panel the tabs switch. */
    readonly controls?: string | undefined;
}

export function ChoiceGroup<V extends string>({
    semantics,
    label,
    options,
    value,
    onChange,
    controls,
}: ChoiceGroupProps<V>): JSX.Element {
    const kit = SEMANTICS[semantics];
    const choose = (event: KeyboardEvent): void => {
        const next = choiceAfterKey(options.map((option) => option.value), value, event.key);
        const chosen = options.find((option) => option.value === next);
        if (chosen === undefined || !(event.currentTarget instanceof HTMLElement)) {
            return;
        }
        event.preventDefault();
        onChange(chosen.value);
        const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role]') ?? [];
        buttons[options.indexOf(chosen)]?.focus();
    };

    return (
        <div role={kit.group} aria-label={label} class={kit.groupClass}>
            {options.map((option) => {
                const on = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        role={kit.item}
                        id={option.id}
                        class={kit.itemClass}
                        tabIndex={on ? 0 : -1}
                        aria-controls={semantics === 'tabs' && on ? controls : undefined}
                        {...kit.chosen(on)}
                        onClick={() => onChange(option.value)}
                        onKeyDown={choose}
                    >
                        {option.icon === undefined ? null : <Icon name={option.icon} size={16} />}
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
