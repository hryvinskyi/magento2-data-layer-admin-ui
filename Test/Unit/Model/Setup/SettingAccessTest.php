<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\ConfigFieldLookupInterface;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\SettingAccess;
use Magento\Config\Model\Config\Structure;
use Magento\Config\Model\Config\Structure\Element\Field;
use Magento\Config\Model\Config\Structure\Element\Section;
use PHPUnit\Framework\TestCase;

/**
 * A setting is open to the user exactly when the section of the configuration page its field belongs to is, found by
 * the field's place on the page rather than the path it stores under; a path without a field fails loudly
 */
class SettingAccessTest extends TestCase
{
    /**
     * The section of the field's place on the page decides, whatever path the field stores under
     *
     * @return void
     */
    public function testTheFieldsSectionDecides(): void
    {
        $access = $this->access(['open/delivery/enabled' => 'open_section/server/enabled',
            'other/group/field' => 'closed_section/group/field']);

        self::assertTrue($access->isAllowed('open/delivery/enabled'));
        self::assertFalse($access->isAllowed('other/group/field'));
    }

    /**
     * A path without a field is a registration error, not a denial
     *
     * @return void
     */
    public function testPathWithoutAFieldFails(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        $this->access([])->isAllowed('missing/group/field');
    }

    /**
     * Build the check over fields placed as given and two sections, `open_section` allowed and `closed_section` not
     *
     * @param array<string, string> $placed Each field's place on the page, keyed by the path it stores under
     * @return SettingAccess
     */
    private function access(array $placed): SettingAccess
    {
        $fields = $this->createMock(ConfigFieldLookupInterface::class);
        $fields->method('find')->willReturnCallback(function (string $path) use ($placed): ?Field {
            if (!isset($placed[$path])) {
                return null;
            }
            $field = $this->createMock(Field::class);
            $field->method('getPath')->willReturn($placed[$path]);

            return $field;
        });
        $structure = $this->createMock(Structure::class);
        $structure->method('getElement')->willReturnCallback(function (string $id): Section {
            $section = $this->createMock(Section::class);
            $section->method('isAllowed')->willReturn($id === 'open_section');

            return $section;
        });

        return new SettingAccess($fields, $structure);
    }
}
