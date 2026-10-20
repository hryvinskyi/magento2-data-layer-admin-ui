/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The Google connection: choosing how pages load Google, and what each storefront page at a scope will load.
 */
import { CONTAINER_ID, ENABLED, MEASUREMENT_ID, SCRIPT_HOST } from './core-keys.ts';
import { effectiveAt, isWithinReach, lockAt, resetAt, setValue, withModePick, type Draft, type DraftRefusal } from './draft.ts';
import { MODE_EXCLUDES, type Mode } from './mode.ts';
import { failure, success, type Result } from './result.ts';
import type { ScopeId } from './scope.ts';
import { flagOf, textOf, type SettingKey } from './setting.ts';
import { checkFormat, normalisedText } from './validation.ts';
import type { SettingsView } from './view.ts';

export const STANDARD_SCRIPT_HOST = 'www.googletagmanager.com';

const isBlankAt = (draft: Draft, scope: ScopeId, key: SettingKey): boolean =>
    textOf(effectiveAt(draft, scope, key)).trim() === '';

/**
 * Empties an ID at a scope with the fewest pending changes. When the scope's stored state already leaves the ID
 * empty there (the value only came from an edit made in this session), the edit is dropped and nothing is left to
 * save. Only a non-empty value the scope stores itself or inherits is overridden with an empty one of its own.
 */
function clearAt(draft: Draft, scope: ScopeId, key: SettingKey, excluded: boolean): Result<Draft, DraftRefusal> {
    if (!excluded || !draft.state.settings.has(key) || isBlankAt(draft, scope, key)) {
        return success(draft);
    }
    const restored = resetAt(draft, { scope, key });
    if (isBlankAt(restored, scope, key)) {
        return success(restored);
    }
    return setValue(draft, scope, key, '');
}

/** The IDs a mode leaves out, in the order a person reads them. */
function excludedIds(mode: Mode): readonly SettingKey[] {
    const excludes = MODE_EXCLUDES[mode];
    return [...(excludes.container ? [CONTAINER_ID] : []), ...(excludes.measurement ? [MEASUREMENT_ID] : [])];
}

/** Whether choosing a mode can empty the ID at the scope: it is empty already, or only a pending edit fills it, or it can be set there. */
function canEmptyAt(draft: Draft, scope: ScopeId, key: SettingKey): boolean {
    if (!draft.state.settings.has(key) || isBlankAt(draft, scope, key) || isBlankAt(resetAt(draft, { scope, key }), scope, key)) {
        return true;
    }
    return isWithinReach(draft, scope, key) && lockAt(draft, scope, key) === undefined;
}

/**
 * The ID that keeps a mode from being chosen at a scope: one the mode leaves out that still has a value there, while
 * deployment configuration locks it there or the scope lies below its reach. Null when the mode can be chosen.
 */
export function modeBlocker(draft: Draft, scope: ScopeId, mode: Mode): SettingKey | null {
    if (!draft.state.tree.has(scope)) {
        return null;
    }
    return excludedIds(mode).find((key) => !canEmptyAt(draft, scope, key)) ?? null;
}

/** Whether a mode can be chosen at a scope: every ID it would empty there is empty already, or can be changed there. */
export function canChooseMode(draft: Draft, scope: ScopeId, mode: Mode): boolean {
    return draft.state.tree.has(scope) && modeBlocker(draft, scope, mode) === null;
}

/**
 * Pick a mode at a scope. An ID the mode leaves out ends up empty at this scope, so the storefront stops loading
 * it: an edit that alone made it non-empty is dropped, any other non-empty value is overridden with an empty one.
 * The pick itself is remembered for the session.
 */
export function chooseMode(draft: Draft, scope: ScopeId, mode: Mode): Result<Draft, DraftRefusal> {
    if (!draft.state.tree.has(scope)) {
        return failure('unknown_scope');
    }
    const excludes = MODE_EXCLUDES[mode];
    const withoutContainer = clearAt(draft, scope, CONTAINER_ID, excludes.container);
    if (!withoutContainer.ok) {
        return withoutContainer;
    }
    const withoutMeasurement = clearAt(withoutContainer.value, scope, MEASUREMENT_ID, excludes.measurement);
    if (!withoutMeasurement.ok) {
        return withoutMeasurement;
    }
    return success(withModePick(withoutMeasurement.value, scope, mode));
}

export type Loader = 'gtm' | 'gtag';
/** `waiting`: no ID yet. `invalid`: an ID or the host has the wrong form, so nothing is output. */
export type LoaderLineState = 'ok' | 'waiting' | 'invalid';
export type LoaderState = 'off' | LoaderLineState;

export interface LoaderLine {
    readonly loader: Loader;
    readonly state: LoaderLineState;
    /** The script address, only when the line is ok. */
    readonly url?: string;
}

function hasFormatIssue(view: SettingsView, key: SettingKey): boolean {
    const definition = view.definition(key);
    const value = view.value(key);
    return definition !== undefined && value !== undefined && checkFormat(definition, value) !== null;
}

function idOf(view: SettingsView, key: SettingKey): string {
    const definition = view.definition(key);
    const text = textOf(view.value(key));
    return definition === undefined ? text.trim() : normalisedText(definition, text);
}

function gtmLine(view: SettingsView): LoaderLine {
    const id = idOf(view, CONTAINER_ID);
    if (id === '') {
        return { loader: 'gtm', state: 'waiting' };
    }
    if (hasFormatIssue(view, CONTAINER_ID) || hasFormatIssue(view, SCRIPT_HOST)) {
        return { loader: 'gtm', state: 'invalid' };
    }
    const host = idOf(view, SCRIPT_HOST) || STANDARD_SCRIPT_HOST;
    return { loader: 'gtm', state: 'ok', url: `https://${host}/gtm.js?id=${encodeURIComponent(id)}` };
}

function gtagLine(view: SettingsView): LoaderLine {
    const id = idOf(view, MEASUREMENT_ID);
    if (id === '') {
        return { loader: 'gtag', state: 'waiting' };
    }
    if (hasFormatIssue(view, MEASUREMENT_ID)) {
        return { loader: 'gtag', state: 'invalid' };
    }
    return {
        loader: 'gtag',
        state: 'ok',
        url: `https://${STANDARD_SCRIPT_HOST}/gtag/js?id=${encodeURIComponent(id)}`,
    };
}

/** The scripts a storefront page at the view's scope loads, in the order the page prints them; none while off. */
export function loaderLines(view: SettingsView): readonly LoaderLine[] {
    if (!flagOf(view.value(ENABLED))) {
        return [];
    }
    const mode = view.mode();
    const lines: LoaderLine[] = [];
    if (!MODE_EXCLUDES[mode].container) {
        lines.push(gtmLine(view));
    }
    if (!MODE_EXCLUDES[mode].measurement) {
        lines.push(gtagLine(view));
    }
    return lines;
}

/** Off while sending is off; otherwise invalid beats waiting beats ok. */
export function loaderState(view: SettingsView): LoaderState {
    if (!flagOf(view.value(ENABLED))) {
        return 'off';
    }
    const states = loaderLines(view).map((line) => line.state);
    if (states.includes('invalid')) {
        return 'invalid';
    }
    return states.includes('waiting') ? 'waiting' : 'ok';
}
