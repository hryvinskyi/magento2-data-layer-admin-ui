<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

/**
 * Checks that a store view a setup wizard request names is one of the store's
 *
 * A store view is one of the store's when the wizard's scope tree holds it, so a deleted store view, or the admin
 * store, is refused.
 *
 * @api
 */
interface StoreViewCheckInterface
{
    /**
     * Refuse a store view id the scope tree does not hold
     *
     * @param int $storeId
     * @return void
     * @throws InvalidSetupRequestException When no store view of the scope tree has the id
     */
    public function assertExists(int $storeId): void;
}
