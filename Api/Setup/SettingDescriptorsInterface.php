<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\SettingDescriptorInterface;

/**
 * Every setting the setup wizard edits, as the modules that add wizard steps registered them
 *
 * A module adds its settings as items of the `descriptors` argument of this module's implementation in its own
 * `etc/adminhtml/di.xml`.
 *
 * @api
 */
interface SettingDescriptorsInterface
{
    /**
     * Get every registered setting
     *
     * @return list<SettingDescriptorInterface> In registration order
     */
    public function getDescriptors(): array;

    /**
     * Get the setting registered under a key
     *
     * @param string $key
     * @return SettingDescriptorInterface
     * @throws InvalidSetupRequestException When no setting is registered under the key; the reason names the key
     */
    public function get(string $key): SettingDescriptorInterface;
}
