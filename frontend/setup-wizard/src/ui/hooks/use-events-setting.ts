/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The events setting as one field at the current scope — which events are sent, through which channel — with the
 * same inheritance actions as any other setting, plus applying a preset, switching an event and routing it. The
 * rules (normalising a selection, what a preset sets, which channels are fixed) are the events domain's.
 */
import { eventsLockAt, eventsOwnValues } from '../../domain/draft.ts';
import {
    applyPreset,
    presetOf,
    route,
    toggle,
    type Channel,
    type CUSTOM_PRESET,
    type EventCatalogue,
    type EventName,
    type EventPreset,
    type EventSelection,
    type PresetKey,
} from '../../domain/events.ts';
import { inheritedFrom, type ValueSource } from '../../domain/inheritance.ts';
import { eventsOrigin, type FieldOrigin } from '../../domain/origin.ts';
import { DEFAULT_SCOPE } from '../../domain/scope.ts';
import { EVENTS_KEY } from '../../domain/setting.ts';
import { useWizard } from './use-wizard.ts';

export interface EventsSettingBinding {
    readonly catalogue: EventCatalogue;
    readonly presets: readonly EventPreset[];
    /** The selection that applies here once the edits apply. */
    readonly selection: EventSelection;
    readonly own: boolean;
    readonly inheritedFrom: ValueSource;
    /** Not locked, and either the default scope or already overridden here. */
    readonly editable: boolean;
    readonly lock: string | null;
    /** Where the selection comes from here, as the field's origin line shows it. */
    readonly origin: FieldOrigin;
    /** The preset the selection equals, or `custom`. */
    readonly presetKey: PresetKey | typeof CUSTOM_PRESET;
    /** Every known event outside the preset off, every event through the browser. An unknown key changes nothing. */
    applyPreset(key: PresetKey): void;
    toggle(name: EventName): void;
    route(name: EventName, channel: Channel): void;
    inherit(): void;
    override(): void;
    touch(): void;
}

export function useEventsSetting(): EventsSettingBinding {
    const { state, view, dispatch } = useWizard();
    const scope = state.scope;
    const { catalogue, presets } = state.draft.state.events;
    const selection = view.events();
    const own = view.isEventsOwn();
    const lock = eventsLockAt(state.draft, scope) ?? null;
    const select = (next: EventSelection): void => dispatch({ type: 'setEvents', scope, selection: next });

    return {
        catalogue,
        presets,
        selection,
        own,
        inheritedFrom: inheritedFrom(state.draft.state.tree, eventsOwnValues(state.draft), scope),
        editable: lock === null && (scope === DEFAULT_SCOPE || own),
        lock,
        origin: eventsOrigin(state.draft, scope),
        presetKey: presetOf(catalogue, selection, presets),
        applyPreset: (key: PresetKey): void => {
            const preset = presets.find((candidate) => candidate.key === key);
            if (preset !== undefined) {
                select(applyPreset(catalogue, preset));
            }
        },
        toggle: (name: EventName): void => {
            const toggled = toggle(catalogue, selection, name);
            if (toggled.ok) {
                select(toggled.value);
            }
        },
        route: (name: EventName, channel: Channel): void => {
            const routed = route(catalogue, selection, name, channel);
            if (routed.ok) {
                select(routed.value);
            }
        },
        inherit: (): void => dispatch({ type: 'inheritEvents', scope }),
        override: (): void => dispatch({ type: 'overrideEvents', scope }),
        touch: (): void => dispatch({ type: 'touch', key: EVENTS_KEY }),
    };
}
