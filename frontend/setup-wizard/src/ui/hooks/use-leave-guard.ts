/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Leaving the wizard with unsaved changes asks first: the browser's own prompt guards closing the tab and browser
 * navigation, and in-app links (Close, Advanced settings) ask through the navigator with the page's wording. Once
 * the person agreed to leave through an in-app link, the browser does not ask a second time.
 */
import { useCallback, useEffect, useRef } from 'preact/hooks';
import { useRuntimeValue } from '../../sdk/context.tsx';

/** The phrase key of the question asked before leaving with unsaved changes. */
export const LEAVE_PHRASE = 'leave.confirm';

export interface LeaveGuard {
    /** True when there is nothing to lose or the person agreed to lose it. */
    confirmLeave(): boolean;
    /** Goes to `url` once `confirmLeave()` agrees. */
    leave(url: string): void;
}

export function useLeaveGuard(dirty: boolean): LeaveGuard {
    const { runtime } = useRuntimeValue();
    const leaving = useRef(false);

    useEffect(() => {
        if (!dirty) {
            return undefined;
        }
        const controller = new AbortController();
        window.addEventListener('beforeunload', (event: BeforeUnloadEvent): void => {
            if (!leaving.current) {
                event.preventDefault();
                // Older browsers ask only when a return value is set.
                event.returnValue = '';
            }
        }, { signal: controller.signal });
        return () => controller.abort();
    }, [dirty]);

    const confirmLeave = useCallback(
        (): boolean => !dirty || runtime.navigator.confirmLeave(runtime.translator.t(LEAVE_PHRASE)),
        [dirty, runtime],
    );
    const leave = useCallback((url: string): void => {
        if (confirmLeave()) {
            leaving.current = true;
            runtime.navigator.go(url);
        }
    }, [confirmLeave, runtime]);

    return { confirmLeave, leave };
}
