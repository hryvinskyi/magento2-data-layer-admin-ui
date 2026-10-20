/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * What a wizard setting is: its key, kind, step, reach and format, and the values each kind holds.
 *
 * A value read from the store and a value typed into the wizard differ only for secrets: the store reports whether
 * a secret is set (never the secret itself), while an edit carries the replacement text.
 */
import type { Brand } from './brand.ts';
import { failure, success, type Result } from './result.ts';
import type { ScopeType } from './scope.ts';
import type { StepId } from './steps.ts';

export type SettingKey = Brand<string, 'SettingKey'>;

/** The key the events composite travels under in a save request; no setting may use it. */
export const EVENTS_KEY = 'events';
export type EventsKey = typeof EVENTS_KEY;

const SETTING_KEY = /^[a-z0-9_]+$/;

export const isSettingKey = (raw: string): raw is SettingKey => SETTING_KEY.test(raw) && raw !== EVENTS_KEY;

export function parseSettingKey(raw: string): SettingKey | null {
    return isSettingKey(raw) ? raw : null;
}

/** For keys the code itself spells; throws on a malformed one. */
export function requireSettingKey(raw: string): SettingKey {
    if (!isSettingKey(raw)) {
        throw new RangeError(`Not a setting key: ${raw}`);
    }
    return raw;
}

export type SettingKind = 'flag' | 'choice' | 'text' | 'secret' | 'number';

const KINDS: ReadonlySet<string> = new Set<SettingKind>(['flag', 'choice', 'text', 'secret', 'number']);

export const isSettingKind = (raw: string): raw is SettingKind => KINDS.has(raw);

/** A secret as the store reports it: whether one is saved. */
export interface SecretState {
    readonly set: boolean;
}

/** A secret as an edit carries it: the new plain text, sent once with the save and never read back. */
export interface SecretReplacement {
    readonly replace: string;
}

/** flag → boolean; choice, text and number → string; secret → whether it is set. */
export type StoredValue = boolean | string | SecretState;
/** flag → boolean; choice, text and number → string; secret → the replacement text. */
export type EditValue = boolean | string | SecretReplacement;
export type SettingValue = StoredValue | EditValue;

export interface SettingOption {
    readonly value: string;
    readonly label: string;
}

/** A format a text value must match, compiled once when the definition is built. */
export interface FormatPattern {
    readonly source: string;
    readonly flags: string;
    test(text: string): boolean;
}

/**
 * Compiles an ECMAScript pattern. The global and sticky flags are refused: they make `test()` remember where the
 * last match ended, so the same value would pass and fail on alternate calls.
 */
export function createFormatPattern(source: string, flags: string): Result<FormatPattern, 'invalid'> {
    if (!/^[dimsuv]*$/.test(flags)) {
        return failure('invalid');
    }
    let regex: RegExp;
    try {
        regex = new RegExp(source, flags);
    } catch {
        return failure('invalid');
    }
    return success(Object.freeze({ source, flags, test: (text: string): boolean => regex.test(text) }));
}

export interface SettingDefinition {
    readonly key: SettingKey;
    /** The stored configuration path. */
    readonly path: string;
    readonly kind: SettingKind;
    readonly step: StepId;
    /** Translated by the server. */
    readonly label: string;
    readonly options: readonly SettingOption[];
    /** The narrowest scope the setting can be set at. */
    readonly reach: ScopeType;
    readonly pattern?: FormatPattern;
    readonly min?: number;
    readonly max?: number;
    /** The store upper-cases the value before checking and saving it, so the wizard compares it upper-cased too. */
    readonly caseInsensitive: boolean;
}

/** A setting key that is not in the state reached a query: a programming error, not a person's mistake. */
export class UnknownSettingError extends Error {
    readonly key: string;

    constructor(key: string) {
        super(`Unknown setting: ${key}`);
        this.name = 'UnknownSettingError';
        this.key = key;
    }
}

const isText = (value: SettingValue): boolean => typeof value === 'string';

/** Which stored value each kind holds. */
const STORED_SHAPE = {
    flag: (value: StoredValue): boolean => typeof value === 'boolean',
    choice: isText,
    text: isText,
    number: isText,
    secret: (value: StoredValue): boolean => typeof value === 'object',
} as const satisfies Record<SettingKind, (value: StoredValue) => boolean>;

/** Which edit value each kind accepts: a secret only takes replacement text. */
const EDIT_SHAPE = {
    flag: (value: EditValue): boolean => typeof value === 'boolean',
    choice: isText,
    text: isText,
    number: isText,
    secret: (value: EditValue): boolean => typeof value === 'object',
} as const satisfies Record<SettingKind, (value: EditValue) => boolean>;

export const acceptsStored = (kind: SettingKind, value: StoredValue): boolean => STORED_SHAPE[kind](value);

export const acceptsEdit = (kind: SettingKind, value: EditValue): boolean => EDIT_SHAPE[kind](value);

/**
 * Whether two values say the same thing. A replacement secret is never the same as anything: the stored secret
 * is unknown to the browser, so typing one is always a change.
 */
export function sameValue(a: SettingValue, b: SettingValue): boolean {
    if (typeof a !== 'object' || typeof b !== 'object') {
        return a === b;
    }
    return 'set' in a && 'set' in b && a.set === b.set;
}

/** No value to use: blank text, an unset secret, blank replacement text. A flag is never empty. */
export function isEmptyValue(value: SettingValue | undefined): boolean {
    if (value === undefined) {
        return true;
    }
    if (typeof value === 'boolean') {
        return false;
    }
    if (typeof value === 'string') {
        return value.trim() === '';
    }
    return 'set' in value ? !value.set : value.replace.trim() === '';
}

/** The text of a choice, text or number value; empty for anything else. */
export const textOf = (value: SettingValue | undefined): string => (typeof value === 'string' ? value : '');

/** A flag's value; anything that is not `true` reads as off. */
export const flagOf = (value: SettingValue | undefined): boolean => value === true;

/** What a save request carries for an edit: the value itself, or a secret's plain replacement text. */
export const wireValueOf = (value: EditValue): boolean | string => (typeof value === 'object' ? value.replace : value);
