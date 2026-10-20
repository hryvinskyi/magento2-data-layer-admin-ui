<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Model\Setup\Kind\FlagKind;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Kind\TextKind;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\SettingDescriptors;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\SettingKinds;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * The registered wizard settings are read in registration order, and a registration the wizard could not use fails
 * when the list is built
 */
class SettingDescriptorsTest extends TestCase
{
    /**
     * Every field of a registration reaches its description
     *
     * @return void
     */
    public function testRegistrationsBecomeDescriptions(): void
    {
        $descriptors = $this->descriptors([
            'enabled' => ['path' => 'section/general/enabled', 'kind' => 'flag', 'step' => 'connect'],
            'measurement_id' => [
                'path' => 'section/gtag/measurement_id',
                'kind' => 'text',
                'step' => 'connect',
                'pattern' => '/^G-[A-Z0-9]+$/D',
                'caseInsensitive' => true,
            ],
            'retries' => [
                'path' => 'section/queue/retries',
                'kind' => 'text',
                'step' => 'extra-step',
                'min' => '1',
                'max' => 10,
            ],
        ])->getDescriptors();

        self::assertSame(['enabled', 'measurement_id', 'retries'], array_map(
            static fn ($descriptor): string => $descriptor->getKey(),
            $descriptors
        ));
        self::assertSame('section/general/enabled', $descriptors[0]->getPath());
        self::assertSame('flag', $descriptors[0]->getKind());
        self::assertSame('connect', $descriptors[0]->getStep());
        self::assertNull($descriptors[0]->getPattern());
        self::assertFalse($descriptors[0]->isCaseInsensitive());
        self::assertSame('/^G-[A-Z0-9]+$/D', $descriptors[1]->getPattern());
        self::assertTrue($descriptors[1]->isCaseInsensitive());
        self::assertSame('extra-step', $descriptors[2]->getStep());
        self::assertSame(1, $descriptors[2]->getMin());
        self::assertSame(10, $descriptors[2]->getMax());
    }

    /**
     * A setting is found by its key; a key no setting is registered under is refused, naming the key
     *
     * @return void
     */
    public function testSettingIsFoundByItsKey(): void
    {
        $descriptors = $this->descriptors([
            'enabled' => ['path' => 'section/general/enabled', 'kind' => 'flag', 'step' => 'connect'],
            'container_id' => ['path' => 'section/gtm/container_id', 'kind' => 'text', 'step' => 'connect'],
        ]);

        self::assertSame('section/gtm/container_id', $descriptors->get('container_id')->getPath());
        self::assertSame('flag', $descriptors->get('enabled')->getKind());

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('No wizard setting is registered under "missing".');
        $descriptors->get('missing');
    }

    /**
     * A registration the wizard could not use fails loudly, naming what is wrong
     *
     * @param array<mixed> $registrations
     * @param string $message
     * @return void
     */
    #[DataProvider('unusableRegistrations')]
    public function testUnusableRegistrationFails(array $registrations, string $message): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage($message);

        $this->descriptors($registrations);
    }

    /**
     * Registrations that fail, with a part of the message each one fails with
     *
     * @return array<string, array{array<mixed>, string}>
     */
    public static function unusableRegistrations(): array
    {
        $valid = ['path' => 'section/group/field', 'kind' => 'text', 'step' => 'connect'];

        return [
            'key with capitals' => [['Container' => $valid], 'is not a wizard setting key'],
            'key with a dash' => [['container-id' => $valid], 'is not a wizard setting key'],
            'the events key' => [['events' => $valid], 'is not a wizard setting key'],
            'two-segment path' => [
                ['field' => ['path' => 'group/field'] + $valid],
                'at least three segments',
            ],
            'path with an empty segment' => [
                ['field' => ['path' => 'section//field'] + $valid],
                'at least three segments',
            ],
            'unknown kind' => [
                ['field' => ['kind' => 'colour'] + $valid],
                'No setting kind is registered under "colour"',
            ],
            'missing kind' => [['field' => ['path' => 'a/b/c', 'step' => 'connect']], 'needs its kind as text'],
            'step with spaces' => [['field' => ['step' => 'my step'] + $valid], 'needs a step id'],
            'not an array' => [['field' => 'section/group/field'], 'must be registered as an array'],
            'bound not a number' => [['field' => ['min' => 'one'] + $valid], 'needs its min as a whole number'],
            'bounds crossed' => [['field' => ['min' => 5, 'max' => 2] + $valid], 'lower bound above'],
            'case flag not a boolean' => [
                ['field' => ['caseInsensitive' => 'yes'] + $valid],
                'needs caseInsensitive as a boolean',
            ],
            'same path twice' => [
                ['first' => $valid, 'second' => $valid],
                '"first" and "second" are both stored under section/group/field',
            ],
        ];
    }

    /**
     * Build the list from registrations, with the flag and text kinds known
     *
     * @param array<mixed> $registrations
     * @return SettingDescriptors
     */
    private function descriptors(array $registrations): SettingDescriptors
    {
        return new SettingDescriptors(
            new SettingDescriptorFactoryStub(),
            new SettingKinds(['flag' => new FlagKind(), 'text' => new TextKind()]),
            $registrations
        );
    }
}
