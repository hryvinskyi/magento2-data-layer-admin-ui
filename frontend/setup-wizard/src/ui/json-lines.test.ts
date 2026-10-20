/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { JsonValue } from '../application/responses.ts';
import { jsonLines, type JsonLine } from './json-lines.ts';

const textOf = (lines: readonly JsonLine[]): string =>
    lines.map((line) => line.map((token) => token.text).join('')).join('\n');

const EVENT: JsonValue = {
    event: 'view_item',
    ecommerce: {
        currency: 'EUR',
        value: 59.9,
        items: [{ item_id: 'BP-2040', quantity: 1, in_stock: true, coupon: null }],
        tags: [],
        extra: {},
    },
};

describe('jsonLines', () => {
    it('lays out as JSON.stringify with two-space indentation does', () => {
        assert.equal(textOf(jsonLines(EVENT)), JSON.stringify(EVENT, null, 2));
    });

    it('lays out scalars, empty containers and nested arrays the same way', () => {
        for (const value of ['text', 7, -0.5, true, false, null, [], {}, [1, [2, []], {}], { a: [{ b: [] }] }] as const) {
            assert.equal(textOf(jsonLines(value)), JSON.stringify(value, null, 2));
        }
    });

    it('tells keys, strings, numbers and literals apart, and leaves the rest as punctuation', () => {
        const [open, member] = jsonLines({ name: 'x' });

        assert.deepEqual(open, [{ kind: 'punctuation', text: '{' }]);
        assert.deepEqual(member, [
            { kind: 'punctuation', text: '  ' },
            { kind: 'key', text: '"name"' },
            { kind: 'punctuation', text: ': ' },
            { kind: 'string', text: '"x"' },
        ]);
        assert.deepEqual(jsonLines(3.5), [[{ kind: 'number', text: '3.5' }]]);
        assert.deepEqual(jsonLines(true), [[{ kind: 'literal', text: 'true' }]]);
        assert.deepEqual(jsonLines(null), [[{ kind: 'literal', text: 'null' }]]);
    });

    it('keeps markup and quotes in values as escaped text', () => {
        const hostile = '<img src=x onerror="alert(1)"> \\ "quoted"';
        const lines = jsonLines({ item_name: hostile });

        assert.equal(textOf(lines), JSON.stringify({ item_name: hostile }, null, 2));
        assert.equal(lines.flat().filter((token) => token.kind === 'string').length, 1);
    });

    it('writes a number that is not finite as null rather than a word JSON does not have', () => {
        assert.equal(textOf(jsonLines([Number.NaN, Number.POSITIVE_INFINITY])), JSON.stringify([null, null], null, 2));
    });
});
