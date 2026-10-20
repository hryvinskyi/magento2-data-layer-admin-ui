<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\ConfigFieldLookupInterface;
use Magento\Config\Model\Config\Structure;
use Magento\Config\Model\Config\Structure\Element\Field;

/**
 * Asks the configuration structure for the element stored under the path, and keeps it only when it is a field whose
 * label is more than white space
 */
class ConfigFieldLookup implements ConfigFieldLookupInterface
{
    /**
     * @param Structure $structure
     */
    public function __construct(
        private readonly Structure $structure
    ) {
    }

    /**
     * @inheritDoc
     */
    public function find(string $configPath): ?Field
    {
        $field = $this->structure->getElementByConfigPath($configPath);
        if (!$field instanceof Field || trim((string) $field->getLabel()) === '') {
            return null;
        }

        return $field;
    }
}
