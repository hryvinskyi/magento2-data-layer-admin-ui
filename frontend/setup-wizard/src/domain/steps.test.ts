/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { step } from '../test/fixtures/setup-state.ts';
import type { Result } from './result.ts';
import {
    completedCount,
    continueStep,
    createStepMachine,
    skipStep,
    statusOf,
    STEP_TRANSITIONS,
    visitStep,
    type StepMachine,
    type StepRefusal,
} from './steps.ts';

const ORDER = [step('scope'), step('connect'), step('track'), step('review')];

function ok<I>(result: Result<StepMachine, StepRefusal<I>>): StepMachine {
    if (!result.ok) {
        throw new assert.AssertionError({ message: `Refused: ${result.error.code}` });
    }
    return result.value;
}

const fresh = (): StepMachine => ok(createStepMachine(ORDER));
const statuses = (machine: StepMachine, attention: readonly string[] = []) =>
    machine.order.map((id) => statusOf(machine, id, attention.includes(id)));

describe('step machine', () => {
    it('starts on the first step with every step to do', () => {
        assert.deepEqual(statuses(fresh()), ['current', 'todo', 'todo', 'todo']);
        assert.equal(completedCount(fresh()), 0);
        assert.equal(ok(createStepMachine(ORDER, step('track'))).current, 'track');
    });

    it('refuses an empty order, a repeated step or an unknown start', () => {
        assert.deepEqual(createStepMachine([]), { ok: false, error: { code: 'empty' } });
        assert.deepEqual(createStepMachine([step('a'), step('a')]), { ok: false, error: { code: 'duplicate', step: 'a' } });
        assert.deepEqual(createStepMachine(ORDER, step('elsewhere')), { ok: false, error: { code: 'unknown_step', step: 'elsewhere' } });
    });

    it('continues: the step is done and the next one current', () => {
        const next = ok(continueStep(fresh(), []));
        assert.deepEqual(statuses(next), ['done', 'current', 'todo', 'todo']);
        assert.equal(completedCount(next), 1);
    });

    it('does not continue while the step has issues, and hands them back', () => {
        const machine = fresh();
        const blocked = continueStep(machine, ['container_id']);
        assert.deepEqual(blocked, { ok: false, error: { code: 'blocked', issues: ['container_id'] } });
        assert.deepEqual(statuses(machine), ['current', 'todo', 'todo', 'todo']);
    });

    it('skips: the step is skipped and the next one current', () => {
        const skipped = ok(skipStep(ok(continueStep(fresh(), []))));
        assert.deepEqual(statuses(skipped), ['done', 'skipped', 'current', 'todo']);
        assert.equal(completedCount(skipped), 2);
    });

    it('visits any step, keeping what the left step had', () => {
        const visited = ok(visitStep(ok(continueStep(fresh(), [])), step('review')));
        assert.deepEqual(statuses(visited), ['done', 'todo', 'todo', 'current']);
        const back = ok(visitStep(visited, step('scope')));
        assert.deepEqual(statuses(back), ['current', 'todo', 'todo', 'todo']);
        assert.equal(back.progress.get(step('scope')), 'done');
        assert.deepEqual(visitStep(back, step('elsewhere')), { ok: false, error: { code: 'unknown_step', step: 'elsewhere' } });
    });

    it('has no step after the last one', () => {
        const last = ok(visitStep(fresh(), step('review')));
        assert.deepEqual(continueStep(last, []), { ok: false, error: { code: 'last_step' } });
        assert.deepEqual(skipStep(last), { ok: false, error: { code: 'last_step' } });
    });

    it('shows attention for a step that needs a look, but never over current', () => {
        const machine = ok(continueStep(fresh(), []));
        assert.deepEqual(statuses(machine, ['scope', 'connect']), ['attention', 'current', 'todo', 'todo']);
    });

    it('turns every progress into the expected one for every event', () => {
        assert.deepEqual(STEP_TRANSITIONS, {
            visit: { todo: 'todo', done: 'done', skipped: 'skipped' },
            continue: { todo: 'done', done: 'done', skipped: 'done' },
            skip: { todo: 'skipped', done: 'skipped', skipped: 'skipped' },
        });
        const skippedThenDone = ok(continueStep(ok(visitStep(ok(skipStep(fresh())), step('scope'))), []));
        assert.equal(skippedThenDone.progress.get(step('scope')), 'done');
    });
});
