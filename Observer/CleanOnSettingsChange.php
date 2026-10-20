<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Observer;

use Hryvinskyi\DataLayer\Api\CachedDataCleanerInterface;
use Magento\Framework\App\Cache\TypeListInterface;
use Magento\Framework\Event\Observer;
use Magento\Framework\Event\ObserverInterface;

/**
 * Drops everything the data layer cached when its settings are saved, and tells the admin pages need a refresh
 *
 * Full pages carry the list data they were rendered with, so the full page cache is marked invalidated rather than
 * cleaned behind the admin's back.
 */
class CleanOnSettingsChange implements ObserverInterface
{
    private const FULL_PAGE_CACHE_TYPE = 'full_page';

    /**
     * @param CachedDataCleanerInterface $cachedData
     * @param TypeListInterface $cacheTypes
     */
    public function __construct(
        private readonly CachedDataCleanerInterface $cachedData,
        private readonly TypeListInterface $cacheTypes
    ) {
    }

    /**
     * @inheritDoc
     */
    public function execute(Observer $observer): void
    {
        $this->cachedData->clean();
        $this->cacheTypes->invalidate(self::FULL_PAGE_CACHE_TYPE);
    }
}
