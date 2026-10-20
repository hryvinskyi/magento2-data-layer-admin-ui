/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The wizard's step state machine. Step ids are an open set registered at run time, so this module names no step;
 * the order comes from whoever registered the steps.
 *
 * A step records its progress (`todo`, `done`, `skipped`). What a person sees adds two live states: `current` for
 * the step on screen, and `attention` for a step whose fields or warnings currently need a look. Attention is
 * derived on every render rather than stored, because a fix made elsewhere (another step, another scope) must
 * clear it without anyone visiting the step again.
 */
import type { Brand } from './brand.ts';
import { failure, success, type Result } from './result.ts';

export type StepId = Brand<string, 'StepId'>;

const STEP_ID = /^[a-z0-9_-]+$/;

export const isStepId = (raw: string): raw is StepId => STEP_ID.test(raw);

export function parseStepId(raw: string): StepId | null {
    return isStepId(raw) ? raw : null;
}

/** For ids the code itself spells; throws on a malformed one. */
export function requireStepId(raw: string): StepId {
    if (!isStepId(raw)) {
        throw new RangeError(`Not a step id: ${raw}`);
    }
    return raw;
}

export type StepProgress = 'todo' | 'done' | 'skipped';
export type StepStatus = 'todo' | 'current' | 'done' | 'attention' | 'skipped';
export type StepEvent = 'visit' | 'continue' | 'skip';

/**
 * What each event does to the progress of the step being left. Visiting another step keeps what the step had;
 * continuing completes it; skipping records that the person chose not to set it up.
 */
export const STEP_TRANSITIONS = {
    visit: { todo: 'todo', done: 'done', skipped: 'skipped' },
    continue: { todo: 'done', done: 'done', skipped: 'done' },
    skip: { todo: 'skipped', done: 'skipped', skipped: 'skipped' },
} as const satisfies Record<StepEvent, Record<StepProgress, StepProgress>>;

export interface StepMachine {
    readonly order: readonly StepId[];
    readonly current: StepId;
    readonly progress: ReadonlyMap<StepId, StepProgress>;
}

export type StepRefusal<I = never> =
    | { readonly code: 'empty' }
    | { readonly code: 'duplicate'; readonly step: StepId }
    | { readonly code: 'unknown_step'; readonly step: StepId }
    | { readonly code: 'last_step' }
    | { readonly code: 'blocked'; readonly issues: readonly I[] };

/** Every step starts `todo`; the first one (or `start`) is current. */
export function createStepMachine(order: readonly StepId[], start?: StepId): Result<StepMachine, StepRefusal> {
    const first = order[0];
    if (first === undefined) {
        return failure({ code: 'empty' });
    }
    const progress = new Map<StepId, StepProgress>();
    for (const step of order) {
        if (progress.has(step)) {
            return failure({ code: 'duplicate', step });
        }
        progress.set(step, 'todo');
    }
    const current = start ?? first;
    if (!progress.has(current)) {
        return failure({ code: 'unknown_step', step: current });
    }
    return success(Object.freeze({ order: Object.freeze([...order]), current, progress }));
}

function leave(machine: StepMachine, event: StepEvent, next: StepId): StepMachine {
    const progress = new Map(machine.progress);
    progress.set(machine.current, STEP_TRANSITIONS[event][machine.progress.get(machine.current) ?? 'todo']);
    return Object.freeze({ order: machine.order, current: next, progress });
}

function nextOf(machine: StepMachine): StepId | undefined {
    return machine.order[machine.order.indexOf(machine.current) + 1];
}

/** Jump to any registered step, as the stepper does. */
export function visitStep(machine: StepMachine, target: StepId): Result<StepMachine, StepRefusal> {
    if (!machine.progress.has(target)) {
        return failure({ code: 'unknown_step', step: target });
    }
    return success(leave(machine, 'visit', target));
}

/**
 * Complete the current step and move to the next. Refused while the step has issues: the caller marks the
 * fields those issues name as touched, so the person sees why.
 */
export function continueStep<I>(machine: StepMachine, issues: readonly I[]): Result<StepMachine, StepRefusal<I>> {
    if (issues.length > 0) {
        return failure({ code: 'blocked', issues });
    }
    const next = nextOf(machine);
    if (next === undefined) {
        return failure({ code: 'last_step' });
    }
    return success(leave(machine, 'continue', next));
}

/** Leave the current step without setting it up and move to the next. */
export function skipStep(machine: StepMachine): Result<StepMachine, StepRefusal> {
    const next = nextOf(machine);
    if (next === undefined) {
        return failure({ code: 'last_step' });
    }
    return success(leave(machine, 'skip', next));
}

/** What the stepper shows for a step: current wins, then attention, then its recorded progress. */
export function statusOf(machine: StepMachine, step: StepId, needsAttention: boolean): StepStatus {
    if (step === machine.current) {
        return 'current';
    }
    if (needsAttention) {
        return 'attention';
    }
    return machine.progress.get(step) ?? 'todo';
}

/** Steps done or skipped: the progress bar's count. */
export function completedCount(machine: StepMachine): number {
    let count = 0;
    for (const progress of machine.progress.values()) {
        if (progress !== 'todo') {
            count++;
        }
    }
    return count;
}
