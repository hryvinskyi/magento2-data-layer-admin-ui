<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup;

use Hryvinskyi\DataLayer\Model\EventPresets;
use Hryvinskyi\DataLayer\Model\FixedChannels;
use Hryvinskyi\DataLayer\Model\KnownEvents;
use Hryvinskyi\DataLayer\Test\Unit\Model\EventPresetFactoryStub;
use Hryvinskyi\DataLayer\Test\Unit\Model\KnownEventFactoryStub;
use Hryvinskyi\DataLayerAdminUi\Model\Events\EventGroupLabel;
use Hryvinskyi\DataLayerAdminUi\Model\Events\StoredEventSettings;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\EventsProjection;
use Magento\Framework\Serialize\Serializer\Json;

/**
 * A small set of registered events, fixed channels and presets for the events projection
 *
 * Five events: `view_item` (grouped, with codes, detected in the browser), `purchase` (grouped, no codes), `login`
 * (no group), `sample_server_event` (fixed to the server) and `ads_conversion` (fixed to the browser). Two presets:
 * `full` and `lean`, the second with an icon.
 */
trait EventsFixture
{
    /**
     * Build the events projection over the fixture's events
     *
     * @return EventsProjection
     */
    private function eventsProjection(): EventsProjection
    {
        $knownEvents = $this->knownEvents();

        return new EventsProjection(
            $knownEvents,
            $this->fixedChannels(),
            new EventPresets($knownEvents, new EventPresetFactoryStub(), [
                'lean' => ['label' => 'Lean', 'description' => 'Purchases only', 'sortOrder' => 20,
                    'icon' => 'bolt', 'events' => ['purchase' => 'purchase']],
                'full' => ['label' => 'Full', 'sortOrder' => 10,
                    'events' => ['view_item' => 'view_item', 'purchase' => 'purchase', 'gone' => 'gone_event']],
            ]),
            new StoredEventSettings(new Json()),
            new EventGroupLabel()
        );
    }

    /**
     * Build the fixture's registered events
     *
     * @return KnownEvents
     */
    private function knownEvents(): KnownEvents
    {
        return new KnownEvents(new KnownEventFactoryStub(), [
            'view_item' => ['label' => 'View item', 'group' => 'Browsing', 'groupCode' => 'browsing',
                'trigger' => 'Product page viewed', 'source' => 'Page', 'sourceCode' => 'page',
                'browserOriginated' => true],
            'purchase' => ['label' => 'Purchase', 'group' => 'Checkout', 'trigger' => 'Order placed',
                'source' => 'Order'],
            'login' => ['label' => 'Login'],
            'sample_server_event' => ['label' => 'Sample server event', 'group' => 'Checkout'],
            'ads_conversion' => ['label' => 'Ads conversion', 'group' => 'Checkout'],
        ]);
    }

    /**
     * Build the fixture's fixed channels: the sample server event always from the server, Ads conversions always in
     * the browser
     *
     * @return FixedChannels
     */
    private function fixedChannels(): FixedChannels
    {
        return new FixedChannels(['sample_server_event' => 'server', 'ads_conversion' => 'browser']);
    }
}
