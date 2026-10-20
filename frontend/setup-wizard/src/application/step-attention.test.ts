/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { key } from '../test/fixtures/setup-state.ts';
import { needsAttention } from './step-attention.ts';
import type { FieldKey } from './wizard-store.ts';

const issue = { key: key('container_id'), code: 'required' } as const;
const nothingTouched: ReadonlySet<FieldKey> = new Set();

describe('step attention', () => {
    it('leaves a step nobody reached yet alone, even with empty required fields', () => {
        assert.equal(needsAttention({ progress: 'todo', issues: [issue], touched: nothingTouched, flagged: false }), false);
    });

    it('marks a step whose touched field has a problem', () => {
        assert.equal(needsAttention({ progress: 'todo', issues: [issue], touched: new Set([key('container_id')]), flagged: false }), true);
        assert.equal(
            needsAttention({ progress: 'todo', issues: [issue], touched: new Set([key('measurement_id')]), flagged: false }),
            false,
            'a touched field without a problem does not count',
        );
    });

    it('marks a completed or skipped step that has problems now', () => {
        assert.equal(needsAttention({ progress: 'done', issues: [issue], touched: nothingTouched, flagged: false }), true);
        assert.equal(needsAttention({ progress: 'skipped', issues: [issue], touched: nothingTouched, flagged: false }), true);
        assert.equal(needsAttention({ progress: 'done', issues: [], touched: nothingTouched, flagged: false }), false);
    });

    it('marks a step whose own check flags it', () => {
        assert.equal(needsAttention({ progress: 'todo', issues: [], touched: nothingTouched, flagged: true }), true);
    });
});
