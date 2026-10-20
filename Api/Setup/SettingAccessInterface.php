<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

/**
 * Whether the signed-in admin user may see and change a setting
 *
 * A module may join the wizard with a setting whose field sits in another section of the configuration page; the
 * wizard shows and saves it only for a user that section's access rule allows, as the configuration page would.
 *
 * @api
 */
interface SettingAccessInterface
{
    /**
     * Whether the user may see and change the setting stored under a config path
     *
     * @param string $configPath
     * @return bool
     * @throws \InvalidArgumentException When the configuration page has no field stored under the path
     */
    public function isAllowed(string $configPath): bool;
}
