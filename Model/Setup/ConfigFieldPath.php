<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\ConfigFieldLookupInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\ConfigFieldPathInterface;

/**
 * Asks the field lookup for the field stored under a config path, and refuses a path without one, as the wizard does
 * when it reads a setting's presentation
 */
class ConfigFieldPath implements ConfigFieldPathInterface
{
    /**
     * @param ConfigFieldLookupInterface $fields
     */
    public function __construct(
        private readonly ConfigFieldLookupInterface $fields
    ) {
    }

    /**
     * @inheritDoc
     */
    public function locate(string $configPath): string
    {
        $field = $this->fields->find($configPath);
        if ($field === null) {
            throw new \InvalidArgumentException(
                sprintf('The configuration page has no field stored under %s.', $configPath)
            );
        }

        return $field->getPath();
    }
}
