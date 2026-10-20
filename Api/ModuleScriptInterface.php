<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api;

/**
 * Renders the tags that load an admin page's ES module whose own modules import one another by name
 *
 * The modules import by name rather than by relative file name, so each published file can carry whatever name the
 * static content gives it (a minified copy is published as `.min.js`): an import map printed right before the entry
 * resolves each name to its file's static address.
 */
interface ModuleScriptInterface
{
    /**
     * Render the import map of the given modules, then the entry as an external ES module
     *
     * @param string $entryFileId The entry's file id (`Vendor_Module::js/file.js`)
     * @param array<string,string> $imports The file ids of the modules imported by name, keyed by that name
     * @return string
     * @throws \InvalidArgumentException When an import is not the file id of a module script, or the import map cannot
     *     be written as JSON
     * @throws \Magento\Framework\Exception\LocalizedException When a module's file cannot be resolved
     */
    public function render(string $entryFileId, array $imports): string;
}
