<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup\Http;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\ScopeIdInterfaceFactory;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\Http\StoreViewParameterInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\InvalidSetupRequestException;

/**
 * Reads the value as a scope id and accepts it only when it names a store view; the default scope and websites are
 * refused, as is anything that is not a scope id
 */
class StoreViewParameter implements StoreViewParameterInterface
{
    private const STORE = 'store';

    /**
     * @param ScopeIdInterfaceFactory $scopeIdFactory
     */
    public function __construct(
        private readonly ScopeIdInterfaceFactory $scopeIdFactory
    ) {
    }

    /**
     * @inheritDoc
     */
    public function read(mixed $value): int
    {
        $text = is_string($value) ? $value : '';
        try {
            $scope = $this->scopeIdFactory->create(['value' => $text]);
        } catch (\InvalidArgumentException) {
            $scope = null;
        }
        if ($scope === null || $scope->getType() !== self::STORE) {
            throw new InvalidSetupRequestException(
                __('"%1" is not a store view.', is_scalar($value) ? (string) $value : '')
            );
        }

        return $scope->getId();
    }
}
