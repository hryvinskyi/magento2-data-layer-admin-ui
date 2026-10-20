/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createTranslator, localeTag, pluralKey, substitute, type Translator } from './translator.ts';

function translator(locale: string, phrases: Record<string, string>, missing: string[] = []): Translator {
    return createTranslator({ locale, phrases: new Map(Object.entries(phrases)), onMissing: (key) => void missing.push(key) });
}

describe('placeholders', () => {
    it('fills %1 … %n by position, in one pass', () => {
        assert.equal(substitute('Step %1 of %2', [2, 5]), 'Step 2 of 5');
        assert.equal(substitute('%2 before %1', ['a', 'b']), 'b before a');
        assert.equal(substitute('%1 and %2', ['%2', 'x']), '%2 and x', 'a value is never substituted again');
        assert.equal(substitute('Inherits from %1', []), 'Inherits from %1', 'a missing value leaves the placeholder');
        assert.equal(substitute('item %10', Array.from({ length: 10 }, (_, index) => index + 1)), 'item 10');
    });
});

describe('plurals', () => {
    it('picks the locale\'s category when the server sent it, else .other', () => {
        const sent = new Set(['n.one', 'n.few', 'n.other']);
        const has = (key: string): boolean => sent.has(key);

        assert.equal(pluralKey('n', 'few', has), 'n.few');
        assert.equal(pluralKey('n', 'many', has), 'n.other');
    });

    it('chooses with the plural rules of a locale that has a few form', () => {
        const t = translator('uk_UA', { 'changes.one': '%1 зміна', 'changes.few': '%1 зміни', 'changes.many': '%1 змін', 'changes.other': '%1 зміни' });

        assert.equal(t.tn('changes', 1), '1 зміна');
        assert.equal(t.tn('changes', 3), '3 зміни');
        assert.equal(t.tn('changes', 5), '5 змін');
    });

    it('falls back to .other for a category the server did not send', () => {
        const t = translator('pl_PL', { 'changes.one': '%1 zmiana', 'changes.other': '%1 zmian(y)' });

        assert.equal(t.tn('changes', 3), '3 zmian(y)', 'Polish 3 is "few"');
        assert.equal(t.tn('changes', 1), '1 zmiana');
    });

    it('passes the count, formatted for the locale, as %1 and further values from %2', () => {
        const t = translator('en_US', { 'saved.one': '%1 change saved in %2', 'saved.other': '%1 changes saved in %2' });

        assert.equal(t.tn('saved', 1234, 'Main'), '1,234 changes saved in Main');
        assert.equal(t.n(1234.5), '1,234.5');
    });
});

describe('phrases', () => {
    it('reports a missing phrase and shows its key', () => {
        const missing: string[] = [];
        const t = translator('en_US', {}, missing);

        assert.equal(t.t('wizard.title'), 'wizard.title');
        assert.equal(t.tn('changes', 2), 'changes.other');
        assert.deepEqual(missing, ['wizard.title', 'changes.other']);
    });

    it('takes a setting\'s own validation message before the general one', () => {
        const t = translator('en_US', { 'error.container_id.format': 'Use GTM-XXXXXXX', 'error.format': 'Wrong format' });

        assert.equal(t.issue('container_id', 'format'), 'Use GTM-XXXXXXX');
        assert.equal(t.issue('script_host', 'format'), 'Wrong format');
    });

    it('joins names the way the locale lists them', () => {
        assert.equal(translator('en_US', {}).list(['Main']), 'Main');
        assert.equal(translator('en_US', {}).list(['Main', 'Second', 'Third']), 'Main, Second, and Third');
        assert.equal(translator('de_DE', {}).list(['Main', 'Second', 'Third']), 'Main, Second und Third');
        assert.equal(translator('en_US', {}).list([]), '');
    });

    it('turns the admin locale code into a tag, and an unknown one into the runtime default', () => {
        assert.equal(localeTag('en_US'), 'en-US');
        assert.equal(localeTag('de_CH'), 'de-CH');
        assert.equal(localeTag('not a locale'), undefined);
        assert.equal(translator('not a locale', { x: 'x' }).t('x'), 'x');
    });
});
