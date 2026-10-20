<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup\Data;

use Hryvinskyi\DataLayerAdminUi\Model\Setup\Data\ScopeId;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * A scope id is read from `default`, `website:<id>` or `store:<id>` and written back the same; anything else is refused
 */
class ScopeIdTest extends TestCase
{
    /**
     * Each well-formed scope id reads its type and id, and writes back as it was read
     *
     * @param string $value
     * @param string $type
     * @param int $id
     * @return void
     */
    #[DataProvider('scopeIds')]
    public function testWellFormedScopeIdIsRead(string $value, string $type, int $id): void
    {
        $scopeId = new ScopeId($value);

        self::assertSame($type, $scopeId->getType());
        self::assertSame($id, $scopeId->getId());
        self::assertSame($value, $scopeId->toString());
    }

    /**
     * Anything but a well-formed scope id is refused, naming it
     *
     * @param string $value
     * @return void
     */
    #[DataProvider('notScopeIds')]
    public function testMalformedScopeIdIsRefused(string $value): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage(sprintf('"%s" is not a scope.', $value));

        new ScopeId($value);
    }

    /**
     * @return array<string, array{string, string, int}>
     */
    public static function scopeIds(): array
    {
        return [
            'default' => ['default', 'default', 0],
            'website' => ['website:1', 'website', 1],
            'store view' => ['store:42', 'store', 42],
        ];
    }

    /**
     * @return array<string, array{string}>
     */
    public static function notScopeIds(): array
    {
        return [
            'empty' => [''],
            'capitalised default' => ['Default'],
            'website without id' => ['website:'],
            'zero id' => ['store:0'],
            'leading zero' => ['store:01'],
            'negative id' => ['website:-1'],
            'plural type' => ['stores:1'],
            'trailing text' => ['store:1 '],
            'trailing line break' => ["store:1\n"],
        ];
    }
}
