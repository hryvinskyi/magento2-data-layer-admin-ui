/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Save all, bound to the page. A second call while a save is in flight does nothing (a double click sends one
 * request); a save with nothing pending sends nothing; leaving the page aborts the request in flight. A failed
 * save is never retried automatically: the person decides, and every edit is still there.
 */
import { useCallback, useEffect, useRef } from 'preact/hooks';
import { isRequestError } from '../../application/request-error.ts';
import { saveAll, type SaveOutcome } from '../../application/save-all.ts';
import type { SaveStatus, WizardAction } from '../../application/wizard-store.ts';
import type { Draft } from '../../domain/draft.ts';
import type { Logger } from '../../application/ports.ts';
import { useRuntimeValue } from '../../sdk/context.tsx';
import { useWizard } from './use-wizard.ts';

export interface SaveBinding {
    readonly status: SaveStatus;
    save(): void;
}

interface SettleContext {
    readonly sent: Draft;
    readonly dispatch: (action: WizardAction) => void;
    readonly logger: Logger;
}

type OutcomeOf<K extends SaveOutcome['kind']> = Extract<SaveOutcome, { readonly kind: K }>;

const cancel = (_outcome: SaveOutcome, context: SettleContext): void => context.dispatch({ type: 'saveCancelled' });

/** What each outcome does to the store. */
const SETTLE: { readonly [K in SaveOutcome['kind']]: (outcome: OutcomeOf<K>, context: SettleContext) => void } = {
    unchanged: cancel,
    aborted: cancel,
    completed: (outcome, context) => context.dispatch({
        type: 'saveCompleted',
        sent: context.sent,
        state: outcome.state,
        results: outcome.results,
    }),
    failed: (outcome, context) => {
        if (!isRequestError(outcome.cause)) {
            context.logger.error('Saving the setup failed', outcome.cause);
        }
        context.dispatch({ type: 'saveFailed', failure: outcome.failure });
    },
};

function settle<K extends SaveOutcome['kind']>(outcome: OutcomeOf<K> & { readonly kind: K }, context: SettleContext): void {
    const handler: (outcome: OutcomeOf<K>, context: SettleContext) => void = SETTLE[outcome.kind];
    handler(outcome, context);
}

export function useSave(): SaveBinding {
    const { runtime } = useRuntimeValue();
    const { state, dispatch, dirty } = useWizard();
    const latest = useRef({ draft: state.draft, dirty });
    latest.current = { draft: state.draft, dirty };
    const inFlight = useRef<AbortController | null>(null);

    useEffect(() => () => inFlight.current?.abort(), []);

    const save = useCallback((): void => {
        if (inFlight.current !== null || !latest.current.dirty) {
            return;
        }
        const sent = latest.current.draft;
        const controller = new AbortController();
        inFlight.current = controller;
        dispatch({ type: 'saveStarted' });
        void saveAll(runtime.gateway)(sent, controller.signal).then((outcome) => {
            inFlight.current = null;
            settle(outcome, { sent, dispatch, logger: runtime.logger });
        });
    }, [runtime, dispatch]);

    return { status: state.save, save };
}
