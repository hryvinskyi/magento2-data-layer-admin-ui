<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\InvalidSetupRequestException;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\ScopeTreeInterface;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\ProductSearch;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\StoreViewCheck;
use Magento\Catalog\Model\ResourceModel\Product\CollectionFactory;
use Magento\Framework\DB\Helper as DbHelper;
use PHPUnit\Framework\TestCase;

/**
 * A search shorter than the minimum, once trimmed, finds nothing without touching the catalogue, and a store view the
 * store does not have is refused before anything is read
 */
class ProductSearchTest extends TestCase
{
    /**
     * Empty, blank and one-character searches find nothing and read no product
     *
     * @return void
     */
    public function testShortSearchFindsNothing(): void
    {
        $collections = $this->createMock(CollectionFactory::class);
        $collections->expects(self::never())->method('create');
        $search = new ProductSearch($collections, $this->createMock(DbHelper::class), $this->storeViewCheck());

        foreach (['', '   ', 'a', ' ø '] as $query) {
            self::assertSame([], $search->search(1, $query), sprintf('"%s"', $query));
        }
    }

    /**
     * A store view the scope tree does not hold, or a website's id, is refused without reading a product
     *
     * @return void
     */
    public function testUnknownStoreViewIsRefused(): void
    {
        $collections = $this->createMock(CollectionFactory::class);
        $collections->expects(self::never())->method('create');
        $search = new ProductSearch($collections, $this->createMock(DbHelper::class), $this->storeViewCheck());

        foreach ([9, 3] as $storeId) {
            try {
                $search->search($storeId, 'backpack');
                self::fail(sprintf('Store view %d was searched.', $storeId));
            } catch (InvalidSetupRequestException $refusal) {
                self::assertSame(sprintf('No store view has the id %d.', $storeId), $refusal->getMessage());
            }
        }
    }

    /**
     * A check over a scope tree with website 3 and its store view 1
     *
     * @return StoreViewCheck
     */
    private function storeViewCheck(): StoreViewCheck
    {
        return new StoreViewCheck(new class implements ScopeTreeInterface {
            /**
             * @inheritDoc
             */
            public function getScopes(): array
            {
                return [
                    ['id' => 'default', 'type' => 'default', 'name' => 'All', 'code' => '', 'parent' => null],
                    ['id' => 'website:3', 'type' => 'website', 'name' => 'W', 'code' => 'w', 'parent' => 'default'],
                    ['id' => 'store:1', 'type' => 'store', 'name' => 'One', 'code' => 'one', 'parent' => 'website:3'],
                ];
            }
        });
    }
}
