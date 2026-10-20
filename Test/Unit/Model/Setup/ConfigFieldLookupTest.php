<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Model\Setup\ConfigFieldLookup;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\ConfigFieldPath;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\SettingPresentation;
use Magento\Config\Model\Config\Structure;
use Magento\Config\Model\Config\Structure\Element\Field;
use Magento\Config\Model\Config\Structure\Element\Group;
use Magento\Config\Model\Config\Structure\ElementInterface;
use PHPUnit\Framework\TestCase;

/**
 * A config path has a field only when the structure answers with a field whose label is more than white space; the
 * placeholder the structure gives for an unknown path, and an element that is not a field, count as no field. Both
 * readers of the configuration page refuse such a path the same way.
 */
class ConfigFieldLookupTest extends TestCase
{
    /**
     * A labelled field is found; a placeholder field, a blank label or a group is not
     *
     * @return void
     */
    public function testOnlyALabelledFieldCounts(): void
    {
        $labelled = $this->field('Enabled', 'section/general/enabled');
        $lookup = new ConfigFieldLookup($this->structure([
            'section/general/enabled' => $labelled,
            'section/general/unknown' => $this->field('', 'section/general/unknown'),
            'section/general/blank' => $this->field("  \n", 'section/general/blank'),
            'section/general' => $this->createMock(Group::class),
        ]));

        self::assertSame($labelled, $lookup->find('section/general/enabled'));
        self::assertNull($lookup->find('section/general/unknown'));
        self::assertNull($lookup->find('section/general/blank'));
        self::assertNull($lookup->find('section/general'));
    }

    /**
     * The field path and the presentation readers both refuse a path the lookup finds no field for, and read the
     * field it finds
     *
     * @return void
     */
    public function testBothReadersAskTheLookup(): void
    {
        $lookup = new ConfigFieldLookup($this->structure([
            'section/channels/routing' => $this->field(' Event routing ', 'section/events/routing'),
            'section/general/unknown' => $this->field('', ''),
        ]));
        $fieldPath = new ConfigFieldPath($lookup);
        $presentation = new SettingPresentation($lookup);

        self::assertSame('section/events/routing', $fieldPath->locate('section/channels/routing'));
        self::assertSame('Event routing', $presentation->present('routing', 'section/channels/routing')['label']);
        foreach ([
            static fn () => $fieldPath->locate('section/general/unknown'),
            static fn () => $presentation->present('unknown', 'section/general/unknown'),
        ] as $read) {
            try {
                $read();
                self::fail('A path without a labelled field was read.');
            } catch (\InvalidArgumentException $refusal) {
                self::assertStringContainsString('section/general/unknown', $refusal->getMessage());
            }
        }
    }

    /**
     * A structure that answers each path with the element given for it
     *
     * @param array<string, ElementInterface> $elements
     * @return Structure
     */
    private function structure(array $elements): Structure
    {
        $structure = $this->createMock(Structure::class);
        $structure->method('getElementByConfigPath')->willReturnCallback(
            static fn (string $path): ElementInterface => $elements[$path]
        );

        return $structure;
    }

    /**
     * A field with a label and a page path, showing at every scope
     *
     * @param string $label
     * @param string $path
     * @return Field
     */
    private function field(string $label, string $path): Field
    {
        $field = $this->createMock(Field::class);
        $field->method('getLabel')->willReturn($label);
        $field->method('getPath')->willReturn($path);
        $field->method('getOptions')->willReturn([]);
        $field->method('showInStore')->willReturn(true);

        return $field;
    }
}
