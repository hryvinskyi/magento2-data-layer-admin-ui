<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Integration\Preview;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\ProductSearchInterface;
use Magento\Catalog\Model\Product\Attribute\Source\Status;
use Magento\Catalog\Model\Product\Visibility;
use PHPUnit\Framework\TestCase;

/**
 * The product search, wired by the real container, finds the store view's enabled, visible products by a fragment
 * of their SKU or of their store-view name, at most ten, by name
 *
 * @magentoAppArea adminhtml
 * @magentoDbIsolation enabled
 */
class ProductSearchTest extends TestCase
{
    use PreviewFixtures;

    /**
     * A SKU fragment and a name fragment both find the product; disabled, invisible and unassigned products are not
     * found
     *
     * @return void
     */
    public function testFindsByFragmentOfSkuOrName(): void
    {
        $lampId = $this->createProduct('DL-PS-LAMP-01', 'Qwyx desk lamp');
        $this->createProduct('DL-PS-LAMP-02', 'Qwyx disabled lamp', Status::STATUS_DISABLED);
        $this->createProduct('DL-PS-LAMP-03', 'Qwyx hidden lamp', visibility: Visibility::VISIBILITY_NOT_VISIBLE);
        $this->createProduct('DL-PS-LAMP-04', 'Qwyx unassigned lamp', websiteIds: []);

        $expected = [['id' => $lampId, 'sku' => 'DL-PS-LAMP-01', 'name' => 'Qwyx desk lamp']];
        self::assertSame($expected, $this->search(' ps-lamp '));
        self::assertSame($expected, $this->search('qwyx'));
    }

    /**
     * `%` and `_` match themselves, not any text
     *
     * @return void
     */
    public function testWildcardsMatchThemselves(): void
    {
        $this->createProduct('DL-PS-PLAIN', 'Zqvb plain');
        $underscoreId = $this->createProduct('DL-PS-UNDER', 'Zqvb 50_50');

        self::assertSame([], $this->search('zqvb%plain'));
        self::assertSame([], $this->search('zqvb_plain'));
        self::assertSame([$underscoreId], array_column($this->search('50_5'), 'id'));
    }

    /**
     * The store view's own name is searched and returned
     *
     * @return void
     */
    public function testStoreViewNameIsUsed(): void
    {
        $productId = $this->createProduct('DL-PS-LOCAL', 'Jxvq default name');
        $this->nameInStoreView($productId, 1, 'Jxvq store view name');

        self::assertSame(
            [['id' => $productId, 'sku' => 'DL-PS-LOCAL', 'name' => 'Jxvq store view name']],
            $this->search('store view name')
        );
    }

    /**
     * At most ten products are found, in name order
     *
     * @return void
     */
    public function testLimitAndOrder(): void
    {
        foreach ([12, 3, 7, 1, 11, 5, 9, 2, 10, 4, 8, 6] as $number) {
            $this->createProduct(sprintf('DL-PS-MANY-%02d', $number), sprintf('Vqzx item %02d', $number));
        }

        self::assertSame(
            array_map(static fn (int $number): string => sprintf('Vqzx item %02d', $number), range(1, 10)),
            array_column($this->search('vqzx'), 'name')
        );
    }

    /**
     * Search store view 1
     *
     * @param string $query
     * @return list<array{id: int, sku: string, name: string}>
     */
    private function search(string $query): array
    {
        return $this->service(ProductSearchInterface::class)->search(1, $query);
    }
}
