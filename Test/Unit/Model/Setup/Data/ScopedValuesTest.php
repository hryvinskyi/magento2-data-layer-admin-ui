<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup\Data;

use Hryvinskyi\DataLayerAdminUi\Model\Setup\Data\ScopedValues;
use PHPUnit\Framework\TestCase;

/**
 * Scoped values report a scope's own value only within the tree and the path's reach, let a fixed value replace a
 * stored one, and read a scope's value from itself, its nearest ancestor, then the shipped value; a fixed value counts
 * as the scope's own even when the store reads nothing there
 */
class ScopedValuesTest extends TestCase
{
    private const PATH = 'section/group/field';
    private const OTHER = 'section/group/other';
    private const LOCK = 'Fixed.';

    /**
     * Rows outside the tree and below the reach are not the path's own values; a fixed value replaces the stored one
     *
     * @return void
     */
    public function testOwnValues(): void
    {
        $values = $this->values();

        self::assertSame(
            ['default' => 'D', 'website:1' => 'W1', 'store:1' => 'S1', 'website:2' => 'LOCKED'],
            $values->getOwn(self::PATH, 'store')
        );
        self::assertSame(
            ['default' => 'D', 'website:1' => 'W1', 'website:2' => 'LOCKED'],
            $values->getOwn(self::PATH, 'website')
        );
        self::assertSame(['default' => 'D'], $values->getOwn(self::PATH, 'default'));
        self::assertSame([], $values->getOwn('section/group/nothing', 'store'));
    }

    /**
     * A scope reads its own value, else its nearest ancestor's, else the shipped value
     *
     * @return void
     */
    public function testEffectiveValue(): void
    {
        $values = $this->values();

        self::assertSame('S1', $values->getEffective(self::PATH, 'store', 'store:1'));
        self::assertSame('W1', $values->getEffective(self::PATH, 'store', 'store:2'));
        self::assertSame('LOCKED', $values->getEffective(self::PATH, 'store', 'store:3'));
        self::assertSame('W1', $values->getEffective(self::PATH, 'website', 'store:1'));
        self::assertSame('SHIPPED', $values->getEffective(self::OTHER, 'store', 'store:1'));
        self::assertNull($values->getEffective(self::OTHER, 'store', 'store:3'));
        self::assertSame('O2', $values->getEffective(self::OTHER, 'store', 'store:2'));
        self::assertNull($values->getEffective('section/group/nothing', 'store', 'store:1'));
    }

    /**
     * A scope fixed for any of the paths within its reach is fixed, in scope tree order
     *
     * @return void
     */
    public function testLocks(): void
    {
        $values = $this->values();

        self::assertSame(
            ['website:2' => self::LOCK, 'store:3' => self::LOCK],
            $values->getLocks([self::PATH => 'store', self::OTHER => 'store'])
        );
        self::assertSame(
            ['website:2' => self::LOCK],
            $values->getLocks([self::PATH => 'website', self::OTHER => 'website'])
        );
        self::assertSame([], $values->getLocks([self::OTHER => 'website']));
    }

    /**
     * Only scopes of the tree have a type, and a scope is reached when its type is no narrower than the reach
     *
     * @return void
     */
    public function testTypesAndReach(): void
    {
        $values = $this->values();

        self::assertSame('store', $values->getType('store:1'));
        self::assertSame('default', $values->getType('default'));
        self::assertNull($values->getType('store:99'));
        self::assertTrue($values->reaches('website:1', 'website'));
        self::assertFalse($values->reaches('store:1', 'website'));
        self::assertFalse($values->reaches('store:99', 'store'));
        self::assertSame('default', $values->getScopes()[0]['id']);
    }

    /**
     * Two websites, the first with two store views, the second with one; rows of a deleted store view and website;
     * the second website fixed for the main path, the third store view for the other
     *
     * @return ScopedValues
     */
    private function values(): ScopedValues
    {
        $lock = static fn (?string $value): array => ['message' => self::LOCK, 'value' => $value];

        return new ScopedValues(
            [
                ['id' => 'default', 'type' => 'default', 'name' => 'Default', 'code' => '', 'parent' => null],
                ['id' => 'website:1', 'type' => 'website', 'name' => 'Main', 'code' => 'base', 'parent' => 'default'],
                ['id' => 'store:1', 'type' => 'store', 'name' => 'One', 'code' => 'one', 'parent' => 'website:1'],
                ['id' => 'store:2', 'type' => 'store', 'name' => 'Two', 'code' => 'two', 'parent' => 'website:1'],
                ['id' => 'website:2', 'type' => 'website', 'name' => 'Trade', 'code' => 'tr', 'parent' => 'default'],
                ['id' => 'store:3', 'type' => 'store', 'name' => 'Three', 'code' => 'three', 'parent' => 'website:2'],
            ],
            [
                self::PATH => [
                    'default' => 'D',
                    'website:1' => 'W1',
                    'store:1' => 'S1',
                    'website:2' => 'W2',
                    'store:99' => 'ORPHAN',
                    'website:9' => 'ORPHAN',
                ],
                self::OTHER => ['store:2' => 'O2'],
            ],
            [self::PATH => 'SHIPPED-MAIN', self::OTHER => 'SHIPPED'],
            [
                self::PATH => ['website:2' => $lock('LOCKED'), 'store:99' => $lock('X')],
                self::OTHER => ['store:3' => $lock(null)],
            ]
        );
    }
}
