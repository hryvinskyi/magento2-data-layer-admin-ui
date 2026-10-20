<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\EventsSettingStateInterface;
use PHPUnit\Framework\TestCase;

/**
 * The events setting is set at a scope when either of its paths is, reads the path not set there from the nearest
 * ancestor, leaves unknown events out of the selection but keeps them in the raw values, and is fixed where either path
 * is
 */
class EventsSettingStateTest extends TestCase
{
    use EventsSettingFixture;

    /**
     * Both paths, the disabled-events path first, each with its field's reach
     *
     * @return void
     */
    public function testReaches(): void
    {
        self::assertSame(
            [
                EventsSettingStateInterface::DISABLED_PATH => 'store',
                EventsSettingStateInterface::ROUTING_PATH => 'website',
            ],
            $this->eventsSetting('website')->getReaches()
        );
    }

    /**
     * Scopes with values of their own are reported; the other path is inherited; unknown events are left out
     *
     * @return void
     */
    public function testDescribe(): void
    {
        $events = $this->eventsSetting()->describe($this->eventValues());

        self::assertEquals([
            'default' => ['off' => ['login'], 'channels' => ['view_item' => 'server']],
            'website:1' => ['off' => ['purchase'], 'channels' => ['view_item' => 'server']],
            'store:2' => ['off' => ['purchase'], 'channels' => ['purchase' => 'both']],
        ], $events['values']);
        self::assertEquals(['off' => ['login'], 'channels' => (object) []], $events['builtIn']);
        self::assertSame(['store:2' => 'Fixed.'], $events['locks']);
        self::assertSame(['full', 'lean'], array_column($events['presets'], 'key'));
        self::assertCount(5, $events['catalogue']);
    }

    /**
     * A scope without values of its own reads both raw values, unknown entries included, from its ancestors
     *
     * @return void
     */
    public function testReadAtInheritsEachPathOnItsOwn(): void
    {
        $setting = $this->eventsSetting();

        self::assertSame([
            EventsSettingStateInterface::DISABLED_PATH => 'purchase,gone_event',
            EventsSettingStateInterface::ROUTING_PATH => '[{"event":"old_event","channel":"server"},'
                . '{"event":"view_item","channel":"server"}]',
        ], $setting->readAt($this->eventValues(), 'store:1'));
        self::assertSame(
            'login,old_event',
            $setting->readAt($this->eventValues(), 'default')[EventsSettingStateInterface::DISABLED_PATH]
        );
    }

    /**
     * A routing field that cannot be set per store view ignores the fixed store-view routing
     *
     * @return void
     */
    public function testReachLimitsTheScopesReported(): void
    {
        $events = $this->eventsSetting('website')->describe($this->eventValues());

        self::assertSame(['default', 'website:1'], array_keys((array) $events['values']));
        self::assertEquals((object) [], $events['locks']);
    }
}
