/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Keyboard movement within a group of tabs or radio-like buttons: the arrow keys move to the neighbour, wrapping
 * around at the ends, as the platform's own radio groups do.
 */

/** How far each arrow key moves the selection. */
const STEP: ReadonlyMap<string, number> = new Map([
    ['ArrowRight', 1],
    ['ArrowDown', 1],
    ['ArrowLeft', -1],
    ['ArrowUp', -1],
]);

/** The value an arrow key selects next; null for any other key, or a current value the group does not hold. */
export function choiceAfterKey(values: readonly string[], current: string, key: string): string | null {
    const step = STEP.get(key);
    const index = values.indexOf(current);
    if (step === undefined || index < 0) {
        return null;
    }
    return values[(index + step + values.length) % values.length] ?? null;
}
