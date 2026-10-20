/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The "Connect" step: whether the store sends events to Google, and how its pages load Google. A card holds the
 * sending switch, the choice of loader (container, gtag.js directly, or both), and the IDs that choice needs;
 * beside it a panel states what the store will output with the values as they stand, down to the script address.
 *
 * The mode is derived from the IDs and only picked here: choosing one that leaves an ID out empties that ID at the
 * current scope, so a mode cannot be picked while the ID it would empty cannot be changed here. Each such mode is
 * unavailable on its own, and a line above the choices names the ID that holds it back, since its own field may be
 * hidden by the mode. Problems with an ID show once its field was left.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import {
    canChooseMode,
    Card,
    Columns,
    CONTAINER_ID,
    DisclosureButton,
    ENABLED,
    ExternalLink,
    flagOf,
    loaderLines,
    loaderState,
    MEASUREMENT_ID,
    MODE_EXCLUDES,
    modeBlocker,
    Notice,
    RadioCards,
    SCRIPT_HOST,
    SettingField,
    StatusPanel,
    STANDARD_SCRIPT_HOST,
    Switch,
    textOf,
    TextInput,
    useSetting,
    useT,
    useWizard,
    type IconName,
    type LoaderLine,
    type LoaderLineState,
    type LoaderState,
    type Mode,
    type RadioOption,
    type SettingKey,
    type SettingsView,
    type StatusLine,
    type StepBehaviour,
    type StepSummaryContext,
    type Translator,
} from '@hryvinskyi/datalayer-setup';

const TAG_ASSISTANT_URL = 'https://tagassistant.google.com/';
const HOST_REGION_ID = 'hdl-setup-script-host-region';

/** The ways pages can load Google, in the order they are offered. */
const MODES: readonly Mode[] = ['gtm', 'gtag', 'both'];

const MODE_ICON = {
    gtm: 'deployed_code',
    gtag: 'analytics',
    both: 'call_split',
} as const satisfies Record<Mode, IconName>;

const MODE_PHRASE = {
    gtm: 'mode.gtm',
    gtag: 'mode.gtag',
    both: 'mode.both',
} as const satisfies Record<Mode, string>;

const STATE_PHRASE = {
    ok: 'status.loader.ok',
    waiting: 'status.loader.empty',
    invalid: 'status.loader.invalid',
    off: 'status.loader.off',
} as const satisfies Record<LoaderState, string>;

const LINE_LABEL = {
    gtm: 'status.line.gtm',
    gtag: 'status.line.gtag',
} as const satisfies Record<LoaderLine['loader'], string>;

const LINE_TONE = {
    ok: 'normal',
    waiting: 'muted',
    invalid: 'error',
} as const satisfies Record<LoaderLineState, StatusLine['tone']>;

/** The glyph shown where a loader has nothing to output yet. */
const NO_ADDRESS = '—';

const LINE_TEXT = {
    ok: (line, _t) => line.url ?? NO_ADDRESS,
    waiting: () => NO_ADDRESS,
    invalid: (_line, t) => t('status.line.not_output'),
} as const satisfies Record<LoaderLineState, (line: LoaderLine, t: Translator['t']) => string>;

const modeOf = (raw: string): Mode | undefined => MODES.find((mode) => mode === raw);

function modeOptions(translator: Translator, available: (mode: Mode) => boolean): readonly RadioOption[] {
    return MODES.map((mode) => ({
        value: mode,
        label: translator.t(MODE_PHRASE[mode]),
        description: translator.t(`${MODE_PHRASE[mode]}.description`),
        icon: MODE_ICON[mode],
        disabled: !available(mode),
        ...(mode === 'gtm' ? { badge: translator.t('mode.recommended') } : {}),
    }));
}

/** The labels of the IDs that hold modes back here, each once, in the order the modes are offered. */
function blockingLabels(view: SettingsView, blockerOf: (mode: Mode) => SettingKey | null): readonly string[] {
    const keys = [...new Set(MODES.map(blockerOf).filter((key) => key !== null))];
    return keys.map((key) => view.definition(key)?.label ?? key);
}

function statusLinesOf(lines: readonly LoaderLine[], translator: Translator): readonly StatusLine[] {
    return lines.map((line) => ({
        label: translator.t(LINE_LABEL[line.loader]),
        text: LINE_TEXT[line.state](line, translator.t),
        tone: LINE_TONE[line.state],
    }));
}

function LoaderStatus(): JSX.Element {
    const translator = useT();
    const { t } = translator;
    const { view } = useWizard();
    const state = loaderState(view);
    return (
        <StatusPanel
            title={t('status.output')}
            state={state}
            word={t(STATE_PHRASE[state])}
            note={t(`${STATE_PHRASE[state]}.note`)}
            lines={statusLinesOf(loaderLines(view), translator)}
        >
            {state === 'ok' ? <ExternalLink href={TAG_ASSISTANT_URL}>{t('status.tag_assistant')}</ExternalLink> : null}
        </StatusPanel>
    );
}

export function ConnectStep(): JSX.Element {
    const translator = useT();
    const { t } = translator;
    const { state, view, dispatch } = useWizard();
    const enabled = useSetting(ENABLED);
    const container = useSetting(CONTAINER_ID);
    const host = useSetting(SCRIPT_HOST);
    const measurement = useSetting(MEASUREMENT_ID);
    const [hostOpen, setHostOpen] = useState<boolean | null>(null);
    const mode = view.mode();
    const blockerOf = (candidate: Mode): SettingKey | null => modeBlocker(state.draft, state.scope, candidate);
    const blocking = blockingLabels(view, blockerOf);
    const showHost = hostOpen ?? textOf(host.value) !== '';

    const chooseMode = (raw: string): void => {
        const picked = modeOf(raw);
        if (picked !== undefined) {
            dispatch({ type: 'chooseMode', scope: state.scope, mode: picked });
        }
    };

    return (
        <Columns aside={<LoaderStatus />}>
            <Card icon="link" title={t('connect.card')}>
                <SettingField setting={enabled} help={t('field.enabled.help')}>
                    {(control) => (
                        <Switch
                            id={control.id}
                            checked={flagOf(enabled.value)}
                            onChange={enabled.set}
                            disabled={control.disabled}
                            describedBy={control.describedBy}
                        />
                    )}
                </SettingField>

                <div class="hdl-setup-field">
                    <div class="hdl-setup-field__head">
                        <span class="hdl-setup-field__label">{t('mode.label')}</span>
                    </div>
                    {blocking.map((label) => (
                        <Notice key={label} tone="info" muted icon="lock">{t('connect.mode.blocked', label)}</Notice>
                    ))}
                    <RadioCards
                        name="hdl-setup-mode"
                        label={t('mode.label')}
                        value={mode}
                        options={modeOptions(translator, (candidate) => canChooseMode(state.draft, state.scope, candidate))}
                        onChange={chooseMode}
                    />
                </div>

                {MODE_EXCLUDES[mode].container ? null : (
                    <>
                        <SettingField setting={container}>
                            {(control) => (
                                <TextInput
                                    id={control.id}
                                    value={textOf(container.value)}
                                    onInput={container.set}
                                    onBlur={control.onBlur}
                                    disabled={control.disabled}
                                    invalid={control.invalid}
                                    describedBy={control.describedBy}
                                    placeholder={t('connect.placeholder.container_id')}
                                    mono
                                    width="medium"
                                />
                            )}
                        </SettingField>
                        <DisclosureButton expanded={showHost} controls={HOST_REGION_ID} onToggle={() => setHostOpen(!showHost)}>
                            {t('connect.host_disclosure')}
                        </DisclosureButton>
                        {showHost
                            ? (
                                <div id={HOST_REGION_ID}>
                                    <SettingField setting={host} help={t('field.script_host.help')}>
                                        {(control) => (
                                            <TextInput
                                                id={control.id}
                                                value={textOf(host.value)}
                                                onInput={host.set}
                                                onBlur={control.onBlur}
                                                disabled={control.disabled}
                                                invalid={control.invalid}
                                                describedBy={control.describedBy}
                                                placeholder={STANDARD_SCRIPT_HOST}
                                                mono
                                            />
                                        )}
                                    </SettingField>
                                </div>
                            )
                            : null}
                    </>
                )}

                {MODE_EXCLUDES[mode].measurement ? null : (
                    <SettingField setting={measurement}>
                        {(control) => (
                            <TextInput
                                id={control.id}
                                value={textOf(measurement.value)}
                                onInput={measurement.set}
                                onBlur={control.onBlur}
                                disabled={control.disabled}
                                invalid={control.invalid}
                                describedBy={control.describedBy}
                                placeholder={t('connect.placeholder.measurement_id')}
                                mono
                                width="medium"
                            />
                        )}
                    </SettingField>
                )}

                {mode === 'both' ? <Notice tone="warning">{t('warning.double_count')}</Notice> : null}
            </Card>
        </Columns>
    );
}

/** The stepper's line for each state of the loader. */
const SUMMARY = {
    off: ({ t: translator }) => translator.t('summary.connect.off'),
    invalid: ({ t: translator }) => translator.t('summary.connect.invalid'),
    waiting: ({ t: translator }) => translator.t(STATE_PHRASE.waiting),
    ok: ({ view, t: translator }) => translator.t(
        `summary.connect.${view.mode()}`,
        textOf(view.value(CONTAINER_ID)).trim(),
        textOf(view.value(MEASUREMENT_ID)).trim(),
    ),
} as const satisfies Record<LoaderState, (context: StepSummaryContext) => string>;

/** What this step contributes when the shell registers it. */
export const connectStep: StepBehaviour = {
    component: ConnectStep,
    summary: (context) => SUMMARY[loaderState(context.view)](context),
};
