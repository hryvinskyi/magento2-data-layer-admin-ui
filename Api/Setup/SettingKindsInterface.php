<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

/**
 * Finds the kind of a setting by its code
 *
 * @api
 */
interface SettingKindsInterface
{
    /**
     * Get the kind registered under a code
     *
     * @param string $code
     * @return SettingKindInterface
     * @throws \InvalidArgumentException When no kind is registered under the code
     */
    public function get(string $code): SettingKindInterface;
}
