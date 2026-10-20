<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\BuiltInDefaultsInterface;
use Magento\Framework\App\Config\Initial;
use Magento\Framework\App\Config\ScopeConfigInterface;

/**
 * Reads the default values modules ship in their `etc/config.xml`, never a value stored for the default scope
 */
class BuiltInDefaults implements BuiltInDefaultsInterface
{
    /**
     * @param Initial $initialConfig The merged `etc/config.xml` of every module
     */
    public function __construct(
        private readonly Initial $initialConfig
    ) {
    }

    /**
     * @inheritDoc
     */
    public function read(array $paths): array
    {
        $shipped = $this->initialConfig->getData(ScopeConfigInterface::SCOPE_TYPE_DEFAULT);
        $values = [];
        foreach ($paths as $path) {
            $node = $shipped;
            foreach (explode('/', $path) as $segment) {
                $node = is_array($node) ? ($node[$segment] ?? null) : null;
            }
            $values[$path] = is_scalar($node) ? (string) $node : null;
        }

        return $values;
    }
}
