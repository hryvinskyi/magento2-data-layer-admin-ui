<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

/**
 * Reads the config values stored for settings, scope by scope
 *
 * Only what is stored: a scope without a stored value is absent, so the reader can tell an inherited value from one
 * set at the scope.
 *
 * @api
 */
interface StoredSettingsInterface
{
    /**
     * Read the stored values of config paths
     *
     * @param list<string> $paths
     * @return array<string, array<string, string|null>> Raw values keyed by path, then by scope id (`default`,
     *     `website:<id>`, `store:<id>`); a path with nothing stored is absent
     */
    public function read(array $paths): array;
}
