<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\InvalidSetupRequestException;
use Hryvinskyi\DataLayerAdminUi\Model\Events\StoredEventSettings;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Fields\EventsSettingFields;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Fields\RegisteredSettingFields;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Kind\ChoiceKind;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Kind\FlagKind;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Kind\SecretKind;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Kind\TextKind;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\PreviewDraft;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\SettingDescriptors;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\SettingFieldsPool;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\SettingKinds;
use Magento\Framework\Serialize\Serializer\Json;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * The wizard's values become drafted config values in their stored form, each through the way of saving the saver
 * uses: a registered setting under its path through its kind, the events setting as the disabled-events list of known
 * events, a secret not at all; a key the wizard does not know, or a value its setting would not save, is refused
 */
class PreviewDraftTest extends TestCase
{
    use EventsSettingFixture;

    /**
     * Each setting is drafted under its config path in the form its kind stores
     *
     * @return void
     */
    public function testSettingsAreDraftedInTheirStoredForm(): void
    {
        $draft = $this->previewDraft()->toDraft([
            'enabled' => true,
            'tax_catalog' => false,
            'measurement_id' => ' g-abc123 ',
            'item_id' => 'sku',
        ]);

        self::assertSame(
            [
                'section/general/enabled' => '1',
                'section/item/tax_catalog' => '0',
                'section/gtag/measurement_id' => 'G-ABC123',
                'section/item/identifier' => 'sku',
            ],
            $draft
        );
    }

    /**
     * The events setting becomes the comma list of the events it switches off, without repeats; its channels are
     * not drafted
     *
     * @return void
     */
    public function testEventsBecomeTheDisabledList(): void
    {
        $draft = $this->previewDraft()->toDraft([
            'events' => ['off' => ['view_item', 'login', 'view_item'], 'channels' => ['purchase' => 'both']],
        ]);

        self::assertSame(['hryvinskyi_datalayer/events/disabled' => 'view_item,login'], $draft);
    }

    /**
     * No event switched off drafts an empty list, so every event reads as on
     *
     * @return void
     */
    public function testNoEventOffDraftsAnEmptyList(): void
    {
        self::assertSame(
            ['hryvinskyi_datalayer/events/disabled' => ''],
            $this->previewDraft()->toDraft(['events' => ['off' => [], 'channels' => []]])
        );
    }

    /**
     * A secret is never drafted, whether the browser holds only whether it is set or sends a new one
     *
     * @return void
     */
    public function testSecretsAreLeftOut(): void
    {
        $draft = $this->previewDraft()->toDraft([
            'api_secret' => ['set' => true],
            'other_secret' => 'typed-in-the-wizard',
            'enabled' => true,
        ]);

        self::assertSame(['section/general/enabled' => '1'], $draft);
    }

    /**
     * A key that names no wizard setting is refused, naming the key
     *
     * @return void
     */
    public function testUnknownKeyIsRefused(): void
    {
        $this->expectException(InvalidSetupRequestException::class);
        $this->expectExceptionMessage('not_a_setting');

        $this->previewDraft()->toDraft(['enabled' => true, 'not_a_setting' => 'x']);
    }

    /**
     * A value its kind cannot store is refused
     *
     * @return void
     */
    public function testValueOfTheWrongTypeIsRefused(): void
    {
        $this->expectException(InvalidSetupRequestException::class);

        $this->previewDraft()->toDraft(['enabled' => 'yes']);
    }

    /**
     * A value its setting would not save is refused as it would be on save: a choice that is not an option, text
     * that does not match its pattern
     *
     * @return void
     */
    public function testValueTheSaveWouldRefuseIsRefused(): void
    {
        foreach ([['item_id' => 'cost'], ['measurement_id' => 'UA-1234']] as $settings) {
            try {
                $this->previewDraft()->toDraft($settings);
                self::fail('Refused: ' . (string) json_encode($settings));
            } catch (InvalidSetupRequestException $refusal) {
                self::assertStringContainsString((string) array_key_first($settings), $refusal->getMessage());
            }
        }
    }

    /**
     * An events value whose `off` is not a list of names is refused
     *
     * @param mixed $events
     * @return void
     */
    #[DataProvider('malformedEvents')]
    public function testMalformedEventsAreRefused(mixed $events): void
    {
        $this->expectException(InvalidSetupRequestException::class);

        $this->previewDraft()->toDraft(['events' => $events]);
    }

    /**
     * Events values that are not a list of names switched off
     *
     * @return array<string, array{mixed}>
     */
    public static function malformedEvents(): array
    {
        return [
            'not an object' => ['view_item'],
            'no off' => [['channels' => []]],
            'off is text' => [['off' => 'view_item']],
            'off is keyed' => [['off' => ['a' => 'view_item']]],
            'off holds a number' => [['off' => ['view_item', 7]]],
            'off holds an unknown event' => [['off' => ['view_item', 'old_event']]],
        ];
    }

    /**
     * Build the draft over the real ways of saving, descriptors, kinds and the fixture's events
     *
     * @return PreviewDraft
     */
    private function previewDraft(): PreviewDraft
    {
        $presentation = new PresentationStub(['section/item/identifier' => ['sku', 'entity_id']]);
        $kinds = new SettingKinds([
            'flag' => new FlagKind(),
            'choice' => new ChoiceKind($presentation),
            'text' => new TextKind(),
            'secret' => new SecretKind(),
        ]);
        $descriptors = new SettingDescriptors(new SettingDescriptorFactoryStub(), $kinds, [
            'enabled' => ['path' => 'section/general/enabled', 'kind' => 'flag', 'step' => 'connect'],
            'tax_catalog' => ['path' => 'section/item/tax_catalog', 'kind' => 'flag', 'step' => 'products'],
            'measurement_id' => [
                'path' => 'section/gtag/measurement_id',
                'kind' => 'text',
                'step' => 'connect',
                'pattern' => '/^G-[A-Z0-9]+$/D',
                'caseInsensitive' => true,
            ],
            'item_id' => ['path' => 'section/item/identifier', 'kind' => 'choice', 'step' => 'products'],
            'api_secret' => ['path' => 'other/delivery/api_secret', 'kind' => 'secret', 'step' => 'extra'],
            'other_secret' => ['path' => 'other/delivery/other_secret', 'kind' => 'secret', 'step' => 'extra'],
        ]);
        $events = new EventsSettingFields(
            $this->eventsSetting(),
            $this->knownEvents(),
            $this->fixedChannels(),
            new StoredEventSettings(new Json())
        );

        return new PreviewDraft(new SettingFieldsPool(
            new RegisteredSettingFields($descriptors, $kinds, $presentation),
            ['events' => $events]
        ));
    }
}
