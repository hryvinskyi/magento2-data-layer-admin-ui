/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * A choice of one among a few, as native radio buttons in a named group (arrow keys move between them). A single
 * option can be unavailable while the others are not; the whole group can be too:
 *
 * - `cards`: each option is a bordered card with an optional glyph tile, a description and a badge
 *   ("Recommended"); the chosen card is outlined and its tile filled.
 * - `plain`: a list of radio buttons with their labels, in a column or a row.
 */
import type { JSX } from 'preact';
import { Icon, type IconName } from './icons.tsx';

export interface RadioOption {
    readonly value: string;
    /** Translated. */
    readonly label: string;
    readonly description?: string | undefined;
    readonly icon?: IconName | undefined;
    /** A short highlight next to the label ("Recommended"); translated. */
    readonly badge?: string | undefined;
    /** This option alone cannot be chosen now. */
    readonly disabled?: boolean | undefined;
}

export interface RadioCardsProps {
    /** The radio group's name; unique on the page. */
    readonly name: string;
    /** The group's accessible name; translated. */
    readonly label: string;
    readonly value: string;
    readonly options: readonly RadioOption[];
    readonly onChange: (value: string) => void;
    readonly disabled?: boolean | undefined;
    readonly variant?: 'cards' | 'plain' | undefined;
    readonly direction?: 'column' | 'row' | undefined;
    readonly describedBy?: string | undefined;
}

export function RadioCards({
    name,
    label,
    value,
    options,
    onChange,
    disabled = false,
    variant = 'cards',
    direction = 'column',
    describedBy,
}: RadioCardsProps): JSX.Element {
    return (
        <div
            role="radiogroup"
            aria-label={label}
            aria-describedby={describedBy}
            aria-disabled={disabled ? true : undefined}
            class={`hdl-setup-radios hdl-setup-radios--${variant} hdl-setup-radios--${direction}`}
        >
            {options.map((option) => {
                const checked = option.value === value;
                const unavailable = disabled || option.disabled === true;
                return (
                    <label
                        key={option.value}
                        class="hdl-setup-radio"
                        data-checked={checked ? 'true' : 'false'}
                        data-disabled={unavailable ? 'true' : 'false'}
                    >
                        {option.icon === undefined ? null : (
                            <span class="hdl-setup-radio__tile"><Icon name={option.icon} size={20} /></span>
                        )}
                        <span class="hdl-setup-radio__text">
                            <span class="hdl-setup-radio__label">
                                <span>{option.label}</span>
                                {option.badge === undefined ? null : <span class="hdl-setup-badge hdl-setup-badge--recommended">{option.badge}</span>}
                            </span>
                            {option.description === undefined ? null : <span class="hdl-setup-radio__description">{option.description}</span>}
                        </span>
                        <input
                            type="radio"
                            class="hdl-setup-radio__input"
                            name={name}
                            value={option.value}
                            checked={checked}
                            disabled={unavailable}
                            onChange={() => onChange(option.value)}
                        />
                    </label>
                );
            })}
        </div>
    );
}
