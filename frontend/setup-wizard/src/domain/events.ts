/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The events setting: which known events are sent, and which channel each one uses.
 *
 * A selection holds only what differs from "on, through the browser": the events switched off, and the events
 * routed to `server` or `both`. Events whose channel is fixed (only the browser can see them, they never happen in a
 * browser, or their registration always sends them both ways) carry no routing, and names the catalogue does not know are dropped: entries stored for a removed
 * module stay in the store untouched, but take no part in what the wizard shows or compares.
 *
 * Presets are not stored either. A selection "is" a preset when it equals what applying that preset produces;
 * otherwise it is custom.
 */
import type { Brand } from './brand.ts';
import { failure, success, type Result } from './result.ts';

export type EventName = Brand<string, 'EventName'>;
export type PresetKey = Brand<string, 'PresetKey'>;
export type Channel = 'browser' | 'server' | 'both';
export type RoutedChannel = Exclude<Channel, 'browser'>;
/** An event whose channel the registration fixes: only the browser sees it, only the server does, or both always send it. */
export type FixedChannel = Channel;

const EVENT_NAME = /^[A-Za-z0-9_]+$/;
const PRESET_KEY = /^[a-z0-9_]+$/;

/** What `presetOf` answers when the selection matches no preset; no preset may use it as its key. */
export const CUSTOM_PRESET = 'custom';

export const isEventName = (raw: string): raw is EventName => EVENT_NAME.test(raw);
export const isPresetKey = (raw: string): raw is PresetKey => PRESET_KEY.test(raw) && raw !== CUSTOM_PRESET;

const CHANNELS: ReadonlySet<string> = new Set<Channel>(['browser', 'server', 'both']);
export const isChannel = (raw: string): raw is Channel => CHANNELS.has(raw);

/** For names the code itself spells; throws on a malformed one. */
export function requireEventName(raw: string): EventName {
    if (!isEventName(raw)) {
        throw new RangeError(`Not an event name: ${raw}`);
    }
    return raw;
}

export interface CatalogueEvent {
    readonly name: EventName;
    /** Translated by the server, like `group`, `trigger` and `source`: shown, never compared. */
    readonly label: string;
    readonly group: string;
    /** A stable code for the group, for choosing a glyph; absent when the registration gives none. */
    readonly groupCode?: string;
    readonly trigger: string;
    readonly source: string;
    readonly sourceCode?: string;
    readonly browserOriginated: boolean;
    readonly fixedChannel: FixedChannel | null;
}

export interface EventCatalogue {
    /** Every known event, in the order the server listed them. */
    readonly events: readonly CatalogueEvent[];
    get(name: EventName): CatalogueEvent | undefined;
}

export function createEventCatalogue(events: readonly CatalogueEvent[]): Result<EventCatalogue, EventName> {
    const byName = new Map<EventName, CatalogueEvent>();
    for (const event of events) {
        if (byName.has(event.name)) {
            return failure(event.name);
        }
        byName.set(event.name, event);
    }
    return success(Object.freeze({
        events: Object.freeze([...events]),
        get: (name: EventName): CatalogueEvent | undefined => byName.get(name),
    }));
}

export interface EventPreset {
    readonly key: PresetKey;
    readonly label: string;
    readonly description: string;
    /** A glyph name the admin may draw; an unknown one falls back to a generic glyph. */
    readonly icon?: string;
    readonly events: ReadonlySet<EventName>;
}

export interface EventSelection {
    readonly off: ReadonlySet<EventName>;
    readonly channels: ReadonlyMap<EventName, RoutedChannel>;
}

export type EventRefusal = 'unknown_event' | 'fixed_channel';

/** Builds a selection, dropping unknown names, routing of fixed-channel events and `browser` routes. */
export function selectionOf(
    catalogue: EventCatalogue,
    off: Iterable<EventName>,
    channels: Iterable<readonly [EventName, Channel]>,
): EventSelection {
    const offSet = new Set<EventName>();
    for (const name of off) {
        if (catalogue.get(name) !== undefined) {
            offSet.add(name);
        }
    }
    const routed = new Map<EventName, RoutedChannel>();
    for (const [name, channel] of channels) {
        const event = catalogue.get(name);
        if (event !== undefined && event.fixedChannel === null && channel !== 'browser') {
            routed.set(name, channel);
        }
    }
    return Object.freeze({ off: offSet, channels: routed });
}

export function sameSelection(a: EventSelection, b: EventSelection): boolean {
    if (a.off.size !== b.off.size || a.channels.size !== b.channels.size) {
        return false;
    }
    for (const name of a.off) {
        if (!b.off.has(name)) {
            return false;
        }
    }
    for (const [name, channel] of a.channels) {
        if (b.channels.get(name) !== channel) {
            return false;
        }
    }
    return true;
}

export const isOn = (selection: EventSelection, name: EventName): boolean => !selection.off.has(name);

/** The routing of the events a selection sends; an event switched off keeps its routing, but nothing uses it. */
function sentRouting(selection: EventSelection): ReadonlyMap<EventName, RoutedChannel> {
    return new Map([...selection.channels].filter(([name]) => isOn(selection, name)));
}

/**
 * Whether two selections send the same: the same events off, and the same channel for every event that is sent.
 * Unlike `sameSelection`, routing kept for an event that is off does not count, since nothing is sent through it.
 */
export function sameEffect(a: EventSelection, b: EventSelection): boolean {
    return sameSelection(
        { off: a.off, channels: sentRouting(a) },
        { off: b.off, channels: sentRouting(b) },
    );
}

/** The channel an event uses: its fixed channel, its routing, or the browser. */
export function channelOf(catalogue: EventCatalogue, selection: EventSelection, name: EventName): Channel {
    return catalogue.get(name)?.fixedChannel ?? selection.channels.get(name) ?? 'browser';
}

/** Switch a known event on or off; its routing is kept for when it is switched back on. */
export function toggle(
    catalogue: EventCatalogue,
    selection: EventSelection,
    name: EventName,
): Result<EventSelection, EventRefusal> {
    if (catalogue.get(name) === undefined) {
        return failure('unknown_event');
    }
    const off = new Set(selection.off);
    if (off.has(name)) {
        off.delete(name);
    } else {
        off.add(name);
    }
    return success(Object.freeze({ off, channels: selection.channels }));
}

/** Choose the channel of a known event whose channel is not fixed. */
export function route(
    catalogue: EventCatalogue,
    selection: EventSelection,
    name: EventName,
    channel: Channel,
): Result<EventSelection, EventRefusal> {
    const event = catalogue.get(name);
    if (event === undefined) {
        return failure('unknown_event');
    }
    if (event.fixedChannel !== null) {
        return failure('fixed_channel');
    }
    const others = [...selection.channels].filter(([routed]) => routed !== name);
    return success(selectionOf(catalogue, selection.off, [...others, [name, channel]]));
}

/** Every known event outside the preset is switched off, and every event goes through the browser. */
export function applyPreset(catalogue: EventCatalogue, preset: EventPreset): EventSelection {
    return selectionOf(
        catalogue,
        catalogue.events.filter((event) => !preset.events.has(event.name)).map((event) => event.name),
        [],
    );
}

/**
 * The first preset whose events the selection sends, through the channels the preset gives them, or `custom`.
 * Routing kept for an event that is switched off does not make a selection custom.
 */
export function presetOf(
    catalogue: EventCatalogue,
    selection: EventSelection,
    presets: readonly EventPreset[],
): PresetKey | typeof CUSTOM_PRESET {
    return presets.find((preset) => sameEffect(applyPreset(catalogue, preset), selection))?.key ?? CUSTOM_PRESET;
}

/** Known events that are sent. */
export function sentCount(catalogue: EventCatalogue, selection: EventSelection): number {
    return catalogue.events.filter((event) => isOn(selection, event.name)).length;
}

function onAndNotBrowser(catalogue: EventCatalogue, selection: EventSelection): readonly EventName[] {
    return catalogue.events
        .filter((event) => isOn(selection, event.name) && channelOf(catalogue, selection, event.name) !== 'browser')
        .map((event) => event.name);
}

/** Events sent that the server sends (alone or as well as the browser), fixed ones included. */
export function fromServerCount(catalogue: EventCatalogue, selection: EventSelection): number {
    return onAndNotBrowser(catalogue, selection).length;
}

/** Events sent by both channels: counted twice unless the container deduplicates them. Catalogue order. */
export function doubleCounted(catalogue: EventCatalogue, selection: EventSelection): readonly EventName[] {
    return catalogue.events
        .filter((event) => isOn(selection, event.name) && channelOf(catalogue, selection, event.name) === 'both')
        .map((event) => event.name);
}

/**
 * Events that need the server to send them while nothing delivers from the server: they would never reach
 * Google from that channel. Catalogue order.
 */
export function serverWithoutDelivery(
    catalogue: EventCatalogue,
    selection: EventSelection,
    delivery: { readonly on: boolean },
): readonly EventName[] {
    return delivery.on ? [] : onAndNotBrowser(catalogue, selection);
}
