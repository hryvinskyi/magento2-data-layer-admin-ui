/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Following state that lives outside the wizard store (the session, a step's own state): the component renders
 * again whenever one of the sources announces a change, and the returned count changes with it, so a memo that
 * lists the count in its dependencies reads the sources again.
 */
import { useEffect, useState } from 'preact/hooks';

/** Subscribes to changes; returns the unsubscribe. */
export type Subscribe = (listener: () => void) => () => void;

/** @param sources must keep its identity between renders (a memo, a constant), or it is subscribed again each time */
export function useChangeCount(sources: readonly Subscribe[]): number {
    const [count, setCount] = useState(0);
    useEffect(() => {
        const changed = (): void => setCount((value) => value + 1);
        const unsubscribes = sources.map((subscribe) => subscribe(changed));
        return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
    }, [sources]);
    return count;
}
