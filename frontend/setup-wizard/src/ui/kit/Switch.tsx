/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * An on/off control: a button with the switch role that reports its state (`aria-checked`) and says it in words
 * next to the track, so the state never rests on the colour of the track.
 *
 * Its accessible name comes from a `<label for>` naming its id (inside a field) or from `label` (in a table row).
 */
import type { JSX } from 'preact';
import { useT } from '../hooks/use-runtime.ts';

export interface SwitchProps {
    readonly id?: string | undefined;
    readonly checked: boolean;
    readonly onChange: (checked: boolean) => void;
    readonly disabled?: boolean | undefined;
    /** The accessible name when no label element names the switch. */
    readonly label?: string | undefined;
    readonly describedBy?: string | undefined;
    /** The table-row size (36 × 20) instead of the field size (40 × 22). */
    readonly size?: 'regular' | 'small' | undefined;
}

export function Switch({ id, checked, onChange, disabled = false, label, describedBy, size = 'regular' }: SwitchProps): JSX.Element {
    const { t } = useT();
    return (
        <button
            type="button"
            role="switch"
            id={id}
            class={`hdl-setup-switch hdl-setup-switch--${size}`}
            aria-checked={checked}
            aria-label={label}
            aria-describedby={describedBy}
            disabled={disabled}
            onClick={() => onChange(!checked)}
        >
            <span class="hdl-setup-switch__track" aria-hidden="true"><span class="hdl-setup-switch__knob" /></span>
            <span class="hdl-setup-switch__text">{checked ? t('switch.yes') : t('switch.no')}</span>
        </button>
    );
}
