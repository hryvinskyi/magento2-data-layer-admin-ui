/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { choiceAfterKey } from './arrow-choice.ts';

const VALUES = ['a', 'b', 'c'];

describe('choiceAfterKey', () => {
    it('moves to the next value on the forward arrows and the previous on the backward ones', () => {
        assert.equal(choiceAfterKey(VALUES, 'b', 'ArrowRight'), 'c');
        assert.equal(choiceAfterKey(VALUES, 'b', 'ArrowDown'), 'c');
        assert.equal(choiceAfterKey(VALUES, 'b', 'ArrowLeft'), 'a');
        assert.equal(choiceAfterKey(VALUES, 'b', 'ArrowUp'), 'a');
    });

    it('wraps around at both ends', () => {
        assert.equal(choiceAfterKey(VALUES, 'c', 'ArrowRight'), 'a');
        assert.equal(choiceAfterKey(VALUES, 'a', 'ArrowLeft'), 'c');
    });

    it('ignores other keys and a value outside the group', () => {
        assert.equal(choiceAfterKey(VALUES, 'a', 'Enter'), null);
        assert.equal(choiceAfterKey(VALUES, 'x', 'ArrowRight'), null);
        assert.equal(choiceAfterKey([], 'a', 'ArrowRight'), null);
    });
});
