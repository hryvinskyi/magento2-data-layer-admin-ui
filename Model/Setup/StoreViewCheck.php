<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\InvalidSetupRequestException;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\ScopeTreeInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\StoreViewCheckInterface;

/**
 * Looks the store view's scope id up in the scope tree
 */
class StoreViewCheck implements StoreViewCheckInterface
{
    /**
     * @param ScopeTreeInterface $scopeTree
     */
    public function __construct(
        private readonly ScopeTreeInterface $scopeTree
    ) {
    }

    /**
     * @inheritDoc
     */
    public function assertExists(int $storeId): void
    {
        $scopeId = ScopeTreeInterface::STORE_PREFIX . $storeId;
        foreach ($this->scopeTree->getScopes() as $scope) {
            if ($scope['id'] === $scopeId) {
                return;
            }
        }

        throw new InvalidSetupRequestException(__('No store view has the id %1.', $storeId));
    }
}
