/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * One field as every step shows it: the label with the narrowest scope the setting can be set at, the help line,
 * the control, an inline problem, and the origin line — where the value comes from here, with the one action that
 * changes it ("Override here" on an inherited value, "Use inherited value" on an own one).
 *
 * `SettingField` binds the row to a setting from `useSetting()`: label, scope tag, origin, actions and the problem
 * message come from the binding, and the control gets the id, disabled state, problem flag, description ids and
 * the blur handler that marks the field touched.
 */
import type { ComponentChildren, JSX } from 'preact';
import type { FieldOrigin } from '../../domain/origin.ts';
import type { ScopeType } from '../../domain/scope.ts';
import { useT } from '../hooks/use-runtime.ts';
import type { SettingBinding } from '../hooks/use-setting.ts';
import { Icon } from './icons.tsx';
import { OriginLine } from './OriginLine.tsx';

/** The ids of a field's parts, from the id of its control. */
export interface FieldIds {
    readonly control: string;
    readonly label: string;
    readonly help: string;
    readonly error: string;
}

export function fieldIds(controlId: string): FieldIds {
    return { control: controlId, label: `${controlId}-label`, help: `${controlId}-help`, error: `${controlId}-error` };
}

/** The `aria-describedby` of a control: its help line and its problem, those that are shown. */
export function describedBy(controlId: string, parts: { readonly help: boolean; readonly error: boolean }): string | undefined {
    const ids = fieldIds(controlId);
    const list = [parts.help ? ids.help : null, parts.error ? ids.error : null].filter((id) => id !== null);
    return list.length === 0 ? undefined : list.join(' ');
}

export interface FieldRowProps {
    /** The id of the control the label names. */
    readonly controlId: string;
    /** Translated (a setting's label comes translated from the server). */
    readonly label: string;
    /** The narrowest scope the setting can be set at, shown as a tag next to the label. */
    readonly reach: ScopeType;
    readonly origin: FieldOrigin;
    readonly onOverride: () => void;
    readonly onInherit: () => void;
    /** Translated. */
    readonly help?: string | undefined;
    /** The problem to show, translated; null or left out shows none. */
    readonly error?: string | null | undefined;
    /**
     * Whether the label is a `<label for>` (inputs, selects, switches). A control that names itself — a radio group
     * with its own label — gets a plain caption instead.
     */
    readonly labelFor?: boolean | undefined;
    readonly children: ComponentChildren;
}

export function FieldRow({
    controlId,
    label,
    reach,
    origin,
    onOverride,
    onInherit,
    help,
    error,
    labelFor = true,
    children,
}: FieldRowProps): JSX.Element {
    const { t } = useT();
    const ids = fieldIds(controlId);

    return (
        <div class="hdl-setup-field" data-origin={origin.kind}>
            <div class="hdl-setup-field__head">
                {labelFor
                    ? <label id={ids.label} for={ids.control} class="hdl-setup-field__label">{label}</label>
                    : <span id={ids.label} class="hdl-setup-field__label">{label}</span>}
                <span class="hdl-setup-field__tag">{t(`field.reach.${reach}`)}</span>
            </div>
            {help === undefined ? null : <div id={ids.help} class="hdl-setup-field__help">{help}</div>}
            {children}
            {error === undefined || error === null ? null : (
                <div id={ids.error} class="hdl-setup-field__error" role="alert">
                    <Icon name="error" size={16} filled />
                    {error}
                </div>
            )}
            <OriginLine origin={origin} onOverride={onOverride} onInherit={onInherit} />
        </div>
    );
}

/** What `SettingField` hands its control. */
export interface FieldControl {
    readonly id: string;
    /** Locked, out of reach, or inherited until overridden. */
    readonly disabled: boolean;
    /** A problem is shown. */
    readonly invalid: boolean;
    readonly describedBy: string | undefined;
    /** Marks the field touched, so its problems show. */
    readonly onBlur: () => void;
}

export interface SettingFieldProps {
    readonly setting: SettingBinding;
    /** Translated. */
    readonly help?: string | undefined;
    /** Replaces the setting's own label (translated). */
    readonly label?: string | undefined;
    readonly labelFor?: boolean | undefined;
    readonly children: (control: FieldControl) => ComponentChildren;
}

/** The id a setting's control gets, so labels, tests and links can name it. */
export const settingControlId = (key: string): string => `hdl-setup-field-${key}`;

export function SettingField({ setting, help, label, labelFor = true, children }: SettingFieldProps): JSX.Element {
    const translator = useT();
    const key = setting.definition.key;
    const id = settingControlId(key);
    const error = setting.error === null ? null : translator.issue(key, setting.error);
    return (
        <FieldRow
            controlId={id}
            label={label ?? setting.definition.label}
            reach={setting.definition.reach}
            origin={setting.origin}
            onOverride={setting.override}
            onInherit={setting.inherit}
            {...(help === undefined ? {} : { help })}
            error={error}
            labelFor={labelFor}
        >
            {children({
                id,
                disabled: !setting.editable,
                invalid: error !== null,
                describedBy: describedBy(id, { help: help !== undefined, error: error !== null }),
                onBlur: setting.touch,
            })}
        </FieldRow>
    );
}
