/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deductTaxApplies } from './order-value.ts';

describe('deductTaxApplies', () => {
    it('applies to the grand total only', () => {
        assert.equal(deductTaxApplies('grand_total'), true);
        assert.equal(deductTaxApplies('subtotal'), false);
        assert.equal(deductTaxApplies(''), false);
    });

    it('does not apply without a basis, or to a value of another kind', () => {
        assert.equal(deductTaxApplies(undefined), false);
        assert.equal(deductTaxApplies(true), false);
        assert.equal(deductTaxApplies({ set: true }), false);
    });
});
