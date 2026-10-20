/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Leaving the page through the browser window the wizard runs in.
 */
import type { Navigator } from '../application/ports.ts';

export interface BrowserWindow {
    readonly location: { assign(url: string): void };
    confirm(message: string): boolean;
}

export function createBrowserNavigator(window: BrowserWindow): Navigator {
    return Object.freeze({
        go: (url: string): void => window.location.assign(url),
        confirmLeave: (text: string): boolean => window.confirm(text),
    });
}
