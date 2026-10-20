/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The steps, in order, as a navigation landmark: wide, a vertical list under a progress bar, each step with its
 * marker, title, status in words and summary line; narrow, a wrapping row of chips above the content. Every step
 * can be visited; the current one is marked `aria-current="step"`. A status is always said in words (visibly in
 * the wide list, to assistive technology in the chips) and drawn with its own marker glyph, never by colour alone.
 * While a save is in flight no step can be visited.
 */
import type { JSX } from 'preact';
import type { StepStatus } from '../../domain/steps.ts';
import type { Translator } from '../i18n/translator.ts';
import { useT } from '../hooks/use-runtime.ts';
import { useStepNavigation, type StepView } from '../hooks/use-step-navigation.ts';
import { useEditLock } from '../hooks/use-wizard.ts';
import { Icon, type IconName } from './icons.tsx';

/** The marker glyph per status; a step without one shows its number. */
const MARKER = {
    todo: null,
    current: null,
    done: 'check',
    attention: 'priority_high',
    skipped: 'redo',
} as const satisfies Record<StepStatus, IconName | null>;

/** The status in words. */
function statusText(item: StepView, translator: Translator): string {
    if (item.status === 'current') {
        return item.attention ? translator.t('step.status.current_attention') : translator.t('step.status.current');
    }
    return translator.t(`step.status.${item.status}`);
}

function Marker({ item, size }: { readonly item: StepView; readonly size: 14 | 18 }): JSX.Element {
    const glyph = MARKER[item.status];
    return (
        <span class="hdl-setup-step__marker" aria-hidden="true">
            {glyph === null ? item.number : <Icon name={glyph} size={size} />}
        </span>
    );
}

export interface StepperProps {
    /** Chips above the content instead of the side list. */
    readonly narrow: boolean;
}

export function Stepper({ narrow }: StepperProps): JSX.Element {
    const translator = useT();
    const navigation = useStepNavigation();
    const locked = useEditLock();
    const total = navigation.steps.length;
    const percent = total === 0 ? 0 : Math.round((navigation.completed / total) * 100);

    if (narrow) {
        return (
            <nav class="hdl-setup-chips" aria-label={translator.t('stepper.label')}>
                {navigation.steps.map((item) => (
                    <button
                        key={item.step.id}
                        type="button"
                        class="hdl-setup-chip"
                        data-status={item.status}
                        aria-current={item.status === 'current' ? 'step' : undefined}
                        disabled={locked}
                        onClick={() => navigation.visit(item.step.id)}
                    >
                        <Marker item={item} size={14} />
                        <span>{translator.t(item.step.title)}</span>
                        <span class="hdl-setup-sr-only">{statusText(item, translator)}</span>
                    </button>
                ))}
            </nav>
        );
    }

    return (
        <nav class="hdl-setup-stepper" aria-label={translator.t('stepper.label')}>
            <div class="hdl-setup-stepper__progress">
                <div class="hdl-setup-stepper__progress-head">
                    <span>{translator.t('stepper.progress')}</span>
                    <span>{translator.t('stepper.progress_count', translator.n(navigation.completed), translator.n(total))}</span>
                </div>
                <div
                    class="hdl-setup-stepper__bar"
                    role="progressbar"
                    aria-label={translator.t('stepper.progress')}
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-valuenow={navigation.completed}
                >
                    <div class="hdl-setup-stepper__fill" style={{ width: `${percent}%` }} />
                </div>
            </div>
            <ol class="hdl-setup-stepper__list">
                {navigation.steps.map((item) => (
                    <li key={item.step.id} class="hdl-setup-stepper__item" data-progress={item.progress}>
                        <button
                            type="button"
                            class="hdl-setup-step"
                            data-status={item.status}
                            aria-current={item.status === 'current' ? 'step' : undefined}
                            disabled={locked}
                            onClick={() => navigation.visit(item.step.id)}
                        >
                            <Marker item={item} size={18} />
                            <span class="hdl-setup-step__text">
                                <span class="hdl-setup-step__title">{translator.t(item.step.title)}</span>
                                <span class="hdl-setup-step__status">{statusText(item, translator)}</span>
                                {item.summary === null ? null : <span class="hdl-setup-step__summary">{item.summary}</span>}
                            </span>
                        </button>
                    </li>
                ))}
            </ol>
        </nav>
    );
}
