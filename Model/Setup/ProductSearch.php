<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\ProductSearchInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\StoreViewCheckInterface;
use Magento\Catalog\Model\Product\Attribute\Source\Status;
use Magento\Catalog\Model\Product\Visibility;
use Magento\Catalog\Model\ResourceModel\Product\CollectionFactory;
use Magento\Framework\DB\Helper as DbHelper;

/**
 * Searches the store view's products through a product collection, reading the store view's own names and statuses
 * with the default ones where it has none
 *
 * The store view is checked against the scope tree before anything is read. `%`, `_` and `\` in the text are escaped,
 * so they match themselves rather than act as wildcards.
 *
 * The search needs no catalogue permission beyond the wizard's own: it returns only what the storefront itself shows
 * every visitor of the store view (the id, SKU and name of enabled products visible in its catalog or search), so the
 * data layer's settings permission is enough.
 */
class ProductSearch implements ProductSearchInterface
{
    private const VISIBLE = [
        Visibility::VISIBILITY_IN_CATALOG,
        Visibility::VISIBILITY_IN_SEARCH,
        Visibility::VISIBILITY_BOTH,
    ];

    /**
     * @param CollectionFactory $collectionFactory
     * @param DbHelper $dbHelper
     * @param StoreViewCheckInterface $storeViewCheck
     */
    public function __construct(
        private readonly CollectionFactory $collectionFactory,
        private readonly DbHelper $dbHelper,
        private readonly StoreViewCheckInterface $storeViewCheck
    ) {
    }

    /**
     * @inheritDoc
     */
    public function search(int $storeId, string $query): array
    {
        $this->storeViewCheck->assertExists($storeId);
        $query = trim($query);
        if (mb_strlen($query) < self::MIN_QUERY_LENGTH) {
            return [];
        }
        $contains = $this->dbHelper->escapeLikeValue($query, ['position' => 'any']);

        $collection = $this->collectionFactory->create();
        $collection->setStoreId($storeId);
        $collection->addStoreFilter($storeId)
            ->addAttributeToSelect('name')
            ->addAttributeToFilter('status', ['eq' => Status::STATUS_ENABLED])
            ->addAttributeToFilter('visibility', ['in' => self::VISIBLE])
            ->addAttributeToFilter([
                ['attribute' => 'name', 'like' => $contains],
                ['attribute' => 'sku', 'like' => $contains],
            ])
            ->addAttributeToSort('name', 'ASC')
            ->addAttributeToSort('entity_id', 'ASC')
            ->setPageSize(self::LIMIT)
            ->setCurPage(1);

        $found = [];
        foreach ($collection->getItems() as $product) {
            $id = $product->getId();
            $sku = $product->getData('sku');
            $name = $product->getData('name');
            $found[] = [
                'id' => is_numeric($id) ? (int) $id : 0,
                'sku' => is_scalar($sku) ? (string) $sku : '',
                'name' => is_scalar($name) ? (string) $name : '',
            ];
        }

        return $found;
    }
}
