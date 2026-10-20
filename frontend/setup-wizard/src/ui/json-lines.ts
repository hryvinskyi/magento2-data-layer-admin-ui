/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * A JSON value as lines of coloured text, for showing an event the way it would be pushed. The result is plain
 * data (a kind and a text per token), so a component renders every token as a text node: nothing in the event is
 * ever read as markup.
 *
 * Layout matches `JSON.stringify(value, null, 2)`: two spaces per level, one member per line, empty objects and
 * arrays on one line.
 */
import type { JsonObject, JsonValue } from '../application/responses.ts';

export type JsonTokenKind = 'key' | 'string' | 'number' | 'literal' | 'punctuation';

export interface JsonToken {
    readonly kind: JsonTokenKind;
    readonly text: string;
}

export type JsonLine = readonly JsonToken[];

const INDENT = '  ';

const punctuation = (text: string): JsonToken => ({ kind: 'punctuation', text });

const keyToken = (name: string): JsonToken => ({ kind: 'key', text: JSON.stringify(name) });

const indentOf = (depth: number): readonly JsonToken[] => (depth === 0 ? [] : [punctuation(INDENT.repeat(depth))]);

const isList = (value: JsonValue): value is readonly JsonValue[] => Array.isArray(value);

const isObject = (value: JsonValue): value is JsonObject => typeof value === 'object' && value !== null && !isList(value);

/** The token of a value that is written on one line. */
function scalarToken(value: null | boolean | number | string): JsonToken {
    if (typeof value === 'string') {
        return { kind: 'string', text: JSON.stringify(value) };
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return { kind: 'number', text: String(value) };
    }
    return { kind: 'literal', text: typeof value === 'number' ? 'null' : String(value) };
}

/**
 * Writes `value` after `lead` (the tokens already on its first line: indentation and a member's key) and before
 * `trail` (a comma, unless the value is the last member).
 */
function write(value: JsonValue, depth: number, lead: readonly JsonToken[], trail: string, out: JsonToken[][]): void {
    const closing = trail === '' ? [] : [punctuation(trail)];
    if (isList(value)) {
        writeMembers(value.length, '[', ']', depth, lead, closing, out, (index, last) => {
            write(value[index] ?? null, depth + 1, indentOf(depth + 1), last ? '' : ',', out);
        });
        return;
    }
    if (isObject(value)) {
        const entries = Object.entries(value);
        writeMembers(entries.length, '{', '}', depth, lead, closing, out, (index, last) => {
            const [name, member] = entries[index] ?? ['', null];
            const keyed = [...indentOf(depth + 1), keyToken(name), punctuation(': ')];
            write(member, depth + 1, keyed, last ? '' : ',', out);
        });
        return;
    }
    out.push([...lead, scalarToken(value), ...closing]);
}

/** A bracketed list: `[]` on one line when empty, else the brackets on their own lines around the members. */
function writeMembers(
    count: number,
    open: string,
    close: string,
    depth: number,
    lead: readonly JsonToken[],
    closing: readonly JsonToken[],
    out: JsonToken[][],
    member: (index: number, last: boolean) => void,
): void {
    if (count === 0) {
        out.push([...lead, punctuation(open + close), ...closing]);
        return;
    }
    out.push([...lead, punctuation(open)]);
    for (let index = 0; index < count; index += 1) {
        member(index, index === count - 1);
    }
    out.push([...indentOf(depth), punctuation(close), ...closing]);
}

/** The value as lines of tokens. */
export function jsonLines(value: JsonValue): readonly JsonLine[] {
    const lines: JsonToken[][] = [];
    write(value, 0, [], '', lines);
    return lines;
}
