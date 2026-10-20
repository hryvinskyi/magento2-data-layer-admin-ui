<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\ConfigFieldLookupInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingAccessInterface;
use Magento\Config\Model\Config\Structure;
use Magento\Config\Model\Config\Structure\Element\Section;

/**
 * Finds the section of the configuration page the setting's field belongs to, and asks that section whether the user
 * may open it, as the configuration page does before it shows or saves the section
 */
class SettingAccess implements SettingAccessInterface
{
    /**
     * @param ConfigFieldLookupInterface $fields
     * @param Structure $structure
     */
    public function __construct(
        private readonly ConfigFieldLookupInterface $fields,
        private readonly Structure $structure
    ) {
    }

    /**
     * @inheritDoc
     */
    public function isAllowed(string $configPath): bool
    {
        $field = $this->fields->find($configPath);
        if ($field === null) {
            throw new \InvalidArgumentException(
                sprintf('The configuration page has no field stored under %s.', $configPath)
            );
        }
        $section = $this->structure->getElement(explode('/', $field->getPath())[0]);

        return $section instanceof Section && $section->isAllowed();
    }
}
