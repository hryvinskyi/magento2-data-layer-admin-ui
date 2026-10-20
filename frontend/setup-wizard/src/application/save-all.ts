/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Saving every pending change at once.
 *
 * The server's answer decides what is stored: its `state` becomes the new snapshot, because the store normalises
 * what it saves (IDs upper-cased, hosts lower-cased, trailing slashes trimmed) and the browser must show what the
 * database holds, never what it sent. The edits that remain afterwards are the changes the server did not report
 * as saved, so a failed change stays pending beside the server's reason.
 *
 * A request that fails as a whole (expired session, timeout, network, server error) changes nothing: every edit
 * stays and nothing is treated as stored. Its outcome may be unknown (a timed-out save may have reached the
 * store), which is harmless: each change is a set or an inherit, so sending the same changes again leaves the same
 * result. That is also why nothing here retries on its own.
 */
import { changes, toSaveRequest } from '../domain/diff.ts';
import { rebase, type Draft, type Edit, type EditRef } from '../domain/draft.ts';
import type { EventSelection } from '../domain/events.ts';
import { EVENTS_KEY, type EditValue } from '../domain/setting.ts';
import type { SetupState } from '../domain/setup-state.ts';
import type { SetupGateway } from './ports.ts';
import { failureOf, type RequestFailure } from './request-error.ts';
import type { SaveResponse, SaveResult } from './responses.ts';

export type SaveOutcome =
    /** Nothing was pending, so nothing was sent. */
    | { readonly kind: 'unchanged' }
    /** The server answered; some changes may have failed (see `results`). `draft` is the sent draft, settled. */
    | {
        readonly kind: 'completed';
        readonly state: SetupState;
        readonly results: readonly SaveResult[];
        readonly draft: Draft;
    }
    /** The request failed as a whole; the draft is unchanged. `cause` is for the log only. */
    | { readonly kind: 'failed'; readonly failure: RequestFailure; readonly cause: unknown }
    /** The caller gave up (the page is closing); the draft is unchanged. */
    | { readonly kind: 'aborted' };

const refKey = (ref: EditRef): string => `${ref.scope} ${ref.key}`;

/** The pending edit a draft holds for one setting (or the events setting) at one scope. */
function editAt(draft: Draft, ref: EditRef): Edit<EditValue> | Edit<EventSelection> | undefined {
    return ref.key === EVENTS_KEY ? draft.eventEdits.get(ref.scope) : draft.settingEdits.get(ref.key)?.get(ref.scope);
}

/** Changes that failed, each with the server's reason, in the server's order. */
export function failedResults(results: readonly SaveResult[]): readonly SaveResult[] {
    return results.filter((result) => result.status === 'failed');
}

/**
 * The draft after a save answered: the current draft moved onto the server's snapshot, keeping every edit the
 * server did not report as saved, and every edit made after `sent` was taken (a person may keep typing while the
 * request is in flight; an edit replaced since then is a new edit, even with the same value).
 */
export function settleSave(current: Draft, sent: Draft, response: SaveResponse): Draft {
    const saved = new Set(response.results.filter((result) => result.status === 'saved').map(refKey));
    return rebase(
        current,
        response.state,
        (ref) => !saved.has(refKey(ref)) || editAt(current, ref) !== editAt(sent, ref),
    );
}

/** Sends every pending change of the draft in one request. Never throws; never retries. */
export const saveAll = (gateway: SetupGateway) =>
    async (draft: Draft, signal: AbortSignal): Promise<SaveOutcome> => {
        const pending = changes(draft);
        if (pending.length === 0) {
            return { kind: 'unchanged' };
        }
        let response: SaveResponse;
        try {
            response = await gateway.save(toSaveRequest(pending), signal);
        } catch (error) {
            return signal.aborted ? { kind: 'aborted' } : { kind: 'failed', failure: failureOf(error), cause: error };
        }
        return {
            kind: 'completed',
            state: response.state,
            results: response.results,
            draft: settleSave(draft, draft, response),
        };
    };
