/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * How the events table is laid out: the catalogue's events gathered into their groups, in the order the catalogue
 * lists them, and the glyph each group and each source is drawn with.
 *
 * Glyphs are chosen by the stable codes the catalogue carries beside its translated texts, never by the texts
 * themselves (they change with the admin's language). A group or source without a code, or with a code this table
 * has no glyph for, gets a generic glyph.
 */
import { isOn, type CatalogueEvent, type EventCatalogue, type EventSelection, type IconName } from '@hryvinskyi/datalayer-setup';

export interface EventGroup {
    /** Identifies the group among the table's groups: its code, or its text when the catalogue gave no code. */
    readonly key: string;
    /** Translated, as the server sent it. */
    readonly label: string;
    readonly code?: string;
    readonly events: readonly CatalogueEvent[];
    /** Events of the group that are sent. */
    readonly sent: number;
}

export const GENERIC_GROUP_GLYPH: IconName = 'category';
export const GENERIC_SOURCE_GLYPH: IconName = 'label';

const GROUP_GLYPHS: ReadonlyMap<string, IconName> = new Map<string, IconName>([
    ['browsing', 'storefront'],
    ['cart', 'shopping_cart'],
    ['checkout', 'point_of_sale'],
    ['account', 'person'],
]);

const SOURCE_GLYPHS: ReadonlyMap<string, IconName> = new Map<string, IconName>([
    ['page', 'description'],
    ['list', 'view_list'],
    ['click', 'touch_app'],
    ['server', 'dns'],
    ['order', 'receipt_long'],
]);

export function groupGlyph(code: string | undefined): IconName {
    return (code === undefined ? undefined : GROUP_GLYPHS.get(code)) ?? GENERIC_GROUP_GLYPH;
}

export function sourceGlyph(code: string | undefined): IconName {
    return (code === undefined ? undefined : SOURCE_GLYPHS.get(code)) ?? GENERIC_SOURCE_GLYPH;
}

/** The catalogue's events by group, groups and events in catalogue order, each group counting what is sent. */
export function groupEvents(catalogue: EventCatalogue, selection: EventSelection): readonly EventGroup[] {
    const gathered = new Map<string, { label: string; code: string | undefined; events: CatalogueEvent[] }>();
    for (const event of catalogue.events) {
        const key = event.groupCode ?? event.group;
        const group = gathered.get(key) ?? { label: event.group, code: event.groupCode, events: [] };
        group.events.push(event);
        gathered.set(key, group);
    }
    return [...gathered].map(([key, group]): EventGroup => ({
        key,
        label: group.label,
        ...(group.code === undefined ? {} : { code: group.code }),
        events: group.events,
        sent: group.events.filter((event) => isOn(selection, event.name)).length,
    }));
}
