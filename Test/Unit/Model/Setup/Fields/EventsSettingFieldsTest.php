<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup\Fields;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\EventsSettingStateInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\InvalidSetupRequestException;
use Hryvinskyi\DataLayerAdminUi\Model\Events\StoredEventSettings;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Fields\EventsSettingFields;
use Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup\EventsSettingFixture;
use Magento\Framework\Serialize\Serializer\Json;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * The events setting is posted as the events table posts it: the events switched off as one comma list, a routing row
 * per known event that does not go to the browser and has no fixed channel, then the entries stored for events no
 * module registers, taken from the scope's own values or inherited ones; anything but known events and existing
 * channels is refused
 */
class EventsSettingFieldsTest extends TestCase
{
    use EventsSettingFixture;

    private const DISABLED = EventsSettingStateInterface::DISABLED_PATH;
    private const ROUTING = EventsSettingStateInterface::ROUTING_PATH;

    /**
     * Fixed channels and browser channels are dropped, repeats are posted once, and the scope's own unknown entries
     * follow the selection
     *
     * @return void
     */
    public function testSelectionIsPostedWithTheScopesUnknownEntries(): void
    {
        $posted = $this->fields()->toFieldValues('events', [
            'off' => ['view_item', 'login', 'view_item'],
            'channels' => [
                'purchase' => 'server',
                'view_item' => 'browser',
                'login' => 'both',
                'sample_server_event' => 'browser',
                'ads_conversion' => 'server',
            ],
        ], 'default', $this->eventValues());

        self::assertSame([
            self::DISABLED => 'view_item,login,old_event',
            self::ROUTING => [
                '__empty' => '',
                '_0' => ['event' => 'purchase', 'channel' => 'server'],
                '_1' => ['event' => 'login', 'channel' => 'both'],
                '_2' => ['event' => 'old_event', 'channel' => 'server'],
            ],
        ], $posted);
    }

    /**
     * A scope without values of its own keeps the unknown entries it inherits, each path from its nearest ancestor
     *
     * @return void
     */
    public function testScopeWithoutOwnValuesKeepsInheritedUnknownEntries(): void
    {
        $posted = $this->fields()->toFieldValues(
            'events',
            ['off' => [], 'channels' => []],
            'store:1',
            $this->eventValues()
        );

        self::assertSame([
            self::DISABLED => 'gone_event',
            self::ROUTING => ['__empty' => '', '_0' => ['event' => 'old_event', 'channel' => 'server']],
        ], $posted);
    }

    /**
     * An unknown event already switched off by the selection is not posted twice
     *
     * @return void
     */
    public function testUnknownEntryIsNotRepeated(): void
    {
        $posted = $this->fields()->toFieldValues(
            'events',
            ['off' => ['purchase'], 'channels' => []],
            'website:1',
            $this->eventValues()
        );

        self::assertSame('purchase,gone_event', $posted[self::DISABLED]);
    }

    /**
     * A preview drafts only the disabled-events list, of known events, each once; channels do not change an event
     *
     * @return void
     */
    public function testPreviewDraftsOnlyTheDisabledList(): void
    {
        self::assertSame(
            [self::DISABLED => 'view_item,login'],
            $this->fields()->toPreviewDraft('events', [
                'off' => ['view_item', 'login', 'view_item'],
                'channels' => ['purchase' => 'server'],
            ])
        );
        self::assertSame([self::DISABLED => ''], $this->fields()->toPreviewDraft('events', ['off' => []]));

        $this->expectException(InvalidSetupRequestException::class);
        $this->expectExceptionMessage('"old_event" is not an event');
        $this->fields()->toPreviewDraft('events', ['off' => ['old_event']]);
    }

    /**
     * Both paths, with their fields' reach
     *
     * @return void
     */
    public function testReachesAreTheEventsSettings(): void
    {
        self::assertSame([self::DISABLED => 'store', self::ROUTING => 'store'], $this->fields()->getReaches('events'));
    }

    /**
     * A value that is not a selection of known events and existing channels is refused, saying why
     *
     * @param mixed $value
     * @param string $message
     * @return void
     */
    #[DataProvider('invalidValues')]
    public function testInvalidValueIsRefused(mixed $value, string $message): void
    {
        $this->expectException(InvalidSetupRequestException::class);
        $this->expectExceptionMessage($message);

        $this->fields()->toFieldValues('events', $value, 'default', $this->eventValues());
    }

    /**
     * @return array<string, array{mixed, string}>
     */
    public static function invalidValues(): array
    {
        $shape = 'The events setting takes the events switched off and a channel for each event.';

        return [
            'not a map' => ['view_item', $shape],
            'no channels' => [['off' => []], $shape],
            'no list of events off' => [['channels' => []], $shape],
            'events off as a map' => [['off' => ['a' => 'view_item'], 'channels' => []], $shape],
            'channels as text' => [['off' => [], 'channels' => 'server'], $shape],
            'unknown event off' => [['off' => ['old_event'], 'channels' => []], '"old_event" is not an event'],
            'event off not text' => [['off' => [7], 'channels' => []], '"7" is not an event'],
            'unknown event routed' => [
                ['off' => [], 'channels' => ['old_event' => 'server']],
                '"old_event" is not an event',
            ],
            'channels as a list' => [['off' => [], 'channels' => ['server']], '"0" is not an event'],
            'unknown channel' => [
                ['off' => [], 'channels' => ['purchase' => 'email']],
                '"email" is not a channel. The event purchase can go to the browser, the server or both.',
            ],
            'channel not text' => [
                ['off' => [], 'channels' => ['purchase' => ['server']]],
                '"["server"]" is not a channel',
            ],
        ];
    }

    /**
     * Build the events setting's fields over the fixture's events and values
     *
     * @return EventsSettingFields
     */
    private function fields(): EventsSettingFields
    {
        return new EventsSettingFields(
            $this->eventsSetting(),
            $this->knownEvents(),
            $this->fixedChannels(),
            new StoredEventSettings(new Json())
        );
    }
}
