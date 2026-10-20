<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

/**
 * Finds how the wizard setting with a key is saved
 *
 * @api
 */
interface SettingFieldsPoolInterface
{
    /**
     * Get how the setting with a key is saved
     *
     * @param string $key
     * @return SettingFieldsInterface
     */
    public function get(string $key): SettingFieldsInterface;
}
