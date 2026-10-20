/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The wizard's buttons and links, in the admin's button styles:
 *
 * - `primary`: the one forward action of the page (orange).
 * - `secondary`: an ordinary action (grey).
 * - `tertiary`: an action inside a message or a card (white, bordered).
 * - `quiet`: a light action in the page header (white, light border).
 * - `link`: an action that reads like a link (Override here, Skip this step).
 *
 * A busy button does nothing when pressed and says so to assistive technology (`aria-busy`, `aria-disabled`), but
 * stays focusable, so focus is not lost while the work runs; its label is the caller's ("Saving…").
 */
import type { ComponentChildren, JSX } from 'preact';
import { Icon, type IconName, type IconSize } from './icons.tsx';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'quiet' | 'link';

export interface ButtonProps {
    readonly variant?: ButtonVariant | undefined;
    /** A glyph before the text. */
    readonly icon?: IconName | undefined;
    /** A glyph after the text. */
    readonly iconEnd?: IconName | undefined;
    readonly onClick?: (() => void) | undefined;
    readonly disabled?: boolean | undefined;
    /** In progress: does nothing when pressed, marked busy, still focusable. */
    readonly busy?: boolean | undefined;
    /** The accessible name when the button shows only a glyph. */
    readonly label?: string | undefined;
    /** For a button that shows or hides a region. */
    readonly expanded?: boolean | undefined;
    readonly controls?: string | undefined;
    readonly id?: string | undefined;
    readonly children?: ComponentChildren | undefined;
}

const ICON_SIZE = {
    primary: 18,
    secondary: 18,
    tertiary: 16,
    quiet: 18,
    link: 18,
} as const satisfies Record<ButtonVariant, IconSize>;

export function Button({
    variant = 'secondary',
    icon,
    iconEnd,
    onClick,
    disabled = false,
    busy = false,
    label,
    expanded,
    controls,
    id,
    children,
}: ButtonProps): JSX.Element {
    return (
        <button
            type="button"
            id={id}
            class={`hdl-setup-button hdl-setup-button--${variant}`}
            onClick={busy || onClick === undefined ? undefined : () => onClick()}
            disabled={disabled}
            aria-busy={busy ? true : undefined}
            aria-disabled={busy && !disabled ? true : undefined}
            aria-label={label}
            aria-expanded={expanded}
            aria-controls={controls}
        >
            {icon === undefined ? null : <Icon name={icon} size={ICON_SIZE[variant]} />}
            {children}
            {iconEnd === undefined ? null : <Icon name={iconEnd} size={ICON_SIZE[variant]} />}
        </button>
    );
}

export interface ExternalLinkProps {
    readonly href: string;
    readonly variant?: 'secondary' | 'quiet' | undefined;
    readonly children: ComponentChildren;
}

/** A link to another site (Google's tools), opened in a new tab without handing it this page. */
export function ExternalLink({ href, variant = 'secondary', children }: ExternalLinkProps): JSX.Element {
    return (
        <a class={`hdl-setup-button hdl-setup-button--${variant} hdl-setup-button--anchor`} href={href} target="_blank" rel="noopener noreferrer">
            {children}
            <Icon name="open_in_new" size={16} />
        </a>
    );
}

export interface DisclosureButtonProps {
    readonly expanded: boolean;
    readonly onToggle: () => void;
    /** The id of the region it shows and hides. */
    readonly controls?: string | undefined;
    readonly children: ComponentChildren;
}

/** Shows or hides an optional part of a card ("Using a first-party or server-side GTM domain?"). */
export function DisclosureButton({ expanded, onToggle, controls, children }: DisclosureButtonProps): JSX.Element {
    return (
        <button
            type="button"
            class="hdl-setup-button hdl-setup-button--link hdl-setup-disclosure"
            aria-expanded={expanded}
            aria-controls={controls}
            onClick={onToggle}
        >
            <Icon name={expanded ? 'expand_less' : 'expand_more'} size={18} />
            {children}
        </button>
    );
}
