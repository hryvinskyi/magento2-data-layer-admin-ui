/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The admin session bound to the page: the values valid now, a revision that changes when they are renewed (a
 * request keyed on it is asked again with the renewed form key), and renewing them once the person signed in again
 * in another tab. Renewing never touches the draft. Leaving the page aborts a renewal in flight.
 */
import { useCallback, useEffect, useMemo, useRef } from 'preact/hooks';
import { isRequestError } from '../../application/request-error.ts';
import type { Session } from '../../application/session.ts';
import { useRuntimeValue } from '../../sdk/context.tsx';
import { useChangeCount, type Subscribe } from './use-change-count.ts';

export interface SessionBinding {
    readonly session: Session;
    /** Changes whenever the session is renewed. */
    readonly revision: number;
    /** Asks the server for the session valid now: true once renewed, false while it is still not valid. */
    renew(): Promise<boolean>;
}

export function useSession(): SessionBinding {
    const { runtime } = useRuntimeValue();
    const source = runtime.session;
    const sources = useMemo((): readonly Subscribe[] => [source.subscribe], [source]);
    useChangeCount(sources);
    const inFlight = useRef<AbortController | null>(null);
    useEffect(() => () => inFlight.current?.abort(), []);

    const renew = useCallback(async (): Promise<boolean> => {
        inFlight.current?.abort();
        const controller = new AbortController();
        inFlight.current = controller;
        try {
            await source.refresh(controller.signal);
            return true;
        } catch (error) {
            if (!controller.signal.aborted && !isRequestError(error)) {
                runtime.logger.error('The admin session could not be renewed', error);
            }
            return false;
        }
    }, [source, runtime]);

    return { session: source.current(), revision: source.revision(), renew };
}
