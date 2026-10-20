/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * A native select in the admin's look, with the chevron drawn beside it. Options and their labels come from the
 * caller (a setting's definition, the scope tree): the control knows no values of its own.
 */
import type { JSX } from 'preact';
import { Icon } from './icons.tsx';
import type { ControlWidth } from './TextInput.tsx';

export interface SelectOption {
    readonly value: string;
    /** Translated. */
    readonly label: string;
}

export interface SelectInputProps {
    readonly id?: string | undefined;
    readonly value: string;
    readonly options: readonly SelectOption[];
    readonly onChange: (value: string) => void;
    readonly disabled?: boolean | undefined;
    readonly invalid?: boolean | undefined;
    readonly describedBy?: string | undefined;
    readonly width?: ControlWidth | undefined;
    /** The table-row height (28 px) instead of the field height (34 px). */
    readonly compact?: boolean | undefined;
    /** Bold text, as in the scope bar. */
    readonly strong?: boolean | undefined;
    /** The accessible name when no label element names the select. */
    readonly label?: string | undefined;
}

export function SelectInput({
    id,
    value,
    options,
    onChange,
    disabled = false,
    invalid = false,
    describedBy,
    width = 'long',
    compact = false,
    strong = false,
    label,
}: SelectInputProps): JSX.Element {
    const classes = [
        'hdl-setup-select',
        `hdl-setup-select--${width}`,
        compact ? 'hdl-setup-select--compact' : null,
        strong ? 'hdl-setup-select--strong' : null,
    ].filter((part) => part !== null).join(' ');
    return (
        <div class={classes}>
            <select
                id={id}
                class="hdl-setup-select__control"
                value={value}
                disabled={disabled}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                aria-label={label}
                onChange={(event) => onChange(event.currentTarget.value)}
            >
                {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            {compact ? null : <Icon name="expand_more" size={20} class="hdl-setup-select__chevron" />}
        </div>
    );
}
