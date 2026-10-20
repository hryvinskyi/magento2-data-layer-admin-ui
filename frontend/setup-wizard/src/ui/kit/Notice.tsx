/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Messages in four tones, each with its own glyph so the tone never rests on colour alone:
 *
 * - a message strip sits under the step heading and may carry one action ("Skip to Connect");
 * - a notice sits among the fields (a warning about double counting, an informational note); a muted notice is an
 *   informational aside on a grey ground (why a preview shows no event, why the controls below cannot be changed).
 *   A notice may carry one action too ("Override here").
 *
 * Warnings and errors are announced the moment they appear (`alert`); a success is announced politely (`status`);
 * an informational note is plain text. `role` overrides that.
 */
import type { ComponentChildren, JSX } from 'preact';
import { Button } from './Button.tsx';
import { Icon, type IconName } from './icons.tsx';

export type Tone = 'info' | 'success' | 'warning' | 'error';
export type MessageRole = 'alert' | 'status' | 'none';

const TONE_ICON = {
    info: 'info',
    success: 'check_circle',
    warning: 'warning',
    error: 'error',
} as const satisfies Record<Tone, IconName>;

const TONE_ROLE = {
    info: 'none',
    success: 'status',
    warning: 'alert',
    error: 'alert',
} as const satisfies Record<Tone, MessageRole>;

const roleAttribute = (role: MessageRole): 'alert' | 'status' | undefined => (role === 'none' ? undefined : role);

export interface MessageAction {
    /** Translated. */
    readonly label: string;
    readonly onClick: () => void;
    /** In progress: the action does nothing when pressed and is marked busy. */
    readonly busy?: boolean | undefined;
}

export interface MessageStripProps {
    readonly tone: Tone;
    readonly action?: MessageAction | undefined;
    readonly role?: MessageRole | undefined;
    readonly children: ComponentChildren;
}

export function MessageStrip({ tone, action, role, children }: MessageStripProps): JSX.Element {
    return (
        <div class="hdl-setup-strip" data-tone={tone} role={roleAttribute(role ?? TONE_ROLE[tone])}>
            <Icon name={TONE_ICON[tone]} size={22} filled class="hdl-setup-strip__icon" />
            <div class="hdl-setup-strip__text">{children}</div>
            {action === undefined ? null : <Button variant="tertiary" onClick={action.onClick} busy={action.busy}>{action.label}</Button>}
        </div>
    );
}

export interface NoticeProps {
    readonly tone: Tone;
    readonly role?: MessageRole | undefined;
    /** A glyph other than the tone's own (`visibility_off` for a preview that shows no price). */
    readonly icon?: IconName | undefined;
    /** Drawn on a grey ground, as an aside rather than a message. */
    readonly muted?: boolean | undefined;
    readonly action?: MessageAction | undefined;
    readonly children: ComponentChildren;
}

export function Notice({ tone, role, icon, muted = false, action, children }: NoticeProps): JSX.Element {
    return (
        <div
            class={muted ? 'hdl-setup-notice hdl-setup-notice--muted' : 'hdl-setup-notice'}
            data-tone={tone}
            role={roleAttribute(role ?? TONE_ROLE[tone])}
        >
            <Icon name={icon ?? TONE_ICON[tone]} size={20} filled={icon === undefined} class="hdl-setup-notice__icon" />
            <div class="hdl-setup-notice__text">{children}</div>
            {action === undefined ? null : (
                <div class="hdl-setup-notice__action">
                    <Button variant="tertiary" onClick={action.onClick} busy={action.busy}>{action.label}</Button>
                </div>
            )}
        </div>
    );
}
