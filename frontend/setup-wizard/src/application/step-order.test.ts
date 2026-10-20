/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { StepId } from '../domain/steps.ts';
import { step } from '../test/fixtures/setup-state.ts';
import { orderSteps, type Placeable } from './step-order.ts';

const at = (id: string, after?: string): Placeable => (after === undefined ? { id: step(id) } : { id: step(id), after: step(after) });
const ids = (steps: readonly Placeable[]): readonly StepId[] => steps.map((item) => item.id);

describe('orderSteps', () => {
    it('keeps unanchored steps in registration order', () => {
        assert.deepEqual(ids(orderSteps([at('a'), at('b'), at('c')]).placed), ['a', 'b', 'c']);
    });

    it('puts an anchored step right after its anchor, whenever it was registered', () => {
        const order = orderSteps([at('x', 'b'), at('a'), at('b'), at('c')]);

        assert.deepEqual(ids(order.placed), ['a', 'b', 'x', 'c']);
        assert.deepEqual(order.unplaced, []);
    });

    it('places steps anchored to the same step in registration order, each followed by its own followers', () => {
        const order = orderSteps([at('a'), at('b'), at('x', 'a'), at('y', 'a'), at('x2', 'x')]);

        assert.deepEqual(ids(order.placed), ['a', 'x', 'x2', 'y', 'b']);
    });

    it('reports steps whose anchor never appears, or whose anchors form a loop', () => {
        const order = orderSteps([at('a'), at('x', 'missing'), at('p', 'q'), at('q', 'p')]);

        assert.deepEqual(ids(order.placed), ['a']);
        assert.deepEqual(ids(order.unplaced), ['x', 'p', 'q']);
    });
});
