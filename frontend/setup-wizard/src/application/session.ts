/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The admin session as the wizard's requests carry it: the form key, the endpoint URLs and the per-scope links.
 * Admin URLs carry a secret key derived from the session, so once the person signs in again every one of them is
 * stale; the page asks the server for fresh ones and every later request uses them. Nothing reads these values once
 * and keeps them: requests and links read the current session each time.
 *
 * A refresh that fails leaves the current session as it is, and rejects with the failure, so the caller can say
 * the session is still not valid. Nothing typed in the wizard depends on it.
 */
import type { ScopeId } from '../domain/scope.ts';

export interface SessionEndpoints {
    readonly save: string;
    readonly preview: string;
    readonly products: string;
    /** Where fresh session values come from; carries no secret key, so it outlives the session. */
    readonly session: string;
}

export interface SessionLinks {
    /** The advanced settings page at each scope. */
    readonly advanced: ReadonlyMap<ScopeId, string>;
    /** Where Close leads at each scope. */
    readonly close: ReadonlyMap<ScopeId, string>;
}

export interface Session {
    readonly formKey: string;
    readonly endpoints: SessionEndpoints;
    readonly links: SessionLinks;
}

/** Asks the server for the session values that are valid now. */
export type SessionReader = (current: Session, signal: AbortSignal) => Promise<Session>;

export interface SessionSource {
    current(): Session;
    /** How many times the session was replaced: a value that changes whenever requests should be asked again. */
    revision(): number;
    /** Replaces the session with the server's current values. @throws whatever the reader throws; the session stays */
    refresh(signal: AbortSignal): Promise<Session>;
    /** Calls `listener` after every replacement; returns the unsubscribe. */
    subscribe(listener: () => void): () => void;
}

export function createSessionSource(initial: Session, read: SessionReader): SessionSource {
    let session = initial;
    let revision = 0;
    const listeners = new Set<() => void>();
    return Object.freeze({
        current: (): Session => session,
        revision: (): number => revision,
        refresh: async (signal: AbortSignal): Promise<Session> => {
            const next = await read(session, signal);
            session = next;
            revision++;
            listeners.forEach((listener) => listener());
            return next;
        },
        subscribe: (listener: () => void): (() => void) => {
            listeners.add(listener);
            return () => void listeners.delete(listener);
        },
    });
}
