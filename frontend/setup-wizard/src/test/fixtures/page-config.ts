/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Page configurations as the server prints them, for tests at every level. Every text a person would read is its
 * own key (a phrase's text is the phrase key, a setting's label is the setting key, an option's label is
 * `<setting>.<value>`), so a test that finds an element by its accessible name reads the key.
 *
 * `multiWebsiteConfig`: the default scope, two websites, three store views; stored rows at each level; one
 * deployment lock; one secret that is set; presets with and without an icon. Besides the core settings it holds a
 * `sample` step standing in for a step plugin: a website-only flag, a website-only number with a range and a
 * secret. `singleWebsiteConfig`: one website with one store view, rows at the default scope only.
 */
import type {
    WireCatalogueEvent,
    WirePageConfig,
    WirePreset,
    WireScope,
    WireSelection,
    WireSetting,
    WireState,
} from '../../adapters/contract.ts';

function deepFreeze<T>(value: T): T {
    if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const item of Object.values(value)) {
            deepFreeze(item);
        }
    }
    return value;
}

/** Phrase keys every fixture carries. A test that needs another key adds it here. */
export const PHRASE_KEYS: readonly string[] = [
    'wizard.title',
    'wizard.loading',
    'wizard.failed',
    'step.scope.title',
    'step.connect.title',
    'step.track.title',
    'step.products.title',
    'step.review.title',
    'action.continue',
    'action.back',
    'action.skip',
    'action.save_all',
    'action.close',
    'action.advanced',
    'action.override',
    'action.inherit',
    'error.required',
    'error.format',
    'error.range',
    'leave.confirm',
    'channel.fixed.both',
    'wizard.breadcrumb',
    'step.counter',
    'step.scope.intro',
    'step.connect.intro',
    'step.track.intro',
    'step.products.intro',
    'step.review.intro',
    'step.status.current',
    'step.status.current_attention',
    'step.status.attention',
    'step.status.done',
    'step.status.todo',
    'step.status.skipped',
    'stepper.label',
    'stepper.progress',
    'stepper.progress_count',
    'action.saving',
    'footer.unsaved.one',
    'footer.unsaved.other',
    'footer.unsaved_note',
    'footer.none',
    'footer.all_saved',
    'scope.label',
    'scope.default',
    'scope.website',
    'scope.store',
    'scope.default.applies',
    'scope.website.applies',
    'scope.store.applies',
    'switch.yes',
    'switch.no',
    'field.reach.default',
    'field.reach.website',
    'field.reach.store',
    'origin.inherited',
    'origin.inherited_built_in',
    'origin.default',
    'origin.built_in',
    'origin.overridden.one',
    'origin.overridden.other',
    'origin.website',
    'origin.store',
    'origin.reach.website',
    'origin.reach.default',
    'secret.stored',
    'secret.masked',
    'secret.replace',
    'request.expired',
    'request.forbidden',
    'request.timeout',
    'request.network',
    'request.server',
    'request.rejected',
    'scope.cards.label',
    'scope.default.sub',
    'scope.website.sub.one',
    'scope.website.sub.other',
    'scope.website.views.one',
    'scope.website.views.other',
    'scope.store.kind',
    'scope.tracking.on',
    'scope.tracking.off',
    'scope.no_container',
    'scope.single_website',
    'scope.skip_to_connect',
    'scope.uses_default',
    'scope.inherits_from',
    'mode.label',
    'mode.gtm',
    'mode.gtm.description',
    'mode.gtag',
    'mode.gtag.description',
    'mode.both',
    'mode.both.description',
    'mode.recommended',
    'connect.card',
    'connect.host_disclosure',
    'warning.double_count',
    'field.enabled.help',
    'field.script_host.help',
    'status.loader.ok',
    'status.loader.ok.note',
    'status.loader.empty',
    'status.loader.empty.note',
    'status.loader.invalid',
    'status.loader.invalid.note',
    'status.loader.off',
    'status.loader.off.note',
    'status.output',
    'status.tag_assistant',
    'status.line.gtm',
    'status.line.gtag',
    'status.line.not_output',
    'summary.connect.off',
    'summary.connect.invalid',
    'summary.connect.gtm',
    'summary.connect.gtag',
    'summary.connect.both',
    'error.container_id.required',
    'error.container_id.format',
    'error.measurement_id.required',
    'error.measurement_id.format',
    'track.events',
    'track.column.event',
    'track.column.trigger',
    'track.column.source',
    'track.column.send',
    'track.column.channel',
    'track.sent',
    'track.from_server.one',
    'track.from_server.other',
    'track.group.count',
    'track.presets',
    'track.send_event',
    'track.channel_for',
    'preset.custom',
    'preset.custom.description',
    'preset.events.one',
    'preset.events.other',
    'preset.events_selected.one',
    'preset.events_selected.other',
    'channel.browser',
    'channel.server',
    'channel.both',
    'channel.fixed.browser',
    'channel.fixed.server',
    'channel.fixed.browser.hint',
    'channel.fixed.server.hint',
    'channel.fixed.both.hint',
    'warning.both',
    'warning.server_off',
    'action.go_to_step',
    'review.nothing.title',
    'review.nothing.text',
    'review.changes',
    'review.column.setting',
    'review.column.current',
    'review.column.new',
    'review.saved',
    'review.failed',
    'review.group',
    'review.group.other',
    'review.empty',
    'review.built_in',
    'review.inherited_value',
    'review.events',
    'review.secret',
    'review.count',
    'review.scopes.one',
    'review.scopes.other',
    'changes.one',
    'changes.other',
    'success.count.one',
    'success.count.other',
    'success.text',
    'save.partial',
    'checklist.title',
    'checklist.tags.one',
    'checklist.tags.other',
    'checklist.preview',
    'checklist.publish',
    'checklist.open_preview',
    'products.card.lists',
    'preview.tabs',
    'preview.product',
    'preview.viewer',
    'preview.store.under',
    'preview.no_store',
    'preview.order.latest',
    'preview.failed',
    'preview.search.empty',
    'preview.search.failed',
    'preview.search.loading',
    'field.item_id.help',
    'field.brand.help',
    'field.tax_catalog.help',
    'field.tax_cart.help',
    'field.hidden_price.help',
    'field.purchase_value.help',
    'field.checkout_value.help',
    'field.list_view.help',
    'products.card.items',
    'products.card.prices',
    'products.card.values',
    'preview.title.view_item',
    'preview.title.purchase',
    'preview.tab.view_item',
    'preview.tab.purchase',
    'preview.search',
    'preview.loading',
    'preview.viewer.visible',
    'preview.viewer.hidden',
    'summary.track.one',
    'summary.track.other',
    'origin.source.built_in',
    'origin.explain.inherited',
    'track.explain.inherited',
    'connect.mode.blocked',
    'connect.placeholder.container_id',
    'connect.placeholder.measurement_id',
    'action.retry',
    'action.retrying',
    'secret.keep',
    'step.failed',
    'review.discard',
    'review.discard_row',
    'review.discard_all',
    'review.discard_all.confirm',
    'review.discard_all.yes',
    'review.discard_all.no',
    'review.blocked',
    'review.blocked.item',
    'review.separator',
];

const phrases = (): Record<string, string> => Object.fromEntries(PHRASE_KEYS.map((key) => [key, key]));

const IDS = {
    containerPattern: { source: '^GTM-[A-Z0-9]+$', flags: '' },
    measurementPattern: { source: '^G-[A-Z0-9]+$', flags: '' },
    hostPattern: {
        source: '^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$',
        flags: 'i',
    },
};

const options = (key: string, values: readonly string[]): WireSetting['options'] =>
    values.map((value) => ({ value, label: `${key}.${value}` }));

type SettingSeed = Omit<WireSetting, 'label' | 'options' | 'values' | 'locks'>
    & Partial<Pick<WireSetting, 'options' | 'values' | 'locks'>>;

const setting = (seed: SettingSeed): WireSetting => ({
    label: seed.key,
    options: [],
    values: {},
    locks: {},
    ...seed,
});

/** The settings of both fixtures, without stored rows or locks. */
function settings(): WireSetting[] {
    return [
        setting({ key: 'enabled', path: 'hryvinskyi_datalayer/general/enabled', kind: 'flag', step: 'connect', reach: 'store', builtIn: false }),
        setting({ key: 'container_id', path: 'hryvinskyi_datalayer/gtm/container_id', kind: 'text', step: 'connect', reach: 'store', pattern: IDS.containerPattern, builtIn: '' }),
        setting({ key: 'script_host', path: 'hryvinskyi_datalayer/gtm/script_host', kind: 'text', step: 'connect', reach: 'store', pattern: IDS.hostPattern, builtIn: '' }),
        setting({ key: 'measurement_id', path: 'hryvinskyi_datalayer/gtag/measurement_id', kind: 'text', step: 'connect', reach: 'store', pattern: IDS.measurementPattern, caseInsensitive: true, builtIn: '' }),
        setting({ key: 'item_id', path: 'hryvinskyi_datalayer/item/identifier_attribute', kind: 'choice', step: 'products', reach: 'store', options: options('item_id', ['sku', 'entity_id']), builtIn: 'sku' }),
        setting({ key: 'brand', path: 'hryvinskyi_datalayer/item/brand_attribute', kind: 'choice', step: 'products', reach: 'store', options: options('brand', ['', 'manufacturer']), builtIn: '' }),
        setting({ key: 'tax_catalog', path: 'hryvinskyi_datalayer/item/catalogue_price_includes_tax', kind: 'flag', step: 'products', reach: 'store', builtIn: true }),
        setting({ key: 'hidden_price', path: 'hryvinskyi_datalayer/item/hidden_price_handling', kind: 'choice', step: 'products', reach: 'store', options: options('hidden_price', ['omit', 'skip']), builtIn: 'omit' }),
        setting({ key: 'list_view', path: 'hryvinskyi_datalayer/lists/impression_trigger', kind: 'choice', step: 'products', reach: 'store', options: options('list_view', ['load', 'visible']), builtIn: 'load' }),
        setting({ key: 'sample_enabled', path: 'sample/group/enabled', kind: 'flag', step: 'sample', reach: 'website', builtIn: false }),
        setting({ key: 'sample_days', path: 'sample/group/days', kind: 'number', step: 'sample', reach: 'website', min: 1, max: 730, builtIn: '395' }),
        setting({ key: 'sample_secret', path: 'sample/group/secret', kind: 'secret', step: 'sample', reach: 'website', builtIn: { set: false } }),
    ];
}

const event = (
    name: string,
    groupCode: string,
    sourceCode: string,
    fixedChannel: WireCatalogueEvent['fixedChannel'] = null,
): WireCatalogueEvent => ({
    name,
    label: name,
    group: `group.${groupCode}`,
    groupCode,
    trigger: `trigger.${name}`,
    source: `source.${sourceCode}`,
    sourceCode,
    browserOriginated: sourceCode !== 'server',
    fixedChannel,
});

const CATALOGUE: readonly WireCatalogueEvent[] = [
    event('view_item_list', 'browsing', 'list'),
    event('select_item', 'browsing', 'click'),
    event('view_item', 'browsing', 'page'),
    event('view_promotion', 'browsing', 'list', 'browser'),
    event('add_to_cart', 'cart', 'click'),
    event('view_cart', 'cart', 'page'),
    event('begin_checkout', 'checkout', 'page'),
    event('purchase', 'checkout', 'order'),
    event('refund', 'checkout', 'server', 'server'),
    event('login', 'account', 'server'),
];

const ALL_EVENTS = CATALOGUE.map((item) => item.name);
const STANDARD_EVENTS = ALL_EVENTS.filter((name) => name !== 'refund');

const PRESETS: readonly WirePreset[] = [
    { key: 'standard', label: 'preset.standard', description: 'preset.standard.description', icon: 'storefront', events: STANDARD_EVENTS },
    { key: 'minimal', label: 'preset.minimal', description: 'preset.minimal.description', events: ['view_item', 'purchase'] },
];

/** What applying the standard preset stores. */
export const STANDARD_SELECTION: WireSelection = { off: ['refund'], channels: {} };

const events = (values: WireState['events']['values'] = {}, locks: WireState['events']['locks'] = {}): WireState['events'] => ({
    catalogue: CATALOGUE,
    presets: PRESETS,
    builtIn: STANDARD_SELECTION,
    values,
    locks,
});

/** Stored rows and locks per setting key. */
type Rows = Readonly<Record<string, Partial<Pick<WireSetting, 'values' | 'locks'>>>>;

const withRows = (list: readonly WireSetting[], rows: Rows): WireSetting[] =>
    list.map((item) => ({ ...item, ...rows[item.key] }));

/** One URL per scope id, as the server builds them. */
const urlPerScope = (scopes: readonly WireScope[], page: string): Record<string, string> =>
    Object.fromEntries(scopes.map((scope) => [scope.id, `https://admin.test/${page}/${scope.id.replace(':', '/')}/`]));

function pageConfig(state: WireState): WirePageConfig {
    return {
        endpoints: {
            save: 'https://admin.test/hryvinskyi_datalayer/setup/save/',
            preview: 'https://admin.test/hryvinskyi_datalayer/setup/preview/',
            products: 'https://admin.test/hryvinskyi_datalayer/setup/products/',
            session: 'https://admin.test/hryvinskyi_datalayer/setup/session/',
            advanced: urlPerScope(state.scopes, 'advanced'),
            close: urlPerScope(state.scopes, 'close'),
        },
        formKey: 'form-key-fixture',
        locale: 'en_US',
        phrases: phrases(),
        plugins: [],
        initialScope: 'default',
        state,
        extensions: {},
    };
}

const MULTI_SCOPES: readonly WireScope[] = [
    { id: 'default', type: 'default', name: 'scope.default', code: 'default', parent: null },
    { id: 'website:1', type: 'website', name: 'scope.main', code: 'main', domain: 'www.example.com', parent: 'default' },
    { id: 'store:1', type: 'store', name: 'scope.main_en', code: 'main_en', parent: 'website:1' },
    { id: 'store:2', type: 'store', name: 'scope.main_fr', code: 'main_fr', parent: 'website:1' },
    { id: 'website:2', type: 'website', name: 'scope.second', code: 'second', domain: 'second.example.com', parent: 'default' },
    { id: 'store:3', type: 'store', name: 'scope.second_en', code: 'second_en', parent: 'website:2' },
];

/** The lock message the deployment configuration reports for `hidden_price` at `website:1`. */
export const LOCK_MESSAGE = 'lock.deployment';

export const multiWebsiteConfig: WirePageConfig = deepFreeze(pageConfig({
    scopes: MULTI_SCOPES,
    settings: withRows(settings(), {
        enabled: { values: { default: true } },
        container_id: { values: { default: 'GTM-AB12CD3', 'website:2': 'GTM-WH45EF6' } },
        item_id: { values: { 'store:1': 'entity_id' } },
        brand: { values: { 'website:2': 'manufacturer' } },
        hidden_price: { locks: { 'website:1': LOCK_MESSAGE }, values: { 'website:1': 'skip' } },
        list_view: { values: { 'store:3': 'visible' } },
        sample_days: { values: { 'website:2': '30' } },
        sample_secret: { values: { default: { set: true } } },
    }),
    events: events({
        default: STANDARD_SELECTION,
        'website:2': { off: ['refund', 'login'], channels: { purchase: 'both' } },
    }),
}));

export const singleWebsiteConfig: WirePageConfig = deepFreeze(pageConfig({
    scopes: [
        { id: 'default', type: 'default', name: 'scope.default', code: 'default', parent: null },
        { id: 'website:1', type: 'website', name: 'scope.main', code: 'main', domain: 'www.example.com', parent: 'default' },
        { id: 'store:1', type: 'store', name: 'scope.main_en', code: 'main_en', parent: 'website:1' },
    ],
    settings: withRows(settings(), {
        enabled: { values: { default: true } },
        container_id: { values: { default: 'GTM-AB12CD3' } },
    }),
    events: events(),
}));

/** A copy of `config` with parts of its state replaced. */
export function withState(config: WirePageConfig, patch: Partial<WireState>): WirePageConfig {
    return deepFreeze({ ...config, state: { ...config.state, ...patch } });
}

/** A copy of `config` with one setting's fields replaced (stored rows, locks, reach, pattern …). */
export function withSetting(config: WirePageConfig, key: string, patch: Partial<WireSetting>): WirePageConfig {
    const list = config.state.settings.map((item) => (item.key === key ? { ...item, ...patch } : item));
    return withState(config, { settings: list });
}

/**
 * A deep copy of `config` with the field at `path` replaced by `value` (or removed when `value` is undefined), for
 * tests that break one field and expect the parser to refuse it. The result is deliberately untyped.
 */
export function withField(config: unknown, path: readonly (string | number)[], value: unknown): unknown {
    const copy: unknown = JSON.parse(JSON.stringify(config));
    let parent: unknown = copy;
    for (const step of path.slice(0, -1)) {
        parent = typeof parent === 'object' && parent !== null ? Reflect.get(parent, step) : undefined;
    }
    const last = path[path.length - 1];
    if (typeof parent !== 'object' || parent === null || last === undefined) {
        throw new TypeError(`No field at ${path.join('.')}`);
    }
    if (value === undefined) {
        Reflect.deleteProperty(parent, last);
    } else {
        Reflect.set(parent, last, value);
    }
    return copy;
}
