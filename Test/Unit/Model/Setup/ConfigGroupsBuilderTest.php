<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Model\Setup\ConfigGroupsBuilder;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Field values are nested under their section and groups the way the configuration page posts its form: fields under
 * `fields`, nested groups under `groups`
 */
class ConfigGroupsBuilderTest extends TestCase
{
    /**
     * A field set and a field inherited in one group, a field in a nested group, and fields of a second section
     *
     * @return void
     */
    public function testFieldsAreNestedUnderTheirSectionsAndGroups(): void
    {
        $sections = (new ConfigGroupsBuilder())->build([
            ['path' => 'section/gtm/container_id', 'field' => ['value' => 'GTM-ABC']],
            ['path' => 'section/gtm/script_host', 'field' => ['inherit' => 1]],
            ['path' => 'section/server/delivery/enabled', 'field' => ['value' => '1']],
            ['path' => 'section/events/routing', 'field' => ['value' => ['__empty' => '', '_0' => ['event' => 'a']]]],
            ['path' => 'other/group/field', 'field' => ['value' => 'x']],
        ]);

        self::assertSame([
            'section' => [
                'gtm' => ['fields' => [
                    'container_id' => ['value' => 'GTM-ABC'],
                    'script_host' => ['inherit' => 1],
                ]],
                'server' => ['groups' => ['delivery' => ['fields' => ['enabled' => ['value' => '1']]]]],
                'events' => ['fields' => ['routing' => ['value' => ['__empty' => '', '_0' => ['event' => 'a']]]]],
            ],
            'other' => ['group' => ['fields' => ['field' => ['value' => 'x']]]],
        ], $sections);
    }

    /**
     * A group holds its own fields and its nested groups side by side; a field given twice keeps the later data whole
     *
     * @return void
     */
    public function testFieldsAndNestedGroupsShareAGroup(): void
    {
        $sections = (new ConfigGroupsBuilder())->build([
            ['path' => 'section/server/enabled', 'field' => ['value' => ['a' => 1, 'b' => 2]]],
            ['path' => 'section/server/delivery/transport', 'field' => ['value' => 'ga4']],
            ['path' => 'section/server/enabled', 'field' => ['value' => ['c' => 3]]],
        ]);

        self::assertSame([
            'section' => ['server' => [
                'fields' => ['enabled' => ['value' => ['c' => 3]]],
                'groups' => ['delivery' => ['fields' => ['transport' => ['value' => 'ga4']]]],
            ]],
        ], $sections);
    }

    /**
     * Nothing to build is no sections
     *
     * @return void
     */
    public function testNoFieldsIsNoSections(): void
    {
        self::assertSame([], (new ConfigGroupsBuilder())->build([]));
    }

    /**
     * A path without a section, a group and a field is refused, naming it
     *
     * @param string $path
     * @return void
     */
    #[DataProvider('incompletePaths')]
    public function testIncompletePathIsRefused(string $path): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage(sprintf('"%s" is not a configuration page path', $path));

        (new ConfigGroupsBuilder())->build([['path' => $path, 'field' => ['value' => '1']]]);
    }

    /**
     * @return array<string, array{string}>
     */
    public static function incompletePaths(): array
    {
        return [
            'two segments' => ['section/field'],
            'empty group' => ['section//field'],
            'trailing slash' => ['section/group/'],
        ];
    }
}
