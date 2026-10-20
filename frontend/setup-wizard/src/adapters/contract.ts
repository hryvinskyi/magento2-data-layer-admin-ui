/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The wire contract with the server: the JSON shapes it prints and answers (the `Wire*` types), and the parsers
 * that turn them into the wizard's types. Everything arrives as `unknown`; a field of the wrong shape stops the
 * parse with a `ContractError` naming its path, so a half-read state never reaches the screen.
 */
import type {
    JsonObject,
    JsonValue,
    PreviewResponse,
    ProductHit,
    SaveResponse,
    SaveResult,
    TestResult,
} from '../application/responses.ts';
import type { Session } from '../application/session.ts';
import {
    createEventCatalogue,
    isChannel,
    isEventName,
    isPresetKey,
    selectionOf,
    type CatalogueEvent,
    type Channel,
    type EventCatalogue,
    type EventName,
    type EventPreset,
    type EventSelection,
    type FixedChannel,
} from '../domain/events.ts';
import { isEditableAt } from '../domain/inheritance.ts';
import {
    createScopeTree,
    isScopeId,
    isScopeType,
    type Scope,
    type ScopeId,
    type ScopeTree,
    type ScopeType,
} from '../domain/scope.ts';
import {
    createFormatPattern,
    EVENTS_KEY,
    isSettingKey,
    isSettingKind,
    type EventsKey,
    type FormatPattern,
    type SettingDefinition,
    type SettingKey,
    type SettingKind,
    type SettingOption,
    type StoredValue,
} from '../domain/setting.ts';
import type { EventsState, SettingState, SetupState } from '../domain/setup-state.ts';
import { isStepId } from '../domain/steps.ts';

/* ------------------------------------------------------------------------------------------------------------
 * Wire shapes
 * ------------------------------------------------------------------------------------------------------------ */

export interface WireScope {
    readonly id: string;
    readonly type: ScopeType;
    readonly name: string;
    readonly code: string;
    readonly domain?: string;
    readonly parent: string | null;
}

export type WireStoredValue = boolean | string | { readonly set: boolean };

export interface WireSetting {
    readonly key: string;
    readonly path: string;
    readonly kind: SettingKind;
    readonly step: string;
    readonly label: string;
    readonly options: readonly { readonly value: string; readonly label: string }[];
    readonly reach: ScopeType;
    readonly pattern?: { readonly source: string; readonly flags: string };
    readonly min?: number;
    readonly max?: number;
    readonly caseInsensitive?: boolean;
    readonly builtIn: WireStoredValue;
    readonly values: Readonly<Record<string, WireStoredValue>>;
    readonly locks: Readonly<Record<string, string>>;
}

export interface WireCatalogueEvent {
    readonly name: string;
    readonly label: string;
    readonly group: string;
    readonly groupCode?: string;
    readonly trigger: string;
    readonly source: string;
    readonly sourceCode?: string;
    readonly browserOriginated: boolean;
    readonly fixedChannel: FixedChannel | null;
}

export interface WirePreset {
    readonly key: string;
    readonly label: string;
    readonly description: string;
    readonly icon?: string;
    readonly events: readonly string[];
}

export interface WireSelection {
    readonly off: readonly string[];
    readonly channels: Readonly<Record<string, Channel>>;
}

export interface WireEvents {
    readonly catalogue: readonly WireCatalogueEvent[];
    readonly presets: readonly WirePreset[];
    readonly builtIn: WireSelection;
    readonly values: Readonly<Record<string, WireSelection>>;
    readonly locks: Readonly<Record<string, string>>;
}

export interface WireState {
    readonly scopes: readonly WireScope[];
    readonly settings: readonly WireSetting[];
    readonly events: WireEvents;
}

export interface WirePageConfig {
    readonly endpoints: {
        readonly save: string;
        readonly preview: string;
        readonly products: string;
        readonly session: string;
        readonly advanced: Readonly<Record<string, string>>;
        readonly close: Readonly<Record<string, string>>;
    };
    readonly formKey: string;
    readonly locale: string;
    readonly phrases: Readonly<Record<string, string>>;
    readonly plugins: readonly { readonly id: string; readonly module: string }[];
    readonly initialScope: string;
    readonly state: WireState;
    readonly extensions: Readonly<Record<string, unknown>>;
}

/* ------------------------------------------------------------------------------------------------------------
 * Parsed page configuration
 * ------------------------------------------------------------------------------------------------------------ */

export interface PageEndpoints {
    readonly save: string;
    readonly preview: string;
    readonly products: string;
    /** Answers the session values that are valid now, after the person signed in again. */
    readonly session: string;
    /** The advanced settings page at each scope (admin URLs carry a secret key, so one URL per scope). */
    readonly advanced: ReadonlyMap<ScopeId, string>;
    readonly close: ReadonlyMap<ScopeId, string>;
}

export interface PluginReference {
    readonly id: string;
    /** The bare specifier the page's import map resolves. */
    readonly module: string;
}

export interface PageConfig {
    readonly endpoints: PageEndpoints;
    readonly formKey: string;
    /** The admin user's interface locale, for plural rules and number formats. */
    readonly locale: string;
    /** Phrase key → text already translated by the server. */
    readonly phrases: ReadonlyMap<string, string>;
    readonly plugins: readonly PluginReference[];
    readonly initialScope: ScopeId;
    readonly state: SetupState;
    /** Plugin id → data only that plugin reads; parsed by the plugin. */
    readonly extensions: ReadonlyMap<string, unknown>;
}

/* ------------------------------------------------------------------------------------------------------------
 * Primitive readers
 * ------------------------------------------------------------------------------------------------------------ */

/** The server's answer does not have the agreed shape: a bug between the two sides, never a person's mistake. */
export class ContractError extends Error {
    readonly path: string;
    readonly expected: string;

    constructor(path: string, expected: string) {
        super(`${path}: expected ${expected}`);
        this.name = 'ContractError';
        this.path = path;
        this.expected = expected;
    }
}

type Fields = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is Fields =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const at = (path: string, key: string): string => `${path}[${JSON.stringify(key)}]`;

function record(value: unknown, path: string): Fields {
    if (!isRecord(value)) {
        throw new ContractError(path, 'an object');
    }
    return value;
}

function list(value: unknown, path: string): readonly unknown[] {
    if (!Array.isArray(value)) {
        throw new ContractError(path, 'an array');
    }
    return value;
}

function text(value: unknown, path: string): string {
    if (typeof value !== 'string') {
        throw new ContractError(path, 'a string');
    }
    return value;
}

function filledText(value: unknown, path: string): string {
    const parsed = text(value, path);
    if (parsed.trim() === '') {
        throw new ContractError(path, 'a non-empty string');
    }
    return parsed;
}

function bool(value: unknown, path: string): boolean {
    if (typeof value !== 'boolean') {
        throw new ContractError(path, 'a boolean');
    }
    return value;
}

function finite(value: unknown, path: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new ContractError(path, 'a finite number');
    }
    return value;
}

function branded<T extends string>(guard: (raw: string) => raw is T, value: unknown, path: string, expected: string): T {
    if (typeof value !== 'string' || !guard(value)) {
        throw new ContractError(path, expected);
    }
    return value;
}

/** An optional field: absent and `null` both mean "not given". */
function optional<T>(fields: Fields, key: string, path: string, read: (value: unknown, path: string) => T): T | undefined {
    const value = fields[key];
    return value === undefined || value === null ? undefined : read(value, `${path}.${key}`);
}

function items<T>(value: unknown, path: string, read: (item: unknown, path: string) => T): readonly T[] {
    return list(value, path).map((item, index) => read(item, `${path}[${index}]`));
}

function scopeIn(tree: ScopeTree, raw: string, path: string): ScopeId {
    if (!isScopeId(raw) || !tree.has(raw)) {
        throw new ContractError(path, 'a scope id of the scope tree');
    }
    return raw;
}

/** An object keyed by scope id: every key is a scope of the tree. */
function byScope<T>(
    value: unknown,
    path: string,
    tree: ScopeTree,
    read: (item: unknown, path: string, scope: ScopeId) => T,
): ReadonlyMap<ScopeId, T> {
    const parsed = new Map<ScopeId, T>();
    for (const [key, item] of Object.entries(record(value, path))) {
        const scope = scopeIn(tree, key, at(path, key));
        parsed.set(scope, read(item, at(path, key), scope));
    }
    return parsed;
}

function parseJson(value: unknown, path: string): JsonValue {
    if (value === null || typeof value === 'boolean' || typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number') {
        return finite(value, path);
    }
    if (Array.isArray(value)) {
        return items(value, path, parseJson);
    }
    return parseJsonObject(value, path);
}

function parseJsonObject(value: unknown, path: string): JsonObject {
    const parsed: Record<string, JsonValue> = {};
    for (const [key, item] of Object.entries(record(value, path))) {
        parsed[key] = parseJson(item, at(path, key));
    }
    return parsed;
}

/* ------------------------------------------------------------------------------------------------------------
 * State
 * ------------------------------------------------------------------------------------------------------------ */

function parseScope(value: unknown, path: string): Scope {
    const fields = record(value, path);
    const domain = optional(fields, 'domain', path, text);
    const parent = fields['parent'] === null ? null : branded(isScopeId, fields['parent'], `${path}.parent`, 'a scope id or null');
    return {
        id: branded(isScopeId, fields['id'], `${path}.id`, 'a scope id'),
        type: branded(isScopeType, fields['type'], `${path}.type`, 'default, website or store'),
        name: text(fields['name'], `${path}.name`),
        code: text(fields['code'], `${path}.code`),
        ...(domain === undefined ? {} : { domain }),
        parent,
    };
}

function parseTree(value: unknown, path: string): ScopeTree {
    const tree = createScopeTree(items(value, path, parseScope));
    if (!tree.ok) {
        throw new ContractError(path, `a scope tree (refused: ${tree.error.code} at ${tree.error.scope})`);
    }
    return tree.value;
}

/** How each kind's stored value arrives: a flag as a boolean, a secret as whether it is set, the rest as text. */
const STORED_READERS = {
    flag: bool,
    choice: text,
    text,
    number: text,
    secret: (value: unknown, path: string): StoredValue => ({ set: bool(record(value, path)['set'], `${path}.set`) }),
} as const satisfies Record<SettingKind, (value: unknown, path: string) => StoredValue>;

function parseOption(value: unknown, path: string): SettingOption {
    const fields = record(value, path);
    return { value: text(fields['value'], `${path}.value`), label: text(fields['label'], `${path}.label`) };
}

function parsePattern(value: unknown, path: string): FormatPattern {
    const fields = record(value, path);
    const pattern = createFormatPattern(text(fields['source'], `${path}.source`), text(fields['flags'], `${path}.flags`));
    if (!pattern.ok) {
        throw new ContractError(path, 'an ECMAScript pattern without the global or sticky flag');
    }
    return pattern.value;
}

function parseSetting(value: unknown, path: string, tree: ScopeTree): SettingState {
    const fields = record(value, path);
    const kind = branded(isSettingKind, fields['kind'], `${path}.kind`, 'flag, choice, text, secret or number');
    const pattern = optional(fields, 'pattern', path, parsePattern);
    const min = optional(fields, 'min', path, finite);
    const max = optional(fields, 'max', path, finite);
    const definition: SettingDefinition = {
        key: branded(isSettingKey, fields['key'], `${path}.key`, 'a setting key ([a-z0-9_]+, not "events")'),
        path: filledText(fields['path'], `${path}.path`),
        kind,
        step: branded(isStepId, fields['step'], `${path}.step`, 'a step id'),
        label: text(fields['label'], `${path}.label`),
        options: items(fields['options'], `${path}.options`, parseOption),
        reach: branded(isScopeType, fields['reach'], `${path}.reach`, 'default, website or store'),
        ...(pattern === undefined ? {} : { pattern }),
        ...(min === undefined ? {} : { min }),
        ...(max === undefined ? {} : { max }),
        caseInsensitive: optional(fields, 'caseInsensitive', path, bool) ?? false,
    };
    const readStored = STORED_READERS[kind];
    const withinReach = (item: unknown, itemPath: string, scope: ScopeId): StoredValue => {
        if (!isEditableAt(definition, tree.get(scope))) {
            throw new ContractError(itemPath, 'a scope within the setting\'s reach');
        }
        return readStored(item, itemPath);
    };
    return {
        definition,
        builtIn: readStored(fields['builtIn'], `${path}.builtIn`),
        stored: byScope(fields['values'], `${path}.values`, tree, withinReach),
        locks: byScope(fields['locks'], `${path}.locks`, tree, text),
    };
}

function parseSettings(value: unknown, path: string, tree: ScopeTree): ReadonlyMap<SettingKey, SettingState> {
    const settings = new Map<SettingKey, SettingState>();
    list(value, path).forEach((item, index) => {
        const setting = parseSetting(item, `${path}[${index}]`, tree);
        if (settings.has(setting.definition.key)) {
            throw new ContractError(`${path}[${index}].key`, 'a key no other setting uses');
        }
        settings.set(setting.definition.key, setting);
    });
    return settings;
}

const isCode = (raw: string): raw is string => /^[a-z_]+$/.test(raw);
const isFixedChannel = (raw: string): raw is FixedChannel => isChannel(raw);

function parseCatalogueEvent(value: unknown, path: string): CatalogueEvent {
    const fields = record(value, path);
    const groupCode = optional(fields, 'groupCode', path, (item, itemPath) => branded(isCode, item, itemPath, 'a code ([a-z_]+)'));
    const sourceCode = optional(fields, 'sourceCode', path, (item, itemPath) => branded(isCode, item, itemPath, 'a code ([a-z_]+)'));
    const fixed = fields['fixedChannel'];
    return {
        name: branded(isEventName, fields['name'], `${path}.name`, 'an event name'),
        label: text(fields['label'], `${path}.label`),
        group: text(fields['group'], `${path}.group`),
        ...(groupCode === undefined ? {} : { groupCode }),
        trigger: text(fields['trigger'], `${path}.trigger`),
        source: text(fields['source'], `${path}.source`),
        ...(sourceCode === undefined ? {} : { sourceCode }),
        browserOriginated: bool(fields['browserOriginated'], `${path}.browserOriginated`),
        fixedChannel: fixed === null ? null : branded(isFixedChannel, fixed, `${path}.fixedChannel`, 'browser, server, both or null'),
    };
}

function parseCatalogue(value: unknown, path: string): EventCatalogue {
    const catalogue = createEventCatalogue(items(value, path, parseCatalogueEvent));
    if (!catalogue.ok) {
        throw new ContractError(path, `events with unique names (repeated: ${catalogue.error})`);
    }
    return catalogue.value;
}

function parseEventName(value: unknown, path: string): EventName {
    return branded(isEventName, value, path, 'an event name');
}

function parsePreset(value: unknown, path: string): EventPreset {
    const fields = record(value, path);
    const icon = optional(fields, 'icon', path, text);
    return {
        key: branded(isPresetKey, fields['key'], `${path}.key`, 'a preset key ([a-z0-9_]+, not "custom")'),
        label: text(fields['label'], `${path}.label`),
        description: text(fields['description'], `${path}.description`),
        ...(icon === undefined ? {} : { icon }),
        events: new Set(items(fields['events'], `${path}.events`, parseEventName)),
    };
}

function parsePresets(value: unknown, path: string): readonly EventPreset[] {
    const presets = items(value, path, parsePreset);
    const keys = new Set<string>();
    presets.forEach((preset, index) => {
        if (keys.has(preset.key)) {
            throw new ContractError(`${path}[${index}].key`, 'a key no other preset uses');
        }
        keys.add(preset.key);
    });
    return presets;
}

function parseSelection(value: unknown, path: string, catalogue: EventCatalogue): EventSelection {
    const fields = record(value, path);
    const channels: [EventName, Channel][] = Object.entries(record(fields['channels'], `${path}.channels`))
        .map(([name, channel]) => [
            parseEventName(name, at(`${path}.channels`, name)),
            branded(isChannel, channel, at(`${path}.channels`, name), 'browser, server or both'),
        ]);
    return selectionOf(catalogue, items(fields['off'], `${path}.off`, parseEventName), channels);
}

function parseEvents(value: unknown, path: string, tree: ScopeTree): EventsState {
    const fields = record(value, path);
    const catalogue = parseCatalogue(fields['catalogue'], `${path}.catalogue`);
    const readSelection = (item: unknown, itemPath: string): EventSelection => parseSelection(item, itemPath, catalogue);
    return {
        catalogue,
        presets: parsePresets(fields['presets'], `${path}.presets`),
        builtIn: readSelection(fields['builtIn'], `${path}.builtIn`),
        stored: byScope(fields['values'], `${path}.values`, tree, readSelection),
        locks: byScope(fields['locks'], `${path}.locks`, tree, text),
    };
}

/** The stored snapshot (the page config's `state`, and a save's answer). */
export function parseState(value: unknown, path = '$'): SetupState {
    const fields = record(value, path);
    const tree = parseTree(fields['scopes'], `${path}.scopes`);
    return {
        tree,
        settings: parseSettings(fields['settings'], `${path}.settings`, tree),
        events: parseEvents(fields['events'], `${path}.events`, tree),
    };
}

/* ------------------------------------------------------------------------------------------------------------
 * Page configuration
 * ------------------------------------------------------------------------------------------------------------ */

/** A URL for every scope of the tree, and only for those. */
function urlPerScope(value: unknown, path: string, tree: ScopeTree): ReadonlyMap<ScopeId, string> {
    const urls = byScope(value, path, tree, filledText);
    const missing = tree.scopes.find((scope) => !urls.has(scope.id));
    if (missing !== undefined) {
        throw new ContractError(at(path, missing.id), 'a URL for every scope');
    }
    return urls;
}

function parsePlugins(value: unknown, path: string): readonly PluginReference[] {
    const ids = new Set<string>();
    return items(value, path, (item, itemPath) => {
        const fields = record(item, itemPath);
        const id = filledText(fields['id'], `${itemPath}.id`);
        if (ids.has(id)) {
            throw new ContractError(`${itemPath}.id`, 'an id no other plugin uses');
        }
        ids.add(id);
        return { id, module: filledText(fields['module'], `${itemPath}.module`) };
    });
}

function textsByKey(value: unknown, path: string): ReadonlyMap<string, string> {
    return new Map(Object.entries(record(value, path)).map(([key, item]) => [key, text(item, at(path, key))]));
}

/** The page configuration the wizard's template prints. */
export function parsePageConfig(value: unknown): PageConfig {
    const fields = record(value, '$');
    const state = parseState(fields['state'], '$.state');
    const endpoints = record(fields['endpoints'], '$.endpoints');
    return {
        endpoints: {
            save: filledText(endpoints['save'], '$.endpoints.save'),
            preview: filledText(endpoints['preview'], '$.endpoints.preview'),
            products: filledText(endpoints['products'], '$.endpoints.products'),
            session: filledText(endpoints['session'], '$.endpoints.session'),
            advanced: urlPerScope(endpoints['advanced'], '$.endpoints.advanced', state.tree),
            close: urlPerScope(endpoints['close'], '$.endpoints.close', state.tree),
        },
        formKey: filledText(fields['formKey'], '$.formKey'),
        locale: filledText(fields['locale'], '$.locale'),
        phrases: textsByKey(fields['phrases'], '$.phrases'),
        plugins: parsePlugins(fields['plugins'], '$.plugins'),
        initialScope: scopeIn(state.tree, text(fields['initialScope'], '$.initialScope'), '$.initialScope'),
        state,
        extensions: new Map(Object.entries(record(fields['extensions'], '$.extensions'))),
    };
}

/** The session values the page was printed with. */
export function sessionOf(config: PageConfig): Session {
    const { save, preview, products, session, advanced, close } = config.endpoints;
    return { formKey: config.formKey, endpoints: { save, preview, products, session }, links: { advanced, close } };
}

/* ------------------------------------------------------------------------------------------------------------
 * Endpoint answers
 * ------------------------------------------------------------------------------------------------------------ */

/** A URL per scope id; a scope the server sent no URL for has no link. */
function urlByScopeId(value: unknown, path: string): ReadonlyMap<ScopeId, string> {
    const urls = new Map<ScopeId, string>();
    for (const [key, item] of Object.entries(record(value, path))) {
        urls.set(branded(isScopeId, key, at(path, key), 'a scope id'), filledText(item, at(path, key)));
    }
    return urls;
}

/**
 * The session endpoint's answer: the form key, the endpoint URLs and the per-scope links that are valid now. When
 * the answer names no session endpoint, the current one stays: it carries no secret key, so it never goes stale.
 */
export function parseSession(value: unknown, current: Session): Session {
    const fields = record(value, '$');
    const endpoints = record(fields['endpoints'], '$.endpoints');
    const links = record(fields['links'], '$.links');
    return {
        formKey: filledText(fields['formKey'], '$.formKey'),
        endpoints: {
            save: filledText(endpoints['save'], '$.endpoints.save'),
            preview: filledText(endpoints['preview'], '$.endpoints.preview'),
            products: filledText(endpoints['products'], '$.endpoints.products'),
            session: optional(endpoints, 'session', '$.endpoints', filledText) ?? current.endpoints.session,
        },
        links: {
            advanced: urlByScopeId(links['advanced'], '$.links.advanced'),
            close: urlByScopeId(links['close'], '$.links.close'),
        },
    };
}

const isChangeKey = (raw: string): raw is SettingKey | EventsKey => raw === EVENTS_KEY || isSettingKey(raw);
const isSaveStatus = (raw: string): raw is SaveResult['status'] => raw === 'saved' || raw === 'failed';

/** The save endpoint's answer: a result per change, and the snapshot after the save. */
export function parseSaveResponse(value: unknown): SaveResponse {
    const fields = record(value, '$');
    const state = parseState(fields['state'], '$.state');
    const results = items(fields['results'], '$.results', (item, path): SaveResult => {
        const result = record(item, path);
        const message = optional(result, 'message', path, text);
        return {
            scope: scopeIn(state.tree, text(result['scope'], `${path}.scope`), `${path}.scope`),
            key: branded(isChangeKey, result['key'], `${path}.key`, 'a setting key or "events"'),
            status: branded(isSaveStatus, result['status'], `${path}.status`, 'saved or failed'),
            ...(message === undefined ? {} : { message }),
        };
    });
    return { results, state };
}

const PREVIEW_READERS = {
    sent: (fields: Fields): PreviewResponse => ({ status: 'sent', event: parseJsonObject(fields['event'], '$.event') }),
    not_sent: (fields: Fields): PreviewResponse => ({ status: 'not_sent', reason: text(fields['reason'], '$.reason') }),
    unavailable: (fields: Fields): PreviewResponse => ({ status: 'unavailable', reason: text(fields['reason'], '$.reason') }),
} as const satisfies Record<PreviewResponse['status'], (fields: Fields) => PreviewResponse>;

const isPreviewStatus = (raw: string): raw is keyof typeof PREVIEW_READERS => Object.hasOwn(PREVIEW_READERS, raw);

/** The preview endpoint's answer. */
export function parsePreviewResponse(value: unknown): PreviewResponse {
    const fields = record(value, '$');
    const status = branded(isPreviewStatus, fields['status'], '$.status', 'sent, not_sent or unavailable');
    return PREVIEW_READERS[status](fields);
}

/** The product search's answer. */
export function parseProducts(value: unknown): readonly ProductHit[] {
    return items(value, '$', (item, path): ProductHit => {
        const fields = record(item, path);
        const id = fields['id'];
        if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) {
            throw new ContractError(`${path}.id`, 'a positive integer');
        }
        return { id, sku: text(fields['sku'], `${path}.sku`), name: text(fields['name'], `${path}.name`) };
    });
}

/** A test event's answer. */
export function parseTestResult(value: unknown): TestResult {
    const fields = record(value, '$');
    return {
        valid: bool(fields['valid'], '$.valid'),
        messages: items(fields['messages'], '$.messages', text),
        error: text(fields['error'], '$.error'),
    };
}

/**
 * Whether a thrown value is a contract error. Matched by name and shape rather than `instanceof`, because the shell
 * and each step plugin are separate bundles.
 */
export function isContractError(error: unknown): error is ContractError {
    return error instanceof Error
        && error.name === 'ContractError'
        && typeof Reflect.get(error, 'path') === 'string'
        && typeof Reflect.get(error, 'expected') === 'string';
}
