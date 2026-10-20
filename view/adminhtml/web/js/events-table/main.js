/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Entry point of the events table: binds every table on the settings page once the page is parsed.
 */
import {mountAll} from '@hryvinskyi/data-layer-admin/events-table/widget.js';

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => mountAll(document), {once: true});
} else {
    mountAll(document);
}
