/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Whether the wizard's own box is narrower than the width its side stepper needs. It measures the element, not
 * the window: the admin's menu and panels take a share of the window that the wizard cannot see. Until the first
 * measurement arrives (or where nothing measures) the wizard is wide.
 */
import { useEffect, useState, type MutableRef } from 'preact/hooks';

/** Below this width of the wizard's box the stepper becomes a row of chips and side panels go under the fields. */
export const NARROW_BELOW_PX = 1000;

export function useContainerNarrow(element: MutableRef<HTMLElement | null>): boolean {
    const [narrow, setNarrow] = useState(false);

    useEffect(() => {
        const target = element.current;
        if (target === null || typeof ResizeObserver !== 'function') {
            return undefined;
        }
        const observer = new ResizeObserver((entries) => {
            const width = entries[entries.length - 1]?.contentRect.width ?? 0;
            if (width > 0) {
                setNarrow(width < NARROW_BELOW_PX);
            }
        });
        observer.observe(target);
        return () => observer.disconnect();
    }, [element]);

    return narrow;
}
