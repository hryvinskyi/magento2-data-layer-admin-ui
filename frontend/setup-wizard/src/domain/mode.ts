/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * How pages load Google. Nothing stores it: it follows from which IDs apply — a container ID only is `gtm`, a
 * measurement ID only is `gtag`, both is `both`, neither is `gtm`.
 *
 * Before an ID is typed, the IDs alone cannot say that a person picked `gtag` or `both`. So a pick made in the
 * wizard is remembered (never saved) and wins while the IDs do not contradict it, that is while every ID the
 * picked mode leaves out is empty.
 */
export type Mode = 'gtm' | 'gtag' | 'both';

/** Which ID each mode leaves out. */
export const MODE_EXCLUDES = {
    gtm: { container: false, measurement: true },
    gtag: { container: true, measurement: false },
    both: { container: false, measurement: false },
} as const satisfies Record<Mode, { readonly container: boolean; readonly measurement: boolean }>;

/** The mode the IDs alone imply. */
export function deriveMode(container: string, measurement: string): Mode {
    const hasContainer = container.trim() !== '';
    const hasMeasurement = measurement.trim() !== '';
    if (hasContainer && hasMeasurement) {
        return 'both';
    }
    return hasMeasurement ? 'gtag' : 'gtm';
}

/** The picked mode while the IDs allow it, else the mode the IDs imply. */
export function resolveMode(container: string, measurement: string, picked: Mode | undefined): Mode {
    if (picked === undefined) {
        return deriveMode(container, measurement);
    }
    const excludes = MODE_EXCLUDES[picked];
    const contradicted = (excludes.container && container.trim() !== '')
        || (excludes.measurement && measurement.trim() !== '');
    return contradicted ? deriveMode(container, measurement) : picked;
}
