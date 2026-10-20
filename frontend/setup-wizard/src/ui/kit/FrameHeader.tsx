/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The top of the wizard: its glyph, where it sits in the admin menu, its title, a link to the advanced settings and
 * Close. Both ways out go through `onLeave`, which asks before unsaved changes are lost; the advanced settings link
 * stays a real link (it can be opened in a new tab, which loses nothing).
 */
import type { JSX } from 'preact';
import { Icon } from './icons.tsx';

export interface FrameHeaderProps {
    /** Translated. */
    readonly breadcrumb: string;
    /** Translated. */
    readonly title: string;
    /** The advanced settings at the current scope; no link when null. */
    readonly advanced: { readonly label: string; readonly href: string | null };
    /** Where Close leads; no button when null. */
    readonly close: { readonly label: string; readonly href: string | null };
    readonly onLeave: (href: string) => void;
}

/** A plain click on a link; anything else (a new tab, a download) is left to the browser. */
const isPlainClick = (event: MouseEvent): boolean =>
    event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

export function FrameHeader({ breadcrumb, title, advanced, close, onLeave }: FrameHeaderProps): JSX.Element {
    const advancedHref = advanced.href;
    const closeHref = close.href;
    return (
        <div class="hdl-setup-header">
            <div class="hdl-setup-header__brand">
                <span class="hdl-setup-header__tile"><Icon name="monitoring" size={26} /></span>
                <div class="hdl-setup-header__titles">
                    <div class="hdl-setup-header__crumb">{breadcrumb}</div>
                    <h1 class="hdl-setup-header__title">{title}</h1>
                </div>
            </div>
            <div class="hdl-setup-header__actions">
                {advancedHref === null ? null : (
                    <a
                        class="hdl-setup-button hdl-setup-button--quiet hdl-setup-button--anchor"
                        href={advancedHref}
                        onClick={(event) => {
                            if (isPlainClick(event)) {
                                event.preventDefault();
                                onLeave(advancedHref);
                            }
                        }}
                    >
                        <Icon name="tune" size={18} />
                        {advanced.label}
                    </a>
                )}
                {closeHref === null ? null : (
                    <button type="button" class="hdl-setup-close" aria-label={close.label} onClick={() => onLeave(closeHref)}>
                        <Icon name="close" size={22} />
                    </button>
                )}
            </div>
        </div>
    );
}
