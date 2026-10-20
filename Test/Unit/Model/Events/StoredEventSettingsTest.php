<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Events;

use Hryvinskyi\DataLayer\Model\Data\KnownEvent;
use Hryvinskyi\DataLayerAdminUi\Model\Events\EventGroupLabel;
use Hryvinskyi\DataLayerAdminUi\Model\Events\StoredEventSettings;
use Magento\Framework\Serialize\Serializer\Json;
use PHPUnit\Framework\TestCase;

/**
 * The stored event settings read the same everywhere: names from a comma list or a list, rows from serialized text
 * or loaded rows, and an event without a group listed under "Other"
 */
class StoredEventSettingsTest extends TestCase
{
    /**
     * Names are trimmed, empty names and repeats dropped, stored order kept
     *
     * @return void
     */
    public function testDisabledNames(): void
    {
        $settings = new StoredEventSettings(new Json());

        self::assertSame(['sign_up', 'login'], $settings->disabledNames(' sign_up ,login,,sign_up'));
        self::assertSame(['login', '7', 'purchase'], $settings->disabledNames(['login', 7, ' purchase ', null]));
        self::assertSame([], $settings->disabledNames(''));
        self::assertSame([], $settings->disabledNames(null));
    }

    /**
     * Rows are read from serialized text as stored and from rows as loaded; only pairs of text count
     *
     * @return void
     */
    public function testRoutingRows(): void
    {
        $settings = new StoredEventSettings(new Json());
        $rows = [['event' => 'purchase', 'channel' => 'server'], ['event' => 'login', 'channel' => 'both']];

        self::assertSame($rows, $settings->routingRows(
            '[{"event":"purchase","channel":"server"},{"event":"login"},{"event":"login","channel":"both"},7]'
        ));
        self::assertSame($rows, $settings->routingRows([
            '_1' => ['event' => 'purchase', 'channel' => 'server'],
            '__empty' => '',
            '_2' => ['event' => 'login', 'channel' => 'both'],
        ]));
    }

    /**
     * A routing value that cannot be read is no rows
     *
     * @return void
     */
    public function testUnreadableRoutingIsNoRows(): void
    {
        $settings = new StoredEventSettings(new Json());

        self::assertSame([], $settings->routingRows('{not json'));
        self::assertSame([], $settings->routingRows('"text"'));
        self::assertSame([], $settings->routingRows(''));
        self::assertSame([], $settings->routingRows(null));
        self::assertSame([], $settings->routingRows(false));
    }

    /**
     * An event is listed under its module's group, or under "Other"
     *
     * @return void
     */
    public function testGroupLabel(): void
    {
        $label = new EventGroupLabel();

        self::assertSame('Checkout', $label->labelOf(new KnownEvent('purchase', 'Purchase', 'Checkout')));
        self::assertSame('Other', $label->labelOf(new KnownEvent('lead', 'Lead')));
    }
}
