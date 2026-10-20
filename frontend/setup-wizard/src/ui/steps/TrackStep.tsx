/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The "What to track" step: which events are sent, and through which channel.
 *
 * Preset cards apply a whole selection at once; the events table fine-tunes single events. A selection that equals
 * no preset shows an extra "Custom" card, selected and not choosable. Applying a preset replaces the whole table,
 * so the cards are chosen deliberately: the arrow keys only move focus between them (the Custom card included), and
 * Space, Enter or a click applies the focused one. Under the table, two warnings: events both channels send
 * (counted twice) and events routed to a server channel while nothing delivers from the server.
 *
 * Where the selection comes from is shown at the top, never only under the long table: while it cannot be changed
 * here (inherited, or fixed by the deployment configuration), a line above the preset cards says why and offers
 * "Override here"; while it can, the table's head shows the origin beside its title with "Use inherited value".
 *
 * Everything is read and changed through the events setting; which events are counted, which are fixed and what a
 * preset sets are the events domain's.
 */
import type { JSX } from 'preact';
import {
    applyPreset,
    Badge,
    channelOf,
    CUSTOM_PRESET,
    doubleCounted,
    fromServerCount,
    Icon,
    iconOr,
    isChannel,
    isOn,
    MessageStrip,
    Notice,
    OriginLine,
    OriginNotice,
    SelectInput,
    sentCount,
    serverWithoutDelivery,
    Switch,
    useEventsSetting,
    useServerDelivery,
    useStepNavigation,
    useT,
    type CatalogueEvent,
    type Channel,
    type EventPreset,
    type EventsSettingBinding,
    type StepBehaviour,
} from '@hryvinskyi/datalayer-setup';
import { presetName } from '../review-values.ts';
import { groupEvents, groupGlyph, sourceGlyph, type EventGroup } from './event-table.ts';

const PRESET_GROUP_NAME = 'hdl-setup-preset';

/** How far each arrow key moves focus among the preset cards. */
const ARROW_STEP: ReadonlyMap<string, number> = new Map([
    ['ArrowRight', 1],
    ['ArrowDown', 1],
    ['ArrowLeft', -1],
    ['ArrowUp', -1],
]);

/**
 * Moves focus to the neighbouring card's radio without choosing it: a native radio group would choose the neighbour
 * as it moves. Enter chooses the focused card (Space and clicks do so natively).
 */
function onPresetKey(event: KeyboardEvent, choose: () => void): void {
    if (event.key === 'Enter') {
        event.preventDefault();
        choose();
        return;
    }
    const step = ARROW_STEP.get(event.key);
    const input = event.currentTarget;
    const group = input instanceof HTMLElement ? input.closest('[role="radiogroup"]') : null;
    if (step === undefined || group === null) {
        return;
    }
    event.preventDefault();
    const radios = [...group.querySelectorAll<HTMLInputElement>('input[type="radio"]:not(:disabled)')];
    const index = radios.findIndex((radio) => radio === input);
    radios[(index + step + radios.length) % radios.length]?.focus();
}

/** The phrase keys each channel is spoken with: as a choice, as a fixed badge, and the badge's explanation. */
const CHANNEL_PHRASES = {
    browser: { choice: 'channel.browser', fixed: 'channel.fixed.browser', hint: 'channel.fixed.browser.hint' },
    server: { choice: 'channel.server', fixed: 'channel.fixed.server', hint: 'channel.fixed.server.hint' },
    both: { choice: 'channel.both', fixed: 'channel.fixed.both', hint: 'channel.fixed.both.hint' },
} as const satisfies Record<Channel, { readonly choice: string; readonly fixed: string; readonly hint: string }>;

const CHANNELS: readonly Channel[] = ['browser', 'server', 'both'];

interface PresetCardProps {
    readonly label: string;
    readonly description: string;
    /** A glyph name; one the kit does not draw becomes a generic glyph. */
    readonly icon: string | undefined;
    readonly eventCount: number;
    readonly idStem: string;
    readonly selected: boolean;
    readonly disabled: boolean;
    /** Shown and reachable, but never chosen (the Custom card). */
    readonly unchoosable?: boolean;
    readonly custom?: boolean;
    readonly onChoose: () => void;
}

function PresetCard({
    label,
    description,
    icon,
    eventCount,
    idStem,
    selected,
    disabled,
    unchoosable = false,
    custom = false,
    onChoose,
}: PresetCardProps): JSX.Element {
    const { tn } = useT();
    const labelId = `${idStem}-label`;
    const descriptionId = `${idStem}-description`;
    return (
        <label
            class="hdl-setup-preset"
            data-selected={selected ? 'true' : 'false'}
            data-custom={custom ? 'true' : 'false'}
            aria-disabled={disabled || unchoosable ? true : undefined}
        >
            <span class="hdl-setup-preset__top">
                <span class="hdl-setup-preset__tile"><Icon name={iconOr(icon, 'tune')} size={22} /></span>
                <input
                    type="radio"
                    class="hdl-setup-preset__radio"
                    name={PRESET_GROUP_NAME}
                    checked={selected}
                    disabled={disabled}
                    aria-disabled={unchoosable ? true : undefined}
                    aria-labelledby={labelId}
                    aria-describedby={descriptionId}
                    onChange={unchoosable ? undefined : onChoose}
                    onKeyDown={(event) => onPresetKey(event, unchoosable ? () => undefined : onChoose)}
                />
            </span>
            <span id={labelId} class="hdl-setup-preset__label">{label}</span>
            <span id={descriptionId} class="hdl-setup-preset__description">{description}</span>
            <span class="hdl-setup-preset__foot">
                {tn(selected ? 'preset.events_selected' : 'preset.events', eventCount)}
            </span>
        </label>
    );
}

function Presets({ events }: { readonly events: EventsSettingBinding }): JSX.Element {
    const { t } = useT();
    const { catalogue, selection, presetKey } = events;
    const disabled = !events.editable;
    return (
        <div role="radiogroup" aria-label={t('track.presets')} class="hdl-setup-presets">
            {events.presets.map((preset: EventPreset) => (
                <PresetCard
                    key={preset.key}
                    label={preset.label}
                    description={preset.description}
                    icon={preset.icon}
                    eventCount={sentCount(catalogue, applyPreset(catalogue, preset))}
                    idStem={`${PRESET_GROUP_NAME}-${preset.key}`}
                    selected={presetKey === preset.key}
                    disabled={disabled}
                    onChoose={() => events.applyPreset(preset.key)}
                />
            ))}
            {presetKey === CUSTOM_PRESET ? (
                <PresetCard
                    label={t('preset.custom')}
                    description={t('preset.custom.description')}
                    icon={undefined}
                    eventCount={sentCount(catalogue, selection)}
                    idStem={`${PRESET_GROUP_NAME}-${CUSTOM_PRESET}`}
                    selected
                    disabled={disabled}
                    unchoosable
                    custom
                    onChoose={() => undefined}
                />
            ) : null}
        </div>
    );
}

interface EventRowProps {
    readonly event: CatalogueEvent;
    readonly events: EventsSettingBinding;
}

function ChannelCell({ event, events }: EventRowProps): JSX.Element {
    const { t } = useT();
    const { catalogue, selection } = events;
    const fixed = event.fixedChannel;
    if (fixed !== null) {
        const phrases = CHANNEL_PHRASES[fixed];
        return <Badge variant="fixed" title={t(phrases.hint)}>{t(phrases.fixed)}</Badge>;
    }
    return (
        <SelectInput
            compact
            width="full"
            value={channelOf(catalogue, selection, event.name)}
            options={CHANNELS.map((channel) => ({ value: channel, label: t(CHANNEL_PHRASES[channel].choice) }))}
            disabled={!events.editable || !isOn(selection, event.name)}
            label={t('track.channel_for', event.name)}
            onChange={(value) => {
                if (isChannel(value)) {
                    events.route(event.name, value);
                }
            }}
        />
    );
}

function EventRow({ event, events }: EventRowProps): JSX.Element {
    const { t } = useT();
    const on = isOn(events.selection, event.name);
    return (
        <div class="hdl-setup-table__row" role="row" data-off={on ? 'false' : 'true'}>
            <div class="hdl-setup-events__code" role="cell">{event.name}</div>
            <div class="hdl-setup-events__trigger" role="cell">{event.trigger}</div>
            <div role="cell">
                <Badge variant="source" icon={sourceGlyph(event.sourceCode)}>{event.source}</Badge>
            </div>
            <div role="cell">
                <Switch
                    size="small"
                    checked={on}
                    disabled={!events.editable}
                    label={t('track.send_event', event.name)}
                    onChange={() => events.toggle(event.name)}
                />
            </div>
            <div role="cell"><ChannelCell event={event} events={events} /></div>
        </div>
    );
}

function GroupRows({ group, events }: { readonly group: EventGroup; readonly events: EventsSettingBinding }): JSX.Element {
    const { t, n } = useT();
    return (
        <div role="rowgroup">
            <div class="hdl-setup-table__group" role="row">
                <Icon name={groupGlyph(group.code)} size={18} />
                <span role="rowheader">{group.label}</span>
                <span role="cell" class="hdl-setup-table__group-count">
                    {t('track.group.count', n(group.sent), n(group.events.length))}
                </span>
            </div>
            {group.events.map((event) => <EventRow key={event.name} event={event} events={events} />)}
        </div>
    );
}

function EventsTable({ events }: { readonly events: EventsSettingBinding }): JSX.Element {
    const { t, tn, n } = useT();
    const { catalogue, selection } = events;
    const groups = groupEvents(catalogue, selection);
    return (
        <div class="hdl-setup-table hdl-setup-events">
            <div class="hdl-setup-table__head">
                <div class="hdl-setup-table__title">
                    <span class="hdl-setup-card__tile"><Icon name="checklist" size={20} /></span>
                    <h3>{t('track.events')}</h3>
                    {events.editable ? <OriginLine origin={events.origin} onInherit={events.inherit} /> : null}
                </div>
                <div class="hdl-setup-table__counters" role="status" aria-label={t('track.events')}>
                    <span class="hdl-setup-counter hdl-setup-counter--sent">
                        {t('track.sent', n(sentCount(catalogue, selection)), n(catalogue.events.length))}
                    </span>
                    <span class="hdl-setup-counter">{tn('track.from_server', fromServerCount(catalogue, selection))}</span>
                </div>
            </div>
            <div class="hdl-setup-table__body" role="table" aria-label={t('track.events')} aria-disabled={events.editable ? undefined : true}>
                <div class="hdl-setup-table__header" role="row">
                    <div role="columnheader">{t('track.column.event')}</div>
                    <div role="columnheader">{t('track.column.trigger')}</div>
                    <div role="columnheader">{t('track.column.source')}</div>
                    <div role="columnheader">{t('track.column.send')}</div>
                    <div role="columnheader">{t('track.column.channel')}</div>
                </div>
                {groups.map((group) => <GroupRows key={group.key} group={group} events={events} />)}
            </div>
        </div>
    );
}

function Warnings({ events }: { readonly events: EventsSettingBinding }): JSX.Element | null {
    const { t, n, list } = useT();
    const delivery = useServerDelivery();
    const navigation = useStepNavigation();
    const { catalogue, selection } = events;
    const twice = doubleCounted(catalogue, selection);
    const undelivered = serverWithoutDelivery(catalogue, selection, delivery);
    const target = navigation.steps.find((view) => view.step.id === delivery.stepId);
    if (twice.length === 0 && undelivered.length === 0) {
        return null;
    }
    return (
        <>
            {twice.length === 0 ? null : <Notice tone="warning">{t('warning.both', list(twice))}</Notice>}
            {undelivered.length === 0 ? null : (
                <MessageStrip
                    tone="warning"
                    {...(target === undefined
                        ? {}
                        : { action: { label: t('action.go_to_step', n(target.number)), onClick: () => navigation.visit(target.step.id) } })}
                >
                    {t('warning.server_off', list(undelivered))}
                </MessageStrip>
            )}
        </>
    );
}

export function TrackStep(): JSX.Element {
    const events = useEventsSetting();
    return (
        <>
            <OriginNotice origin={events.origin} onOverride={events.override} inheritedPhrase="track.explain.inherited" />
            <Presets events={events} />
            <EventsTable events={events} />
            <Warnings events={events} />
        </>
    );
}

/**
 * What this step contributes when the shell registers it: the step, a summary naming the preset the selection
 * equals and how many events it sends, and a "Needs attention" mark while either warning under the table applies.
 */
export const trackStep: StepBehaviour = {
    component: TrackStep,
    summary: ({ view, t: translator }) => {
        const events = { catalogue: view.eventCatalogue(), presets: view.eventPresets() };
        const selection = view.events();
        return translator.tn('summary.track', sentCount(events.catalogue, selection), presetName(events, selection, translator));
    },
    attention: ({ view, delivery }) => {
        const catalogue = view.eventCatalogue();
        const selection = view.events();
        return doubleCounted(catalogue, selection).length > 0
            || serverWithoutDelivery(catalogue, selection, delivery).length > 0;
    },
};
