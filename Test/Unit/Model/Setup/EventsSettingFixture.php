<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\EventsSettingStateInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingPresentationInterface;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Data\ScopedValues;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\EventsSettingState;

/**
 * The events setting over a small scope tree: the default scope switches `login` and an unknown event off and routes
 * `view_item` and an unknown event to the server; the website switches `purchase` and another unknown event off; the
 * first store view has nothing of its own; the second fixes its routing in the deployment configuration
 *
 * Both event fields reach store views, unless a test asks for another reach of the routing field.
 */
trait EventsSettingFixture
{
    use EventsFixture;

    /**
     * Build the events setting over a presentation that reports each field's reach
     *
     * @param string $routingReach
     * @return EventsSettingState
     */
    private function eventsSetting(string $routingReach = 'store'): EventsSettingState
    {
        $presentation = new class ($routingReach) implements SettingPresentationInterface {
            /**
             * @param string $routingReach
             */
            public function __construct(private readonly string $routingReach)
            {
            }

            /**
             * @inheritDoc
             */
            public function present(string $key, string $path): array
            {
                $reach = $path === EventsSettingStateInterface::ROUTING_PATH && $this->routingReach === 'website'
                    ? 'website'
                    : 'store';

                return ['label' => 'Label of ' . $path, 'options' => [], 'reach' => $reach];
            }
        };

        return new EventsSettingState($presentation, $this->eventsProjection());
    }

    /**
     * Build the fixture's values of both event paths
     *
     * @return ScopedValues
     */
    private function eventValues(): ScopedValues
    {
        return new ScopedValues(
            [
                ['id' => 'default', 'type' => 'default', 'name' => 'Default', 'code' => '', 'parent' => null],
                ['id' => 'website:1', 'type' => 'website', 'name' => 'Main', 'code' => 'base', 'parent' => 'default'],
                ['id' => 'store:1', 'type' => 'store', 'name' => 'One', 'code' => 'one', 'parent' => 'website:1'],
                ['id' => 'store:2', 'type' => 'store', 'name' => 'Two', 'code' => 'two', 'parent' => 'website:1'],
            ],
            [
                EventsSettingStateInterface::DISABLED_PATH => [
                    'default' => 'login,old_event',
                    'website:1' => 'purchase,gone_event',
                ],
                EventsSettingStateInterface::ROUTING_PATH => [
                    'default' => '[{"event":"old_event","channel":"server"},'
                        . '{"event":"view_item","channel":"server"}]',
                ],
            ],
            [EventsSettingStateInterface::DISABLED_PATH => 'login', EventsSettingStateInterface::ROUTING_PATH => null],
            [
                EventsSettingStateInterface::ROUTING_PATH => [
                    'store:2' => ['message' => 'Fixed.', 'value' => '[{"event":"purchase","channel":"both"}]'],
                ],
            ]
        );
    }
}
