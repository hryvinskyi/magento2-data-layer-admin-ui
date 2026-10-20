<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

/**
 * Reads the values modules ship for settings: what applies when no scope stores one
 *
 * @api
 */
interface BuiltInDefaultsInterface
{
    /**
     * Read the shipped values of config paths
     *
     * @param list<string> $paths
     * @return array<string, string|null> Keyed by path; null when no module ships a value for it
     */
    public function read(array $paths): array;
}
