<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Form;

use Hryvinskyi\DataLayerAdminUi\Model\Form\SettingsGroupLink;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * A link to a settings group opens its section at the scope asked for and ends in the anchor of the group's heading
 */
class SettingsGroupLinkTest extends TestCase
{
    /**
     * A group of a section, at the default scope: no website, the group's heading as the anchor
     *
     * @return void
     */
    public function testGroupAtDefaultScope(): void
    {
        self::assertSame(
            ['section' => 'my_section', '_fragment' => 'my_section_my_group-link'],
            (new SettingsGroupLink())->routeParams('my_section/my_group', null)
        );
    }

    /**
     * A group inside another group, at a website: the website, and the anchor of the inner group's heading
     *
     * @return void
     */
    public function testNestedGroupAtWebsite(): void
    {
        self::assertSame(
            ['section' => 'my_section', 'website' => 3, '_fragment' => 'my_section_outer_inner-link'],
            (new SettingsGroupLink())->routeParams('my_section/outer/inner', 3)
        );
    }

    /**
     * A path that names no group of a section is refused
     *
     * @param string $path
     * @return void
     */
    #[DataProvider('pathsWithoutGroup')]
    public function testPathWithoutGroupIsRefused(string $path): void
    {
        $this->expectException(\InvalidArgumentException::class);

        (new SettingsGroupLink())->routeParams($path, null);
    }

    /**
     * Paths that name no group of a section
     *
     * @return array<string, array{string}>
     */
    public static function pathsWithoutGroup(): array
    {
        return [
            'a section alone' => ['my_section'],
            'an empty group' => ['my_section/'],
            'an empty section' => ['/my_group'],
            'nothing' => [''],
        ];
    }
}
