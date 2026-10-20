/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * What the preview answered, in the form a person reads: a placeholder while it is being built, the event as
 * coloured text, or the server's own words for why there is none. Every token of the event is a text node.
 */
import type { JSX } from 'preact';
import { Notice, useT, type JsonObject, type PreviewState } from '@hryvinskyi/datalayer-setup';
import { jsonLines } from '../json-lines.ts';

/** How many placeholder bars the loading state draws. */
const SKELETON_BARS: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7];

function Skeleton(): JSX.Element {
    const { t } = useT();
    return (
        <div class="hdl-setup-skeleton" aria-busy="true">
            <p class="hdl-setup-skeleton__label">{t('preview.loading')}</p>
            {SKELETON_BARS.map((bar) => <span key={bar} class="hdl-setup-skeleton__bar" />)}
        </div>
    );
}

function EventJson({ event, label }: { readonly event: JsonObject; readonly label: string }): JSX.Element {
    return (
        <div class="hdl-setup-json" role="region" aria-label={label} tabIndex={0}>
            {jsonLines(event).map((line, row) => (
                <div key={row} class="hdl-setup-json__line">
                    {line.map((token, column) => (
                        <span key={column} class="hdl-setup-json__token" data-token={token.kind}>{token.text}</span>
                    ))}
                </div>
            ))}
        </div>
    );
}

type PreviewStatus = PreviewState['status'];

interface OutputContext {
    /** Names the event region; translated. */
    readonly label: string;
    readonly failed: string;
}

/** How each answer shows; a status without an entry would not compile. */
const OUTPUTS: { readonly [S in PreviewStatus]: (state: Extract<PreviewState, { readonly status: S }>, context: OutputContext) => JSX.Element | null } = {
    idle: () => null,
    loading: () => <Skeleton />,
    loaded: (state, context) => <EventJson event={state.event} label={context.label} />,
    not_sent: (state) => <Notice tone="info" icon="visibility_off" muted>{state.reason}</Notice>,
    unavailable: (state) => <Notice tone="info" muted>{state.reason}</Notice>,
    failed: (_state, context) => <Notice tone="warning">{context.failed}</Notice>,
};

function output<S extends PreviewStatus>(state: Extract<PreviewState, { readonly status: S }>, context: OutputContext): JSX.Element | null {
    return OUTPUTS[state.status](state, context);
}

export interface PreviewOutputProps {
    readonly state: PreviewState;
    /** Names the event region; translated. */
    readonly label: string;
}

export function PreviewOutput({ state, label }: PreviewOutputProps): JSX.Element | null {
    const { t } = useT();
    return output(state, { label, failed: t('preview.failed') });
}
