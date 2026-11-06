/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The wizard's boxes: a card groups the fields of one topic under a glyph tile and a title; a panel is the plainer
 * box of the side column (a status, a preview); columns put the fields beside such panels, and below them when the
 * wizard is narrow.
 */
import type { ComponentChildren, JSX } from 'preact';
import { Icon, type IconName } from './icons.tsx';

export interface CardProps {
    readonly icon: IconName;
    /** Translated. */
    readonly title: string;
    /** Content at the right end of the title row (a counter, a chip). */
    readonly aside?: ComponentChildren | undefined;
    readonly children: ComponentChildren;
}

export function Card({ icon, title, aside, children }: CardProps): JSX.Element {
    return (
        <div class="hui-card">
            <div class="hui-card__head">
                <span class="hui-card__tile"><Icon name={icon} size={20} /></span>
                <h3 class="hui-card__title">{title}</h3>
                {aside === undefined ? null : <div class="hui-card__aside">{aside}</div>}
            </div>
            <div class="hui-card__body">{children}</div>
        </div>
    );
}

export interface PanelProps {
    /** Translated. */
    readonly title: string;
    /** A glyph before the title. */
    readonly icon?: IconName | undefined;
    /** Announce changes of the body to assistive technology (a status that follows the fields). */
    readonly live?: boolean | undefined;
    readonly children: ComponentChildren;
}

export function Panel({ title, icon, live = false, children }: PanelProps): JSX.Element {
    return (
        <div class="hui-panel">
            <div class="hui-panel__head">
                {icon === undefined ? null : <Icon name={icon} size={20} class="hui-panel__icon" />}
                <h3 class="hui-panel__title">{title}</h3>
            </div>
            <div class="hui-panel__body" role={live ? 'status' : undefined}>{children}</div>
        </div>
    );
}

export interface ColumnsProps {
    /** The side column (340 px wide; below the main column when the wizard is narrow). */
    readonly aside?: ComponentChildren | undefined;
    readonly children: ComponentChildren;
}

export function Columns({ aside, children }: ColumnsProps): JSX.Element {
    return (
        <div class={aside === undefined ? 'hui-columns hui-columns--single' : 'hui-columns'}>
            <div class="hui-columns__main">{children}</div>
            {aside === undefined ? null : <aside class="hui-columns__aside">{aside}</aside>}
        </div>
    );
}
