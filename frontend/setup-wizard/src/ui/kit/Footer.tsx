/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The bar pinned to the bottom of the wizard: Back, what is still unsaved (a live region, so a person hears the
 * count change and the save result), and the step's primary action. All texts arrive translated.
 */
import type { JSX } from 'preact';
import { Icon, type IconName } from './icons.tsx';

export interface FooterProps {
    readonly back: { readonly label: string; readonly onClick: () => void; readonly disabled: boolean };
    readonly status: {
        /** "2 unsaved changes", "All changes saved" … */
        readonly text: string;
        /** A note after the text ("saved with Save all in the last step"). */
        readonly note?: string | undefined;
        /** Whether something would be lost by leaving: drawn as an edit glyph in the accent colour. */
        readonly dirty: boolean;
    };
    readonly primary: {
        readonly label: string;
        readonly icon: IconName;
        readonly onClick: () => void;
        readonly disabled: boolean;
        /** In progress: does nothing when pressed, marked busy, keeps focus. */
        readonly busy: boolean;
    };
}

export function Footer({ back, status, primary }: FooterProps): JSX.Element {
    return (
        <div class="hdl-setup-footer">
            <button type="button" class="hdl-setup-button hdl-setup-button--secondary" onClick={back.onClick} disabled={back.disabled}>
                <Icon name="arrow_back" size={18} />
                {back.label}
            </button>
            <div class="hdl-setup-footer__status" role="status" data-dirty={status.dirty ? 'true' : 'false'}>
                <Icon name={status.dirty ? 'edit_note' : 'cloud_done'} size={20} />
                <span class="hdl-setup-footer__text">{status.text}</span>
                {status.note === undefined ? null : <span class="hdl-setup-footer__note">{status.note}</span>}
            </div>
            <button
                type="button"
                class="hdl-setup-button hdl-setup-button--primary"
                onClick={primary.busy ? undefined : primary.onClick}
                disabled={primary.disabled && !primary.busy}
                aria-busy={primary.busy ? true : undefined}
                aria-disabled={primary.busy ? true : undefined}
            >
                {primary.label}
                <Icon name={primary.icon} size={18} />
            </button>
        </div>
    );
}
