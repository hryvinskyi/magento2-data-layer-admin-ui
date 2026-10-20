<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\StoreViewEmulationInterface;
use Magento\Framework\App\Area;
use Magento\Store\Model\App\Emulation;

/**
 * Emulates a store view's storefront environment for the duration of the work, even when it is already the current
 * store view, and always stops the emulation afterwards
 */
class StoreViewEmulation implements StoreViewEmulationInterface
{
    /**
     * @param Emulation $emulation
     */
    public function __construct(
        private readonly Emulation $emulation
    ) {
    }

    /**
     * @inheritDoc
     */
    public function run(int $storeId, callable $work): mixed
    {
        $this->emulation->startEnvironmentEmulation($storeId, Area::AREA_FRONTEND, true);
        try {
            return $work();
        } finally {
            $this->emulation->stopEnvironmentEmulation();
        }
    }
}
