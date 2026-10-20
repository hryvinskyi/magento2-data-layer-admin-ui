/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The top of a step: a kicker with the step's glyph and its place ("Step 2 of 5"), the title, an optional intro,
 * and for an optional step a "Skip this step" link. All texts arrive translated. The title can take focus from
 * script (not from the Tab key), so the page can move focus to a step it just opened.
 */
import type { JSX, Ref } from 'preact';
import { Icon, type IconName } from './icons.tsx';

export interface StepHeadingProps {
    /** The heading's id, for the region it names. */
    readonly id: string;
    readonly icon: IconName;
    /** "Step n of N"; translated. */
    readonly counter: string;
    readonly title: string;
    readonly intro?: string | undefined;
    /** Offers skipping the step: the link's text and what it does. */
    readonly skip?: { readonly label: string; readonly onSkip: () => void } | undefined;
    /** The title element, for moving focus to it. */
    readonly titleRef?: Ref<HTMLHeadingElement> | undefined;
}

export function StepHeading({ id, icon, counter, title, intro, skip, titleRef }: StepHeadingProps): JSX.Element {
    return (
        <div class="hdl-setup-heading">
            <div class="hdl-setup-heading__kicker">
                <Icon name={icon} size={18} />
                {counter}
            </div>
            <h2 id={id} {...(titleRef === undefined ? {} : { ref: titleRef })} class="hdl-setup-heading__title" tabIndex={-1}>{title}</h2>
            {intro === undefined ? null : <p class="hdl-setup-heading__intro">{intro}</p>}
            {skip === undefined ? null : (
                <button type="button" class="hdl-setup-button hdl-setup-button--link hdl-setup-heading__skip" onClick={skip.onSkip}>
                    {skip.label}
                    <Icon name="arrow_forward" size={18} />
                </button>
            )}
        </div>
    );
}
