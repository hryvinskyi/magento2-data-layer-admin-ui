<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup;

use PHPUnit\Framework\TestCase;

/**
 * The wizard sees every registered event with its stable codes and fixed channel, every preset, and a stored pair of
 * event settings as a selection of known events
 */
class EventsProjectionTest extends TestCase
{
    use EventsFixture;

    /**
     * Each event carries its texts, the codes its module named, whether the browser detects it and its fixed channel;
     * an event without a group is listed under "Other"
     *
     * @return void
     */
    public function testCatalogue(): void
    {
        $catalogue = $this->eventsProjection()->catalogue();

        self::assertSame(
            ['view_item', 'purchase', 'login', 'sample_server_event', 'ads_conversion'],
            array_column($catalogue, 'name')
        );
        self::assertSame([
            'name' => 'view_item',
            'label' => 'View item',
            'group' => 'Browsing',
            'groupCode' => 'browsing',
            'trigger' => 'Product page viewed',
            'source' => 'Page',
            'sourceCode' => 'page',
            'browserOriginated' => true,
            'fixedChannel' => null,
        ], $catalogue[0]);
        self::assertArrayNotHasKey('groupCode', $catalogue[1]);
        self::assertArrayNotHasKey('sourceCode', $catalogue[1]);
        self::assertSame('Other', $catalogue[2]['group']);
        self::assertSame('server', $catalogue[3]['fixedChannel']);
        self::assertSame('browser', $catalogue[4]['fixedChannel']);
    }

    /**
     * Presets come in preset order with their known events; the icon only when the preset names one
     *
     * @return void
     */
    public function testPresets(): void
    {
        $presets = $this->eventsProjection()->presets();

        self::assertSame([
            ['key' => 'full', 'label' => 'Full', 'description' => '', 'events' => ['view_item', 'purchase']],
            [
                'key' => 'lean',
                'label' => 'Lean',
                'description' => 'Purchases only',
                'icon' => 'bolt',
                'events' => ['purchase'],
            ],
        ], $presets);
    }

    /**
     * Known events are kept off and routed; unknown events, fixed events and channels that do not exist are left
     * out, and the last usable routing row of an event wins
     *
     * @return void
     */
    public function testSelection(): void
    {
        $selection = $this->eventsProjection()->selection(
            ' purchase,old_event,login,purchase',
            '[{"event":"view_item","channel":"both"},{"event":"view_item","channel":"server"},'
            . '{"event":"purchase","channel":"cloud"},{"event":"sample_server_event","channel":"browser"},'
            . '{"event":"ads_conversion","channel":"server"},{"event":"old_event","channel":"server"},'
            . '{"event":"login","channel":"browser"}]'
        );

        self::assertSame(['purchase', 'login'], $selection['off']);
        self::assertSame(['view_item' => 'server', 'login' => 'browser'], $selection['channels']);
    }

    /**
     * Nothing stored is nothing off and nothing routed
     *
     * @return void
     */
    public function testEmptySelection(): void
    {
        self::assertSame(['off' => [], 'channels' => []], $this->eventsProjection()->selection(null, null));
        self::assertSame(['off' => [], 'channels' => []], $this->eventsProjection()->selection('', 'not json'));
    }
}
