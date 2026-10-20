/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The order of the wizard's steps. Steps without an anchor keep the order they were registered in; a step that
 * names an anchor comes right after it, after any step placed there before it, and before whatever followed the
 * anchor. A step whose anchor never appears (the module that owns the anchor failed to load, or the anchors form a
 * loop) cannot be placed and is reported instead of guessed at.
 */
import type { StepId } from '../domain/steps.ts';

export interface Placeable {
    readonly id: StepId;
    readonly after?: StepId;
}

export interface StepOrder<T extends Placeable> {
    readonly placed: readonly T[];
    readonly unplaced: readonly T[];
}

export function orderSteps<T extends Placeable>(steps: readonly T[]): StepOrder<T> {
    const anchored = new Map<StepId, T[]>();
    const roots: T[] = [];
    for (const step of steps) {
        if (step.after === undefined) {
            roots.push(step);
        } else {
            anchored.set(step.after, [...(anchored.get(step.after) ?? []), step]);
        }
    }

    const placed: T[] = [];
    const visit = (step: T): void => {
        placed.push(step);
        for (const follower of anchored.get(step.id) ?? []) {
            visit(follower);
        }
    };
    roots.forEach(visit);

    const ids = new Set(placed);
    return { placed, unplaced: steps.filter((step) => !ids.has(step)) };
}
