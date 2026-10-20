<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Model\Setup\InitialScope;
use PHPUnit\Framework\TestCase;

/**
 * The wizard opens at the store view the request names, else its website, else the default scope; a parameter that
 * names nothing in the scope tree is passed over
 */
class InitialScopeTest extends TestCase
{
    private const SCOPES = [
        ['id' => 'default', 'type' => 'default', 'name' => 'Default', 'code' => 'default', 'parent' => null],
        ['id' => 'website:1', 'type' => 'website', 'name' => 'Main', 'code' => 'base', 'parent' => 'default'],
        ['id' => 'store:1', 'type' => 'store', 'name' => 'English', 'code' => 'en', 'parent' => 'website:1'],
        ['id' => 'store:2', 'type' => 'store', 'name' => 'French', 'code' => 'fr', 'parent' => 'website:1'],
    ];

    /**
     * Each combination of parameters opens where the configuration page was
     *
     * @return void
     */
    public function testOpensAtTheNarrowestScopeNamed(): void
    {
        $initialScope = new InitialScope();
        $cases = [
            'nothing' => [null, null, 'default'],
            'website' => ['1', null, 'website:1'],
            'store view' => [null, '2', 'store:2'],
            'store view and its website' => ['1', '2', 'store:2'],
            'whole number parameters' => [1, 1, 'store:1'],
            'unknown store view' => ['1', '9', 'website:1'],
            'unknown website' => ['7', null, 'default'],
            'not an id' => ['1x', '-2', 'default'],
            'zero' => ['0', '0', 'default'],
            'empty' => ['', '', 'default'],
            'list' => [['1'], ['2'], 'default'],
        ];
        foreach ($cases as $case => [$website, $store, $expected]) {
            self::assertSame($expected, $initialScope->resolve($website, $store, self::SCOPES), $case);
        }
    }
}
