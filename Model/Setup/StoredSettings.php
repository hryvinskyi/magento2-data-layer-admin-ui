<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\ScopeTreeInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\StoredSettingsInterface;
use Magento\Config\Model\ResourceModel\Config\Data\CollectionFactory;
use Magento\Framework\App\Config\ScopeConfigInterface;
use Magento\Store\Model\ScopeInterface;

/**
 * Reads stored config values in one query over every path asked for
 *
 * A row of a scope type other than default, websites and stores is not a setting's value and is left out.
 */
class StoredSettings implements StoredSettingsInterface
{
    private const SCOPE_PREFIXES = [
        ScopeInterface::SCOPE_WEBSITES => ScopeTreeInterface::WEBSITE_PREFIX,
        ScopeInterface::SCOPE_STORES => ScopeTreeInterface::STORE_PREFIX,
    ];

    /**
     * @param CollectionFactory $collectionFactory
     */
    public function __construct(
        private readonly CollectionFactory $collectionFactory
    ) {
    }

    /**
     * @inheritDoc
     */
    public function read(array $paths): array
    {
        if ($paths === []) {
            return [];
        }
        $collection = $this->collectionFactory->create();
        $collection->addFieldToFilter('path', ['in' => $paths]);

        $stored = [];
        foreach ($collection->getItems() as $row) {
            $path = $row->getData('path');
            $scopeId = $this->scopeId($row->getData('scope'), $row->getData('scope_id'));
            if (!is_string($path) || $scopeId === null) {
                continue;
            }
            $value = $row->getData('value');
            $stored[$path][$scopeId] = is_scalar($value) ? (string) $value : null;
        }

        return $stored;
    }

    /**
     * Name a row's scope as the setup wizard does
     *
     * @param mixed $scope The row's scope type
     * @param mixed $scopeId The row's scope id
     * @return string|null Null for a scope type that holds no setting value
     */
    private function scopeId(mixed $scope, mixed $scopeId): ?string
    {
        if ($scope === ScopeConfigInterface::SCOPE_TYPE_DEFAULT) {
            return ScopeTreeInterface::DEFAULT_SCOPE;
        }
        $prefix = is_string($scope) ? (self::SCOPE_PREFIXES[$scope] ?? null) : null;
        $id = is_numeric($scopeId) ? (int) $scopeId : 0;

        return $prefix !== null && $id > 0 ? $prefix . $id : null;
    }
}
