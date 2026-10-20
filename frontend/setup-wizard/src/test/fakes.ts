/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Fakes of the wizard's ports for tests at every level. The gateway records each call and answers only when the
 * test settles that call, so a test decides the order answers arrive in. Like a server that already answered, it
 * ignores aborts: dropping a late answer is the caller's job.
 */
import type { Logger, Navigator, PreviewRequest, SetupGateway } from '../application/ports.ts';
import type { PreviewResponse, ProductHit, SaveResponse } from '../application/responses.ts';
import type { SaveRequest } from '../domain/diff.ts';
import type { ScopeId } from '../domain/scope.ts';

export interface Deferred<T> {
    readonly promise: Promise<T>;
    resolve(value: T): void;
    reject(error: unknown): void;
}

export function deferred<T>(): Deferred<T> {
    let resolve: (value: T) => void = () => undefined;
    let reject: (error: unknown) => void = () => undefined;
    const promise = new Promise<T>((onResolve, onReject) => {
        resolve = onResolve;
        reject = onReject;
    });
    return { promise, resolve, reject };
}

export interface Call<I, T> {
    readonly input: I;
    readonly signal: AbortSignal;
    readonly answer: Deferred<T>;
}

export interface RecordingGateway extends SetupGateway {
    readonly saves: Call<SaveRequest, SaveResponse>[];
    readonly previews: Call<PreviewRequest, PreviewResponse>[];
    readonly searches: Call<{ readonly store: ScopeId; readonly query: string }, readonly ProductHit[]>[];
}

export function recordingGateway(): RecordingGateway {
    const saves: Call<SaveRequest, SaveResponse>[] = [];
    const previews: Call<PreviewRequest, PreviewResponse>[] = [];
    const searches: Call<{ readonly store: ScopeId; readonly query: string }, readonly ProductHit[]>[] = [];
    const record = <I, T>(calls: Call<I, T>[], input: I, signal: AbortSignal): Promise<T> => {
        const answer = deferred<T>();
        calls.push({ input, signal, answer });
        return answer.promise;
    };
    return {
        saves,
        previews,
        searches,
        save: (request, signal) => record(saves, request, signal),
        preview: (request, signal) => record(previews, request, signal),
        products: (store, query, signal) => record(searches, { store, query }, signal),
    };
}

export interface RecordingNavigator extends Navigator {
    readonly visited: string[];
    readonly asked: string[];
    /** What the next confirmations answer. */
    answer: boolean;
}

export function recordingNavigator(answer = true): RecordingNavigator {
    const navigator: RecordingNavigator = {
        visited: [],
        asked: [],
        answer,
        go: (url) => void navigator.visited.push(url),
        confirmLeave: (text) => {
            navigator.asked.push(text);
            return navigator.answer;
        },
    };
    return navigator;
}

export interface RecordingLogger extends Logger {
    readonly errors: { readonly message: string; readonly detail: unknown }[];
}

export function recordingLogger(): RecordingLogger {
    const errors: { readonly message: string; readonly detail: unknown }[] = [];
    return { errors, error: (message, detail) => void errors.push({ message, detail }) };
}

/** Waits until queued promise callbacks have run. */
export const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
