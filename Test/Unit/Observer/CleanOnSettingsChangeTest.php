<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Observer;

use Hryvinskyi\DataLayer\Api\CachedDataCleanerInterface;
use Hryvinskyi\DataLayerAdminUi\Observer\CleanOnSettingsChange;
use Magento\Framework\App\Cache\TypeListInterface;
use Magento\Framework\Event\Observer;
use PHPUnit\Framework\TestCase;

/**
 * Saving the settings drops what the data layer cached and marks the full page cache invalidated
 */
class CleanOnSettingsChangeTest extends TestCase
{
    /**
     * The data layer's cached data is dropped once and the full page cache type is invalidated
     *
     * @return void
     */
    public function testDropsCachedDataAndInvalidatesFullPages(): void
    {
        $cachedData = $this->createMock(CachedDataCleanerInterface::class);
        $cachedData->expects(self::once())->method('clean');
        $types = $this->createMock(TypeListInterface::class);
        $types->expects(self::once())->method('invalidate')->with('full_page');

        (new CleanOnSettingsChange($cachedData, $types))->execute(new Observer());
    }
}
