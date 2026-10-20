/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LOCK_MESSAGE, multiWebsiteConfig, singleWebsiteConfig, withField } from '../test/fixtures/page-config.ts';
import { channelOf, doubleCounted, route } from '../domain/events.ts';
import { eventName, key, scope } from '../test/fixtures/setup-state.ts';
import {
    ContractError,
    parsePageConfig,
    parsePreviewResponse,
    parseProducts,
    parseSaveResponse,
    parseSession,
    parseState,
    parseTestResult,
    sessionOf,
} from './contract.ts';

function refusedAt(parse: () => unknown, path: string): void {
    assert.throws(parse, (error: unknown) => {
        assert.ok(error instanceof ContractError, `expected a ContractError, got ${String(error)}`);
        assert.equal(error.path, path);
        return true;
    });
}

describe('page config', () => {
    const config = parsePageConfig(multiWebsiteConfig);
    const state = config.state;

    it('reads the scope tree', () => {
        assert.deepEqual(state.tree.scopes.map((item) => item.id), ['default', 'website:1', 'store:1', 'store:2', 'website:2', 'store:3']);
        assert.equal(state.tree.get(scope('website:1')).domain, 'www.example.com');
        assert.equal('domain' in state.tree.get(scope('store:1')), false);
    });

    it('reads settings into definitions, built-in defaults, stored rows and locks', () => {
        const container = state.settings.get(key('container_id'));
        assert.ok(container);
        assert.equal(container.definition.kind, 'text');
        assert.equal(container.definition.step, 'connect');
        assert.equal(container.definition.pattern?.test('GTM-AB12CD3'), true);
        assert.equal(container.definition.pattern?.test('GTM AB'), false);
        assert.equal(container.builtIn, '');
        assert.deepEqual([...container.stored], [['default', 'GTM-AB12CD3'], ['website:2', 'GTM-WH45EF6']]);

        assert.equal(state.settings.get(key('measurement_id'))?.definition.caseInsensitive, true);
        assert.equal(container.definition.caseInsensitive, false);
        assert.deepEqual(state.settings.get(key('sample_secret'))?.stored.get(scope('default')), { set: true });
        assert.equal(state.settings.get(key('hidden_price'))?.locks.get(scope('website:1')), LOCK_MESSAGE);
        const days = state.settings.get(key('sample_days'))?.definition;
        assert.deepEqual([days?.reach, days?.min, days?.max], ['website', 1, 730]);
        assert.deepEqual(state.settings.get(key('brand'))?.definition.options, [
            { value: '', label: 'brand.' },
            { value: 'manufacturer', label: 'brand.manufacturer' },
        ]);
        assert.deepEqual([...state.settings.keys()].slice(0, 3), ['enabled', 'container_id', 'script_host']);
    });

    it('reads the events catalogue, presets with and without an icon, and stored selections', () => {
        const events = state.events;
        assert.equal(events.catalogue.get(eventName('refund'))?.fixedChannel, 'server');
        assert.equal(events.catalogue.get(eventName('view_item'))?.groupCode, 'browsing');
        assert.equal(events.presets[0]?.icon, 'storefront');
        assert.equal(events.presets[1] !== undefined && 'icon' in events.presets[1], false);
        assert.deepEqual([...(events.presets[1]?.events ?? [])], ['view_item', 'purchase']);
        assert.deepEqual([...events.builtIn.off], ['refund']);
        assert.deepEqual([...(events.stored.get(scope('website:2'))?.channels ?? [])], [['purchase', 'both']]);
    });

    it('reads endpoints, phrases, plugins, the initial scope and plugin data', () => {
        assert.equal(config.endpoints.save, 'https://admin.test/hryvinskyi_datalayer/setup/save/');
        assert.equal(config.endpoints.session, 'https://admin.test/hryvinskyi_datalayer/setup/session/');
        assert.equal(config.endpoints.advanced.size, 6);
        assert.equal(config.endpoints.close.get(scope('store:3')), 'https://admin.test/close/store/3/');
        assert.equal(config.phrases.get('wizard.title'), 'wizard.title');
        assert.equal(config.formKey, 'form-key-fixture');
        assert.equal(config.locale, 'en_US');
        assert.deepEqual(config.plugins, []);
        assert.equal(config.initialScope, 'default');
        assert.equal(config.extensions.size, 0);
    });

    it('reads the single-website fixture', () => {
        const single = parsePageConfig(singleWebsiteConfig);
        assert.equal(single.state.tree.scopes.length, 3);
        assert.equal(single.state.events.stored.size, 0);
    });

    it('keeps plugin data opaque', () => {
        const withPlugin = withField(
            withField(multiWebsiteConfig, ['plugins'], [{ id: 'sample', module: '@vendor/sample' }]),
            ['extensions'],
            { sample: { status: { default: 'ok' } } },
        );
        const parsed = parsePageConfig(withPlugin);
        assert.deepEqual(parsed.plugins, [{ id: 'sample', module: '@vendor/sample' }]);
        assert.deepEqual(parsed.extensions.get('sample'), { status: { default: 'ok' } });
    });

    it('reads an event whose channel is fixed to both, which then takes no routing', () => {
        const parsed = parsePageConfig(withField(multiWebsiteConfig, ['state', 'events', 'catalogue', 7, 'fixedChannel'], 'both'));
        const events = parsed.state.events;

        assert.equal(events.catalogue.get(eventName('purchase'))?.fixedChannel, 'both');
        assert.equal(events.stored.get(scope('website:2'))?.channels.has(eventName('purchase')), false, 'its stored routing is dropped');
        assert.equal(channelOf(events.catalogue, events.builtIn, eventName('purchase')), 'both');
        assert.deepEqual(doubleCounted(events.catalogue, events.builtIn), ['purchase']);
        assert.deepEqual(route(events.catalogue, events.builtIn, eventName('purchase'), 'browser'), { ok: false, error: 'fixed_channel' });
    });

    it('treats an optional field sent as null like one left out', () => {
        const parsed = parsePageConfig(withField(multiWebsiteConfig, ['state', 'scopes', 2, 'domain'], null));
        assert.equal('domain' in parsed.state.tree.get(scope('store:1')), false);
    });

    const malformed: readonly [string, readonly (string | number)[], unknown, string][] = [
        ['a root that is no object', [], null, '$'],
        ['a scope tree with a dangling parent', ['state', 'scopes', 2, 'parent'], 'website:9', '$.state.scopes'],
        ['a scope whose type contradicts its id', ['state', 'scopes', 1, 'type'], 'store', '$.state.scopes'],
        ['a malformed scope id', ['state', 'scopes', 1, 'id'], 'websites:1', '$.state.scopes[1].id'],
        ['a scope without a name', ['state', 'scopes', 0, 'name'], undefined, '$.state.scopes[0].name'],
        ['an unknown setting kind', ['state', 'settings', 1, 'kind'], 'colour', '$.state.settings[1].kind'],
        ['a setting keyed like the events setting', ['state', 'settings', 0, 'key'], 'events', '$.state.settings[0].key'],
        ['a setting key used twice', ['state', 'settings', 1, 'key'], 'enabled', '$.state.settings[1].key'],
        ['a malformed step id', ['state', 'settings', 1, 'step'], 'Connect step', '$.state.settings[1].step'],
        ['an unknown reach', ['state', 'settings', 1, 'reach'], 'global', '$.state.settings[1].reach'],
        ['an empty path', ['state', 'settings', 1, 'path'], ' ', '$.state.settings[1].path'],
        ['a pattern that does not compile', ['state', 'settings', 1, 'pattern', 'source'], '(', '$.state.settings[1].pattern'],
        ['a pattern with the global flag', ['state', 'settings', 1, 'pattern', 'flags'], 'g', '$.state.settings[1].pattern'],
        ['a minimum that is no number', ['state', 'settings', 10, 'min'], '1', '$.state.settings[10].min'],
        ['a case flag that is no boolean', ['state', 'settings', 3, 'caseInsensitive'], 'yes', '$.state.settings[3].caseInsensitive'],
        ['an option without a label', ['state', 'settings', 4, 'options', 0, 'label'], undefined, '$.state.settings[4].options[0].label'],
        ['a flag stored as text', ['state', 'settings', 0, 'builtIn'], '1', '$.state.settings[0].builtIn'],
        ['a secret sent in clear', ['state', 'settings', 11, 'values', 'default'], 'hunter2', '$.state.settings[11].values["default"]'],
        ['a value of a scope outside the tree', ['state', 'settings', 1, 'values', 'store:9'], 'GTM-X1', '$.state.settings[1].values["store:9"]'],
        ['a value below the setting\'s reach', ['state', 'settings', 10, 'values', 'store:1'], '5', '$.state.settings[10].values["store:1"]'],
        ['a lock that is no text', ['state', 'settings', 7, 'locks', 'website:1'], true, '$.state.settings[7].locks["website:1"]'],
        ['an event name used twice', ['state', 'events', 'catalogue', 1, 'name'], 'view_item_list', '$.state.events.catalogue'],
        ['an unknown fixed channel', ['state', 'events', 'catalogue', 0, 'fixedChannel'], 'email', '$.state.events.catalogue[0].fixedChannel'],
        ['a group code with capitals', ['state', 'events', 'catalogue', 0, 'groupCode'], 'Browsing', '$.state.events.catalogue[0].groupCode'],
        ['a preset keyed custom', ['state', 'events', 'presets', 0, 'key'], 'custom', '$.state.events.presets[0].key'],
        ['a preset key used twice', ['state', 'events', 'presets', 1, 'key'], 'standard', '$.state.events.presets[1].key'],
        ['a malformed preset event', ['state', 'events', 'presets', 1, 'events', 0], 'view item', '$.state.events.presets[1].events[0]'],
        ['an unknown channel', ['state', 'events', 'values', 'website:2', 'channels', 'purchase'], 'cloud', '$.state.events.values["website:2"].channels["purchase"]'],
        ['events off that is no list', ['state', 'events', 'builtIn', 'off'], 'refund', '$.state.events.builtIn.off'],
        ['events of a scope outside the tree', ['state', 'events', 'values', 'store:9'], { off: [], channels: {} }, '$.state.events.values["store:9"]'],
        ['an advanced page missing for a scope', ['endpoints', 'advanced', 'store:3'], undefined, '$.endpoints.advanced["store:3"]'],
        ['a close URL for a scope outside the tree', ['endpoints', 'close', 'store:9'], 'https://admin.test/x/', '$.endpoints.close["store:9"]'],
        ['an empty save endpoint', ['endpoints', 'save'], '', '$.endpoints.save'],
        ['no session endpoint', ['endpoints', 'session'], undefined, '$.endpoints.session'],
        ['an empty form key', ['formKey'], '', '$.formKey'],
        ['a phrase that is no text', ['phrases', 'wizard.title'], 5, '$.phrases["wizard.title"]'],
        ['a plugin without a module', ['plugins'], [{ id: 'sample', module: '' }], '$.plugins[0].module'],
        ['a plugin id used twice', ['plugins'], [{ id: 'a', module: 'x' }, { id: 'a', module: 'y' }], '$.plugins[1].id'],
        ['an initial scope outside the tree', ['initialScope'], 'store:9', '$.initialScope'],
        ['plugin data that is no object', ['extensions'], [], '$.extensions'],
    ];
    for (const [name, path, value, expected] of malformed) {
        it(`refuses ${name}, naming ${expected}`, () => {
            refusedAt(() => parsePageConfig(path.length === 0 ? value : withField(multiWebsiteConfig, path, value)), expected);
        });
    }
});

describe('session answer', () => {
    const current = sessionOf(parsePageConfig(multiWebsiteConfig));
    const answer = {
        formKey: 'renewed-key',
        endpoints: {
            save: 'https://admin.test/save/key/new/',
            preview: 'https://admin.test/preview/key/new/',
            products: 'https://admin.test/products/key/new/',
        },
        links: {
            advanced: { default: 'https://admin.test/advanced/key/new/', 'website:1': 'https://admin.test/advanced/website/1/key/new/' },
            close: { default: 'https://admin.test/close/key/new/' },
        },
    };

    it('starts from the values the page was printed with', () => {
        assert.equal(current.formKey, 'form-key-fixture');
        assert.equal(current.endpoints.session, 'https://admin.test/hryvinskyi_datalayer/setup/session/');
        assert.equal(current.links.close.get(scope('store:3')), 'https://admin.test/close/store/3/');
    });

    it('reads the renewed form key, endpoints and links, keeping the session endpoint it was not sent', () => {
        const renewed = parseSession(answer, current);
        assert.equal(renewed.formKey, 'renewed-key');
        assert.equal(renewed.endpoints.save, 'https://admin.test/save/key/new/');
        assert.equal(renewed.endpoints.session, current.endpoints.session);
        assert.equal(renewed.links.advanced.get(scope('website:1')), 'https://admin.test/advanced/website/1/key/new/');
        assert.equal(renewed.links.close.has(scope('store:3')), false, 'a scope without a link has none');
        const moved = parseSession(withField(answer, ['endpoints', 'session'], 'https://admin.test/session/'), current);
        assert.equal(moved.endpoints.session, 'https://admin.test/session/');
    });

    it('refuses an answer of the wrong shape, naming the path', () => {
        refusedAt(() => parseSession(withField(answer, ['formKey'], ''), current), '$.formKey');
        refusedAt(() => parseSession(withField(answer, ['endpoints', 'preview'], undefined), current), '$.endpoints.preview');
        refusedAt(() => parseSession(withField(answer, ['links', 'close'], undefined), current), '$.links.close');
        refusedAt(() => parseSession(withField(answer, ['links', 'advanced', 'site 1'], 'x'), current), '$.links.advanced["site 1"]');
        refusedAt(() => parseSession({ ajaxExpired: 1 }, current), '$.endpoints');
    });
});

describe('save response', () => {
    const answer = (results: unknown): unknown => ({ results, state: multiWebsiteConfig.state });

    it('reads per-change results and the next snapshot', () => {
        const parsed = parseSaveResponse(answer([
            { scope: 'default', key: 'container_id', status: 'saved' },
            { scope: 'website:2', key: 'events', status: 'failed', message: 'reason' },
        ]));
        assert.deepEqual(parsed.results, [
            { scope: 'default', key: 'container_id', status: 'saved' },
            { scope: 'website:2', key: 'events', status: 'failed', message: 'reason' },
        ]);
        assert.equal(parsed.state.tree.scopes.length, 6);
    });

    it('refuses an unknown status, a scope outside the tree and a malformed key', () => {
        refusedAt(() => parseSaveResponse(answer([{ scope: 'default', key: 'brand', status: 'maybe' }])), '$.results[0].status');
        refusedAt(() => parseSaveResponse(answer([{ scope: 'store:9', key: 'brand', status: 'saved' }])), '$.results[0].scope');
        refusedAt(() => parseSaveResponse(answer([{ scope: 'default', key: 'Brand', status: 'saved' }])), '$.results[0].key');
        refusedAt(() => parseSaveResponse({ results: [] }), '$.state');
    });
});

describe('preview response', () => {
    it('reads the event a page would push', () => {
        const event = { event: 'view_item', ecommerce: { currency: 'EUR', value: 59, items: [{ item_id: 'BP-2040', quantity: 1 }] } };
        assert.deepEqual(parsePreviewResponse({ status: 'sent', event }), { status: 'sent', event });
    });

    it('reads why nothing is sent or nothing can be shown', () => {
        assert.deepEqual(parsePreviewResponse({ status: 'not_sent', reason: 'off' }), { status: 'not_sent', reason: 'off' });
        assert.deepEqual(parsePreviewResponse({ status: 'unavailable', reason: 'none' }), { status: 'unavailable', reason: 'none' });
    });

    it('refuses an unknown status, a missing reason and an event that is no object', () => {
        refusedAt(() => parsePreviewResponse({ status: 'queued' }), '$.status');
        refusedAt(() => parsePreviewResponse({ status: 'toString' }), '$.status');
        refusedAt(() => parsePreviewResponse({ status: 'not_sent' }), '$.reason');
        refusedAt(() => parsePreviewResponse({ status: 'sent', event: [] }), '$.event');
        refusedAt(() => parsePreviewResponse({ status: 'sent', event: { items: [{ price: () => 1 }] } }), '$.event["items"][0]["price"]');
    });
});

describe('products and test results', () => {
    it('reads product hits', () => {
        assert.deepEqual(parseProducts([{ id: 1187, sku: 'BP-2040', name: 'Backpack' }]), [{ id: 1187, sku: 'BP-2040', name: 'Backpack' }]);
        refusedAt(() => parseProducts([{ id: 0, sku: 'X', name: 'Y' }]), '$[0].id');
        refusedAt(() => parseProducts({}), '$');
    });

    it('reads a test event\'s outcome', () => {
        assert.deepEqual(parseTestResult({ valid: false, messages: ['VALUE_INVALID · items: missing'], error: '' }), {
            valid: false,
            messages: ['VALUE_INVALID · items: missing'],
            error: '',
        });
        refusedAt(() => parseTestResult({ valid: true, messages: [1], error: '' }), '$.messages[0]');
    });
});

describe('state alone', () => {
    it('parses under a given path, as a save answer does', () => {
        refusedAt(() => parseState({ scopes: [], settings: [], events: {} }, '$.state'), '$.state.scopes');
    });
});
