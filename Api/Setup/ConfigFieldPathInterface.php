<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

/**
 * Finds where on the configuration page the field stored under a config path sits
 *
 * @api
 */
interface ConfigFieldPathInterface
{
    /**
     * Get the configuration page path of the field stored under a config path
     *
     * The two differ for a field that stores its value under another path than its place on the page.
     *
     * @param string $configPath
     * @return string `section/group/field`, with any nested groups between the section and the field
     * @throws \InvalidArgumentException When the configuration page has no field stored under the path
     */
    public function locate(string $configPath): string;
}
