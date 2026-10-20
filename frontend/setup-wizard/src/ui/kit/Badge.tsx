/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Small labels next to values:
 *
 * - `neutral`: a plain fact ("Store view").
 * - `source`: where an event comes from (with the source's glyph).
 * - `fixed`: a channel that cannot be changed (dashed, with a lock).
 * - `override`: a setting a scope overrides.
 * - `on` / `off`: whether tracking runs at a scope (with a dot, and the words say which).
 * - `recommended`: the suggested option.
 * - `code`: an identifier in monospace (a container ID, an event name).
 */
import type { ComponentChildren, JSX } from 'preact';
import { Icon, type IconName } from './icons.tsx';

export type BadgeVariant = 'neutral' | 'source' | 'fixed' | 'override' | 'on' | 'off' | 'recommended' | 'code';

export interface BadgeProps {
    readonly variant?: BadgeVariant | undefined;
    readonly icon?: IconName | undefined;
    /** A tooltip explaining the badge; also its accessible description. */
    readonly title?: string | undefined;
    readonly children: ComponentChildren;
}

const DOTTED: ReadonlySet<BadgeVariant> = new Set<BadgeVariant>(['on', 'off']);

export function Badge({ variant = 'neutral', icon, title, children }: BadgeProps): JSX.Element {
    const glyph = icon ?? (variant === 'fixed' ? 'lock' : undefined);
    return (
        <span class={`hdl-setup-badge hdl-setup-badge--${variant}`} title={title}>
            {DOTTED.has(variant) ? <span class="hdl-setup-badge__dot" aria-hidden="true" /> : null}
            {glyph === undefined ? null : <Icon name={glyph} size={14} />}
            {children}
        </span>
    );
}
