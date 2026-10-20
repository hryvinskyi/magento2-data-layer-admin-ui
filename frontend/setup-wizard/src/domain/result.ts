/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The outcome of an operation the domain may refuse: the new value, or a refusal carrying a code (never wording).
 */
export type Result<T, E> =
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly error: E };

export const success = <T>(value: T): { readonly ok: true; readonly value: T } => ({ ok: true, value });

export const failure = <E>(error: E): { readonly ok: false; readonly error: E } => ({ ok: false, error });
