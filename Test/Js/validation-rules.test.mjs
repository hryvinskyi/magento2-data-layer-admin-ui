/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The checks behind the settings form's validation rules, loaded the way RequireJS loads them: the AMD module runs in
 * a sandbox whose `define` hands back what its factory returns.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const moduleUrl = new URL('../../view/adminhtml/web/js/validation/rules.js', import.meta.url);

/**
 * Run the AMD module and return its value
 *
 * @returns {Promise<object>}
 */
async function loadRules() {
    const source = await readFile(moduleUrl, 'utf8');
    let exported;
    vm.runInNewContext(source, {
        define: (dependencies, factory) => {
            assert.equal(dependencies.length, 0);
            exported = factory();
        }
    }, {filename: moduleUrl.pathname});

    return exported;
}

const rules = await loadRules();

test('a container id is empty or GTM- followed by capital letters and digits', () => {
    for (const value of ['', '  ', 'GTM-AB12CD', ' GTM-XXXXXXX ']) {
        assert.equal(rules.isContainerId(value), true, value);
    }
    for (const value of ['GTM 1234', 'gtm-ab12', 'GTM-', 'GTM-AB 12', 'UA-1234-1', '<script>GTM-1</script>']) {
        assert.equal(rules.isContainerId(value), false, value);
    }
});

test('a script host is empty or a host name with a domain, without scheme, port or path', () => {
    for (const value of ['', 'www.googletagmanager.com', 'GTM.Example.com', ' sgtm.example.co.uk ']) {
        assert.equal(rules.isHostName(value), true, value);
    }
    for (const value of [
        'https://gtm.example.com', 'gtm.example.com/gtm.js', 'localhost', 'gtm.example.com:8443', '-gtm.example.com'
    ]) {
        assert.equal(rules.isHostName(value), false, value);
    }
});

test('a measurement id is empty or G- followed by letters and digits, in any case', () => {
    for (const value of ['', 'G-ABC123', 'g-abc123', ' G-XXXXXXXXXX ']) {
        assert.equal(rules.isMeasurementId(value), true, value);
    }
    for (const value of ['UA-1234-1', 'G-', 'G-AB 12', 'GTM-AB12']) {
        assert.equal(rules.isMeasurementId(value), false, value);
    }
});

test('a Google Ads conversion id is empty or AW- followed by digits, in any case', () => {
    for (const value of ['', 'AW-123456789', 'aw-1234567']) {
        assert.equal(rules.isAdsConversionId(value), true, value);
    }
    for (const value of ['1234567', 'AW-12a', 'AW-']) {
        assert.equal(rules.isAdsConversionId(value), false, value);
    }
});

test('a Google Ads conversion label is empty or letters, digits, underscores and hyphens', () => {
    for (const value of ['', 'QgmJ_Lu-9', ' abcDEF ']) {
        assert.equal(rules.isAdsConversionLabel(value), true, value);
    }
    for (const value of ['abc/def', 'a b', 'label!']) {
        assert.equal(rules.isAdsConversionLabel(value), false, value);
    }
});

test('a value that is not text counts as empty, as the validator only checks text', () => {
    assert.equal(rules.isContainerId(undefined), true);
    assert.equal(rules.isContainerId(42), true);
});
