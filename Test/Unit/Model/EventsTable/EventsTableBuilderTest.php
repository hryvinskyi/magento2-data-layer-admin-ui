<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\EventsTable;

use Hryvinskyi\DataLayer\Model\FixedChannels;
use Hryvinskyi\DataLayer\Model\KnownEvents;
use Hryvinskyi\DataLayer\Test\Unit\Model\KnownEventFactoryStub;
use Hryvinskyi\DataLayerAdminUi\Model\Events\EventGroupLabel;
use Hryvinskyi\DataLayerAdminUi\Model\Events\StoredEventSettings;
use Hryvinskyi\DataLayerAdminUi\Model\EventsTable\EventsTableBuilder;
use Magento\Framework\Serialize\Serializer\Json;
use PHPUnit\Framework\TestCase;

/**
 * The two stored event settings become one row per known event, grouped as the events were registered; entries for
 * events nobody registers are kept apart, and the stored values come back as read
 */
class EventsTableBuilderTest extends TestCase
{
    /**
     * Rows follow the registration order inside groups that appear where their first event was registered
     *
     * @return void
     */
    public function testRowsAreGroupedInRegistrationOrder(): void
    {
        $table = $this->builder()->build('', []);

        self::assertSame(['Browsing', 'Checkout', 'Account', 'Other'], array_column($table['groups'], 'label'));
        self::assertSame(
            ['view_item', 'select_item'],
            array_column($table['groups'][0]['rows'], 'event')
        );
        self::assertSame(['purchase', 'sample_server_event'], array_column($table['groups'][1]['rows'], 'event'));
        self::assertSame([true, false], array_column($table['groups'][0]['rows'], 'browser'));
        self::assertSame(
            [
                'event' => 'purchase',
                'label' => 'Purchase',
                'trigger' => 'Order placed',
                'hint' => 'Server = when placed or paid',
                'source' => 'Order',
                'browser' => false,
                'send' => true,
                'channel' => 'browser',
                'fixed' => false,
            ],
            $table['groups'][1]['rows'][0]
        );
    }

    /**
     * A row is off when the list names it and goes through the channel of its last usable routing row; a fixed
     * channel wins over any row
     *
     * @return void
     */
    public function testStoredValuesSetSendAndChannel(): void
    {
        $table = $this->builder()->build(' sample_server_event , select_item,sample_server_event,,old_event', [
            '_1' => ['event' => 'purchase', 'channel' => 'both'],
            '_2' => ['event' => 'purchase', 'channel' => 'server'],
            '_3' => ['event' => 'view_item', 'channel' => 'cloud'],
            '_4' => ['event' => 'sample_server_event', 'channel' => 'browser'],
            '_5' => ['event' => 'old_event', 'channel' => 'server'],
            '_6' => ['event' => 'login'],
            '__empty' => '',
        ]);
        $rows = [];
        foreach ($table['groups'] as $group) {
            foreach ($group['rows'] as $row) {
                $rows[$row['event']] = [$row['send'], $row['channel'], $row['fixed']];
            }
        }

        self::assertSame(
            [
                'view_item' => [true, 'browser', false],
                'select_item' => [false, 'browser', false],
                'purchase' => [true, 'server', false],
                'sample_server_event' => [false, 'server', true],
                'login' => [true, 'browser', false],
                'lead' => [true, 'browser', false],
            ],
            $rows
        );
        self::assertSame(
            ['disabled' => ['old_event'], 'routing' => [['event' => 'old_event', 'channel' => 'server']]],
            $table['kept']
        );
        self::assertSame(['sample_server_event', 'select_item', 'old_event'], $table['stored']['disabled']);
        self::assertCount(5, $table['stored']['routing']);
    }

    /**
     * A list of names reads like a comma list, and a routing value that is not rows reads as none
     *
     * @return void
     */
    public function testOtherValueShapes(): void
    {
        $table = $this->builder()->build(['login', 7, ' purchase '], false);

        self::assertSame(['login', '7', 'purchase'], $table['stored']['disabled']);
        self::assertSame([], $table['stored']['routing']);
        self::assertSame(['7'], $table['kept']['disabled']);
    }

    /**
     * A builder over a few described events, one without a group, and sample_server_event fixed to the server
     *
     * @return EventsTableBuilder
     */
    private function builder(): EventsTableBuilder
    {
        return new EventsTableBuilder(
            new KnownEvents(new KnownEventFactoryStub(), [
                'view_item' => ['label' => 'View item', 'group' => 'Browsing', 'trigger' => 'Product page viewed',
                    'source' => 'Page', 'browserOriginated' => true],
                'purchase' => ['label' => 'Purchase', 'group' => 'Checkout', 'trigger' => 'Order placed',
                    'source' => 'Order', 'hint' => 'Server = when placed or paid'],
                'login' => ['label' => 'Login', 'group' => 'Account', 'trigger' => 'Customer logged in',
                    'source' => 'Server'],
                'select_item' => ['label' => 'Select item', 'group' => 'Browsing'],
                'sample_server_event' => [
                    'label' => 'Sample server event',
                    'group' => 'Checkout',
                    'source' => 'Server',
                ],
                'lead' => 'Lead',
            ]),
            new FixedChannels(['sample_server_event' => 'server']),
            new StoredEventSettings(new Json()),
            new EventGroupLabel()
        );
    }
}
