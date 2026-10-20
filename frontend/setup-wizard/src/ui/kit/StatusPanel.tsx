/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * What the store does with the settings as they stand: a state with its word and note, then labelled monospace
 * lines (the exact script URLs). The state shows as a glyph and a word, never only as a colour; long URLs wrap
 * anywhere. The state word is announced when it changes, since it follows what is typed in the fields; the note and
 * the lines are not, so typing an ID does not read the whole panel out on every key.
 */
import type { ComponentChildren, JSX } from 'preact';
import { Panel } from './Card.tsx';
import { Icon, type IconName } from './icons.tsx';

export type PanelState = 'ok' | 'waiting' | 'invalid' | 'off';

const STATE_ICON = {
    ok: 'check_circle',
    waiting: 'hourglass_empty',
    invalid: 'error',
    off: 'pause_circle',
} as const satisfies Record<PanelState, IconName>;

export interface StatusLine {
    /** Translated. */
    readonly label: string;
    readonly text: string;
    /** `muted` for a placeholder ("—"), `error` for a line that is not output. */
    readonly tone?: 'normal' | 'muted' | 'error' | undefined;
}

export interface StatusPanelProps {
    /** The panel's title; translated. */
    readonly title: string;
    readonly state: PanelState;
    /** The state in a word or two; translated. */
    readonly word: string;
    /** What the state means; translated. */
    readonly note: string;
    readonly lines?: readonly StatusLine[] | undefined;
    /** Actions under the lines (a link to Google's tools). */
    readonly children?: ComponentChildren | undefined;
}

export function StatusPanel({ title, state, word, note, lines = [], children }: StatusPanelProps): JSX.Element {
    return (
        <Panel title={title}>
            <div class="hdl-setup-status" data-state={state}>
                <div class="hdl-setup-status__summary">
                    <span class="hdl-setup-status__tile"><Icon name={STATE_ICON[state]} size={24} filled /></span>
                    <div class="hdl-setup-status__words">
                        <span class="hdl-setup-status__word" role="status">{word}</span>
                        <span class="hdl-setup-status__note">{note}</span>
                    </div>
                </div>
                {lines.map((line) => (
                    <div key={line.label} class="hdl-setup-status__line">
                        <span class="hdl-setup-status__label">{line.label}</span>
                        <span class="hdl-setup-status__box">
                            <span class="hdl-setup-status__dot" aria-hidden="true" />
                            <span class="hdl-setup-status__text" data-tone={line.tone ?? 'normal'}>{line.text}</span>
                        </span>
                    </div>
                ))}
                {children}
            </div>
        </Panel>
    );
}
