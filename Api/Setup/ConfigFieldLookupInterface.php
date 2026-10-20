<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

use Magento\Config\Model\Config\Structure\Element\Field;

/**
 * Finds the configuration page's field stored under a config path, and decides when there is none
 *
 * The configuration structure answers a path it does not know with an empty field rather than with nothing, so a
 * field without a label counts as missing. Everything the setup wizard reads from the configuration page asks here,
 * so that rule has one home.
 *
 * @api
 */
interface ConfigFieldLookupInterface
{
    /**
     * Find the field stored under a config path
     *
     * A field that stores its value under another path than its place on the page is found by the path it stores
     * under.
     *
     * @param string $configPath
     * @return Field|null Null when the configuration page has no field with a label stored under the path
     */
    public function find(string $configPath): ?Field;
}
