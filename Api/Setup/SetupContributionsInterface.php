<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

/**
 * Every module's contribution to the setup wizard's page
 *
 * @api
 */
interface SetupContributionsInterface
{
    /**
     * Get every registered contribution
     *
     * @return list<SetupContributionInterface> In registration order
     */
    public function getContributions(): array;
}
