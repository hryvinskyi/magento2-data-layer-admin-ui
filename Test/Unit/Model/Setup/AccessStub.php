<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingAccessInterface;

/**
 * Allows every setting except those stored under the paths given
 */
class AccessStub implements SettingAccessInterface
{
    /**
     * @param list<string> $denied
     */
    public function __construct(
        private readonly array $denied = []
    ) {
    }

    /**
     * @inheritDoc
     */
    public function isAllowed(string $configPath): bool
    {
        return !in_array($configPath, $this->denied, true);
    }
}
