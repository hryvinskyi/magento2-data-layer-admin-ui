<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\ScopedValuesInterface;

/**
 * Reads, in one pass, what is stored, shipped and fixed for config paths across the scope tree
 *
 * @api
 */
interface ScopedValuesReaderInterface
{
    /**
     * Read the values of config paths
     *
     * @param list<string> $paths
     * @return ScopedValuesInterface
     */
    public function read(array $paths): ScopedValuesInterface;
}
