/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Text controls: a text input (monospace for identifiers), and a secret input that never shows a stored secret.
 *
 * A stored secret is only known to be set: the input shows a mask, notes that the value is stored encrypted, and
 * offers Replace, which starts typing a new one. While a new one is typed over a stored one, "Keep the stored
 * secret" takes the replacement back. Whatever is typed goes out once with the save and is never read back.
 */
import type { JSX } from 'preact';
import type { SettingValue } from '../../domain/setting.ts';
import { useT } from '../hooks/use-runtime.ts';
import { Button } from './Button.tsx';
import { Icon } from './icons.tsx';

/** 90, 240 or 340 pixels, the whole row, or as wide as the content. */
export type ControlWidth = 'short' | 'medium' | 'long' | 'full' | 'auto';

export interface TextInputProps {
    readonly id: string;
    readonly value: string;
    readonly onInput: (value: string) => void;
    /** Leaving the field: where a field marks itself touched. */
    readonly onBlur?: (() => void) | undefined;
    readonly disabled?: boolean | undefined;
    readonly invalid?: boolean | undefined;
    readonly describedBy?: string | undefined;
    readonly placeholder?: string | undefined;
    /** Monospace, for identifiers and addresses. */
    readonly mono?: boolean | undefined;
    readonly width?: ControlWidth | undefined;
    /** A unit after the input ("days"); translated. */
    readonly suffix?: string | undefined;
    /** The accessible name when no label element names the input. */
    readonly label?: string | undefined;
    readonly type?: 'text' | 'search' | undefined;
}

const inputClass = (width: ControlWidth, mono: boolean): string =>
    `hdl-setup-input hdl-setup-input--${width}${mono ? ' hdl-setup-input--mono' : ''}`;

export function TextInput({
    id,
    value,
    onInput,
    onBlur,
    disabled = false,
    invalid = false,
    describedBy,
    placeholder,
    mono = false,
    width = 'long',
    suffix,
    label,
    type = 'text',
}: TextInputProps): JSX.Element {
    return (
        <div class="hdl-setup-input-row">
            <input
                id={id}
                type={type}
                class={inputClass(width, mono)}
                value={value}
                placeholder={placeholder}
                disabled={disabled}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                aria-label={label}
                spellcheck={false}
                autocomplete="off"
                onInput={(event) => onInput(event.currentTarget.value)}
                onBlur={onBlur}
            />
            {suffix === undefined ? null : <span class="hdl-setup-input-row__suffix">{suffix}</span>}
        </div>
    );
}

export interface SecretInputProps {
    readonly id: string;
    /** The secret as the setting holds it: whether one is stored, or the replacement being typed. */
    readonly value: SettingValue;
    /** The replacement text; `''` starts a replacement of a stored secret. */
    readonly onReplace: (text: string) => void;
    /** Takes a replacement back, keeping the stored secret; offered only while one is being replaced. */
    readonly onKeep?: (() => void) | undefined;
    readonly onBlur?: (() => void) | undefined;
    readonly disabled?: boolean | undefined;
    readonly invalid?: boolean | undefined;
    readonly describedBy?: string | undefined;
    readonly width?: ControlWidth | undefined;
}

/** Whether the setting holds a stored secret that is not being replaced. */
const isStoredSecret = (value: SettingValue): boolean => typeof value === 'object' && 'set' in value && value.set;

const replacementOf = (value: SettingValue): string => (typeof value === 'object' && 'replace' in value ? value.replace : '');

export function SecretInput({
    id,
    value,
    onReplace,
    onKeep,
    onBlur,
    disabled = false,
    invalid = false,
    describedBy,
    width = 'medium',
}: SecretInputProps): JSX.Element {
    const { t } = useT();
    const note = (
        <span class="hdl-setup-input-row__note">
            <Icon name="lock" size={16} />
            {t('secret.stored')}
        </span>
    );
    if (isStoredSecret(value)) {
        return (
            <div class="hdl-setup-input-row">
                <input
                    id={id}
                    type="text"
                    class={`${inputClass(width, true)} hdl-setup-input--masked`}
                    value={t('secret.masked')}
                    readOnly
                    disabled={disabled}
                    aria-describedby={describedBy}
                />
                <Button variant="tertiary" icon="edit" disabled={disabled} onClick={() => onReplace('')}>{t('secret.replace')}</Button>
                {note}
            </div>
        );
    }
    return (
        <div class="hdl-setup-input-row">
            <input
                id={id}
                type="password"
                class={inputClass(width, true)}
                value={replacementOf(value)}
                disabled={disabled}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                autocomplete="new-password"
                onInput={(event) => onReplace(event.currentTarget.value)}
                onBlur={onBlur}
            />
            {onKeep === undefined ? null : (
                <Button variant="tertiary" disabled={disabled} onClick={onKeep}>{t('secret.keep')}</Button>
            )}
            {note}
        </div>
    );
}
