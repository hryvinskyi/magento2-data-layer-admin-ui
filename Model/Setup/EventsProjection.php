<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup;

use Hryvinskyi\DataLayer\Api\EventPresetsInterface;
use Hryvinskyi\DataLayer\Api\FixedChannelsInterface;
use Hryvinskyi\DataLayer\Api\KnownEventsInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Events\EventGroupLabelInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Events\StoredEventSettingsInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\EventsProjectionInterface;
use Hryvinskyi\DataLayerApi\Api\Data\EventChannel;

/**
 * The events setting projected for the setup wizard from the registered events, their fixed channels and presets
 *
 * A routing row counts only when its channel exists and the event's channel is not fixed; the last such row of an
 * event wins, as it does on the storefront.
 */
class EventsProjection implements EventsProjectionInterface
{
    /**
     * @param KnownEventsInterface $knownEvents
     * @param FixedChannelsInterface $fixedChannels
     * @param EventPresetsInterface $presets
     * @param StoredEventSettingsInterface $storedSettings
     * @param EventGroupLabelInterface $groupLabel
     */
    public function __construct(
        private readonly KnownEventsInterface $knownEvents,
        private readonly FixedChannelsInterface $fixedChannels,
        private readonly EventPresetsInterface $presets,
        private readonly StoredEventSettingsInterface $storedSettings,
        private readonly EventGroupLabelInterface $groupLabel
    ) {
    }

    /**
     * @inheritDoc
     */
    public function catalogue(): array
    {
        $fixed = $this->fixedChannels->get();
        $catalogue = [];
        foreach ($this->knownEvents->getEvents() as $event) {
            $name = $event->getName();
            $entry = ['name' => $name, 'label' => $event->getLabel(), 'group' => $this->groupLabel->labelOf($event)];
            if ($event->getGroupCode() !== '') {
                $entry['groupCode'] = $event->getGroupCode();
            }
            $entry['trigger'] = $event->getTrigger();
            $entry['source'] = $event->getSource();
            if ($event->getSourceCode() !== '') {
                $entry['sourceCode'] = $event->getSourceCode();
            }
            $entry['browserOriginated'] = $event->isBrowserOriginated();
            $entry['fixedChannel'] = isset($fixed[$name]) ? $fixed[$name]->value : null;
            $catalogue[] = $entry;
        }

        return $catalogue;
    }

    /**
     * @inheritDoc
     */
    public function presets(): array
    {
        $presets = [];
        foreach ($this->presets->getPresets() as $preset) {
            $entry = [
                'key' => $preset->getKey(),
                'label' => $preset->getLabel(),
                'description' => $preset->getDescription(),
            ];
            $icon = $preset->getIcon();
            if ($icon !== null) {
                $entry['icon'] = $icon;
            }
            $entry['events'] = $preset->getEvents();
            $presets[] = $entry;
        }

        return $presets;
    }

    /**
     * @inheritDoc
     */
    public function selection(?string $disabled, ?string $routing): array
    {
        $off = array_values(array_filter(
            $this->storedSettings->disabledNames($disabled ?? ''),
            fn (string $name): bool => $this->knownEvents->isKnown($name)
        ));

        $fixed = $this->fixedChannels->get();
        $channels = [];
        foreach ($this->storedSettings->routingRows($routing ?? '') as $row) {
            $event = $row['event'];
            if (!$this->knownEvents->isKnown($event) || isset($fixed[$event])) {
                continue;
            }
            $channel = EventChannel::tryFrom($row['channel']);
            if ($channel !== null) {
                $channels[$event] = $channel->value;
            }
        }

        return ['off' => $off, 'channels' => $channels];
    }
}
