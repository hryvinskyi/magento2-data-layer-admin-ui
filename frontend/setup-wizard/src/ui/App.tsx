/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The wizard's frame: the header with the ways out, the scope bar, the stepper beside (or, narrow, above) the
 * current step under its heading, and the footer with Back, the unsaved count and the primary action.
 *
 * - The primary action is Continue on every step but the last, and Save all on the last. Nothing is stored before
 *   Save all; Save all stays available while anything is unsaved, also after a partial failure, unless a step has
 *   problems at a scope the save would write (the review step names them).
 * - While a save is in flight nothing can be edited and no step or scope opened, so what is sent is what is shown.
 * - Leaving through Close or Advanced settings, or closing the tab, asks first while anything is unsaved. Both links
 *   lead to the page the server built for the current scope.
 * - A save that failed as a whole (session ended, store unreachable …) is said above the step; every edit is kept.
 *   When the admin session ended, the person signs in again in another tab and retries from here: the page renews
 *   its session (form key, links) and sends the save again.
 * - Opening a step moves focus to its title; a refused Continue moves it to the first field with a problem.
 * - A step that fails to render is said in its place; the rest of the wizard keeps working.
 *
 * The frame names no step: it shows whatever steps were registered, in their order.
 */
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
    Footer,
    FrameHeader,
    iconOr,
    MessageStrip,
    ScopeBar,
    StepHeading,
    Stepper,
    useLeaveGuard,
    usePageLinks,
    useSave,
    useSaveBlockers,
    useSession,
    useStepNavigation,
    useT,
    useWizard,
    type MessageAction,
    type RequestErrorKind,
    type SaveStatus,
    type Translator,
} from '@hryvinskyi/datalayer-setup';
import { StepBoundary } from './shell/StepBoundary.tsx';
import { useContainerNarrow } from './shell/use-container-narrow.ts';

const HEADING_ID = 'hdl-setup-step-title';

/** The phrase for each way a whole request can fail. */
const REQUEST_PHRASE = {
    network: 'request.network',
    timeout: 'request.timeout',
    rejected: 'request.rejected',
    forbidden: 'request.forbidden',
    expired: 'request.expired',
    server: 'request.server',
} as const satisfies Record<RequestErrorKind, string>;

/** What to say about a save that failed as a whole: the server's own reason when it gave one. */
function requestFailureText(save: SaveStatus, translator: Translator): string | null {
    if (save.status !== 'failed' || save.reason.kind !== 'request') {
        return null;
    }
    const failure = save.reason.failure;
    return failure.serverMessage ?? translator.t(REQUEST_PHRASE[failure.kind]);
}

/** The footer's status line: what is unsaved, or that everything was saved. */
function footerStatus(pending: number, save: SaveStatus, isLast: boolean, translator: Translator): {
    readonly text: string;
    readonly note?: string;
    readonly dirty: boolean;
} {
    if (pending > 0) {
        const text = translator.tn('footer.unsaved', pending);
        return isLast ? { text, dirty: true } : { text, note: translator.t('footer.unsaved_note'), dirty: true };
    }
    return { text: translator.t(save.status === 'saved' ? 'footer.all_saved' : 'footer.none'), dirty: false };
}

/** Whether the save failed because the admin session ended. */
const sessionEnded = (save: SaveStatus): boolean =>
    save.status === 'failed' && save.reason.kind === 'request' && save.reason.failure.kind === 'expired';

/**
 * Renewing the session after the person signed in again, then sending the save again. While the session is still
 * not valid nothing is sent and the message stays.
 */
function useRetryAfterSignIn(retry: () => void): { readonly renewing: boolean; readonly renewAndRetry: () => void } {
    const { renew } = useSession();
    const [renewing, setRenewing] = useState(false);
    const renewAndRetry = (): void => {
        if (renewing) {
            return;
        }
        setRenewing(true);
        void renew().then((renewed) => {
            setRenewing(false);
            if (renewed) {
                retry();
            }
        });
    };
    return { renewing, renewAndRetry };
}

/** Moves focus to a step's title when another step opens, never on the first render (the page keeps its focus). */
function useFocusOnStepChange(stepId: string): { readonly current: HTMLHeadingElement | null } {
    const title = useRef<HTMLHeadingElement | null>(null);
    const shown = useRef(stepId);
    useEffect(() => {
        if (shown.current !== stepId) {
            shown.current = stepId;
            title.current?.focus();
        }
    }, [stepId]);
    return title;
}

export function App(): JSX.Element {
    const frame = useRef<HTMLDivElement | null>(null);
    const content = useRef<HTMLElement | null>(null);
    const narrow = useContainerNarrow(frame);
    const translator = useT();
    const { t } = translator;
    const navigation = useStepNavigation();
    const { state, pending, dirty } = useWizard();
    const links = usePageLinks();
    const guard = useLeaveGuard(dirty);
    const save = useSave();
    const blockers = useSaveBlockers();
    const canSave = pending.length > 0 && blockers.length === 0;
    const retry = useRetryAfterSignIn(() => {
        if (canSave) {
            save.save();
        }
    });
    const [refusals, setRefusals] = useState(0);

    const current = navigation.current;
    const step = current.step;
    const Step = step.component;
    const title = useFocusOnStepChange(step.id);
    const saving = save.status.status === 'saving';
    const failure = requestFailureText(state.save, translator);
    const failureAction: MessageAction | undefined = sessionEnded(state.save)
        ? { label: t(retry.renewing ? 'action.retrying' : 'action.retry'), onClick: retry.renewAndRetry, busy: retry.renewing }
        : undefined;

    // A refused Continue shows the problems on their fields; focus goes to the first of them.
    useEffect(() => {
        if (refusals === 0) {
            return;
        }
        const invalid = content.current?.querySelector('[aria-invalid="true"]');
        (invalid instanceof HTMLElement ? invalid : title.current)?.focus();
    }, [refusals, title]);

    const onContinue = (): void => {
        const refused = navigation.issues.length > 0;
        navigation.continue();
        if (refused) {
            setRefusals((count) => count + 1);
        }
    };

    return (
        <div ref={frame} class="hdl-setup-frame" data-layout={narrow ? 'narrow' : 'wide'} aria-busy={saving ? true : undefined}>
            <FrameHeader
                breadcrumb={t('wizard.breadcrumb')}
                title={t('wizard.title')}
                advanced={{ label: t('action.advanced'), href: links.advanced }}
                close={{ label: t('action.close'), href: links.close }}
                onLeave={guard.leave}
            />
            <ScopeBar />
            <div class="hdl-setup-body">
                {narrow ? null : <Stepper narrow={false} />}
                <div class="hdl-setup-main">
                    {narrow ? <Stepper narrow /> : null}
                    <section ref={content} class="hdl-setup-content" aria-labelledby={HEADING_ID} inert={saving}>
                        <StepHeading
                            id={HEADING_ID}
                            titleRef={title}
                            icon={iconOr(step.icon, 'tune')}
                            counter={t('step.counter', translator.n(current.number), translator.n(navigation.steps.length))}
                            title={t(step.title)}
                            {...(step.intro === undefined ? {} : { intro: t(step.intro) })}
                            {...(step.skippable === true && !navigation.isLast
                                ? { skip: { label: t('action.skip'), onSkip: navigation.skip } }
                                : {})}
                        />
                        {failure === null ? null : <MessageStrip tone="error" action={failureAction}>{failure}</MessageStrip>}
                        <StepBoundary key={step.id} step={step.id}>
                            <Step />
                        </StepBoundary>
                    </section>
                    <Footer
                        back={{ label: t('action.back'), onClick: navigation.back, disabled: navigation.isFirst || saving }}
                        status={footerStatus(pending.length, state.save, navigation.isLast, translator)}
                        primary={navigation.isLast
                            ? {
                                label: saving ? t('action.saving') : t('action.save_all'),
                                icon: 'save',
                                onClick: save.save,
                                disabled: !canSave,
                                busy: saving,
                            }
                            : {
                                label: t('action.continue'),
                                icon: 'arrow_forward',
                                onClick: onContinue,
                                disabled: false,
                                busy: false,
                            }}
                    />
                </div>
            </div>
        </div>
    );
}
