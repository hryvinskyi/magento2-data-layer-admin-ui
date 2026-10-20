<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup;

/**
 * What a test's fakes did, in the order they did it
 */
class CallLog
{
    /**
     * @var list<string>
     */
    private array $entries = [];

    /**
     * Note one thing that happened
     *
     * @param string $entry
     * @return void
     */
    public function add(string $entry): void
    {
        $this->entries[] = $entry;
    }

    /**
     * Get everything noted, in order
     *
     * @return list<string>
     */
    public function entries(): array
    {
        return $this->entries;
    }
}
