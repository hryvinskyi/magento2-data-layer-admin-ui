/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Wording from the phrases the server translated. Phrases follow the admin's own format: positional placeholders
 * `%1` … `%n` filled in one pass (a value that itself contains `%2` stays as typed). A text that depends on a count
 * has one key per plural category (`<key>.one`, `<key>.few`, `<key>.other` …), chosen with the plural rules of the
 * admin user's locale; a category the server did not send falls back to `<key>.other`.
 *
 * Several names in one sentence are joined the locale's way (`a, b and c`), never with a separator written in
 * code.
 *
 * A key the server did not send is reported through `onMissing` and shown as the key itself, so a gap is visible
 * on screen instead of silently blank.
 */

export type PhraseParam = string | number;

export interface Translator {
    /** The phrase with `%1` … `%n` replaced by `params`. */
    t(key: string, ...params: readonly PhraseParam[]): string;
    /** The plural form of `key` for `count`; `count` (formatted for the locale) fills `%1`, `params` fill `%2` on. */
    tn(key: string, count: number, ...params: readonly PhraseParam[]): string;
    /** A number formatted for the locale. */
    n(value: number): string;
    /** Names joined as the locale lists them: `a`, `a and b`, `a, b and c`. */
    list(values: readonly string[]): string;
    /** The message for a validation code on a setting: `error.<setting>.<code>`, else `error.<code>`. */
    issue(settingKey: string, code: string): string;
}

export interface TranslatorOptions {
    /** The admin's locale code (`en_US`), or a BCP 47 tag. */
    readonly locale: string;
    readonly phrases: ReadonlyMap<string, string>;
    readonly onMissing: (key: string) => void;
}

const PLACEHOLDER = /%(\d+)/g;

/** Fills `%1` … `%n` in one pass; a placeholder without a value stays as it is. */
export function substitute(text: string, params: readonly PhraseParam[]): string {
    return text.replace(PLACEHOLDER, (placeholder: string, position: string) => {
        const value = params[Number(position) - 1];
        return value === undefined ? placeholder : String(value);
    });
}

/** The phrase key for `count`: the locale's plural category when the server sent it, else `.other`. */
export function pluralKey(key: string, category: Intl.LDMLPluralRule, has: (key: string) => boolean): string {
    const exact = `${key}.${category}`;
    return has(exact) ? exact : `${key}.other`;
}

/** `en_US` → `en-US`; a tag the runtime does not know falls back to its default locale. */
export function localeTag(locale: string): string | undefined {
    const tag = locale.replace(/_/g, '-');
    try {
        return Intl.getCanonicalLocales(tag)[0];
    } catch {
        return undefined;
    }
}

export function createTranslator(options: TranslatorOptions): Translator {
    const tag = localeTag(options.locale);
    const plurals = new Intl.PluralRules(tag);
    const numbers = new Intl.NumberFormat(tag);
    const lists = new Intl.ListFormat(tag, { style: 'long', type: 'conjunction' });
    const has = (key: string): boolean => options.phrases.has(key);
    const phrase = (key: string): string => {
        const text = options.phrases.get(key);
        if (text === undefined) {
            options.onMissing(key);
            return key;
        }
        return text;
    };
    const n = (value: number): string => numbers.format(value);

    return Object.freeze({
        t: (key: string, ...params: readonly PhraseParam[]): string => substitute(phrase(key), params),
        tn: (key: string, count: number, ...params: readonly PhraseParam[]): string =>
            substitute(phrase(pluralKey(key, plurals.select(count), has)), [n(count), ...params]),
        n,
        list: (values: readonly string[]): string => lists.format(values),
        issue: (settingKey: string, code: string): string => {
            const specific = `error.${settingKey}.${code}`;
            return phrase(has(specific) ? specific : `error.${code}`);
        },
    });
}
