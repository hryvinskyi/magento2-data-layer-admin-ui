<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\EventsTable;

use Hryvinskyi\DataLayer\Api\FixedChannelsInterface;
use Hryvinskyi\DataLayer\Api\KnownEventsInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Events\EventGroupLabelInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Events\StoredEventSettingsInterface;
use Hryvinskyi\DataLayerAdminUi\Api\EventsTable\EventsTableBuilderInterface;
use Hryvinskyi\DataLayerApi\Api\Data\EventChannel;

/**
 * Builds the table from the known events, their fixed channels and the stored values, read through the shared
 * readers of the two event settings
 *
 * @phpstan-import-type Table from EventsTableBuilderInterface
 */
class EventsTableBuilder implements EventsTableBuilderInterface
{
    /**
     * @param KnownEventsInterface $knownEvents
     * @param FixedChannelsInterface $fixedChannels
     * @param StoredEventSettingsInterface $storedSettings
     * @param EventGroupLabelInterface $groupLabel
     */
    public function __construct(
        private readonly KnownEventsInterface $knownEvents,
        private readonly FixedChannelsInterface $fixedChannels,
        private readonly StoredEventSettingsInterface $storedSettings,
        private readonly EventGroupLabelInterface $groupLabel
    ) {
    }

    /**
     * @inheritDoc
     */
    public function build(mixed $disabled, mixed $routing): array
    {
        $fixed = $this->fixedChannels->get();
        $off = $this->storedSettings->disabledNames($disabled);
        $routed = $this->storedSettings->routingRows($routing);
        $channels = [];
        $keptRouting = [];
        foreach ($routed as $row) {
            if (!$this->knownEvents->isKnown($row['event'])) {
                $keptRouting[] = $row;
                continue;
            }
            if (EventChannel::tryFrom($row['channel']) !== null) {
                $channels[$row['event']] = $row['channel'];
            }
        }

        $groups = [];
        foreach ($this->knownEvents->getEvents() as $event) {
            $name = $event->getName();
            $group = $this->groupLabel->labelOf($event);
            $groups[$group][] = [
                'event' => $name,
                'label' => $event->getLabel(),
                'trigger' => $event->getTrigger(),
                'hint' => $event->getHint(),
                'source' => $event->getSource(),
                'browser' => $event->isBrowserOriginated(),
                'send' => !in_array($name, $off, true),
                'channel' => isset($fixed[$name]) ? $fixed[$name]->value : ($channels[$name] ?? 'browser'),
                'fixed' => isset($fixed[$name]),
            ];
        }

        $table = [];
        foreach ($groups as $label => $rows) {
            $table[] = ['label' => (string) $label, 'rows' => $rows];
        }

        return [
            'groups' => $table,
            'kept' => [
                'disabled' => array_values(array_filter(
                    $off,
                    fn (string $name): bool => !$this->knownEvents->isKnown($name)
                )),
                'routing' => $keptRouting,
            ],
            'stored' => ['disabled' => $off, 'routing' => $routed],
        ];
    }
}
