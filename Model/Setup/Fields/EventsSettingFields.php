<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup\Fields;

use Hryvinskyi\DataLayer\Api\FixedChannelsInterface;
use Hryvinskyi\DataLayer\Api\KnownEventsInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Events\StoredEventSettingsInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\ScopedValuesInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\EventsSettingStateInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\InvalidSetupRequestException;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingFieldsInterface;
use Hryvinskyi\DataLayerApi\Api\Data\EventChannel;

/**
 * Saves the events setting: both its paths at once, posted as the configuration page's events table posts them
 *
 * The value is the known events switched off and the channel of each known event; an event no module registers, or a
 * channel that does not exist, is refused. An event whose channel is fixed keeps it, so its channel is dropped, and so
 * is a browser channel: an event without a routing row goes to the browser. Entries stored for events no module
 * registers are kept and written again after the selection, taken from the scope's own values or, at a scope without
 * its own, from the values it inherits, so an event of an absent module stays as it was.
 *
 * An event preview drafts only the disabled-events list: a channel decides where an event goes, not what it holds.
 */
class EventsSettingFields implements SettingFieldsInterface
{
    /**
     * @param EventsSettingStateInterface $eventsSetting
     * @param KnownEventsInterface $knownEvents
     * @param FixedChannelsInterface $fixedChannels
     * @param StoredEventSettingsInterface $storedEvents
     */
    public function __construct(
        private readonly EventsSettingStateInterface $eventsSetting,
        private readonly KnownEventsInterface $knownEvents,
        private readonly FixedChannelsInterface $fixedChannels,
        private readonly StoredEventSettingsInterface $storedEvents
    ) {
    }

    /**
     * @inheritDoc
     */
    public function getReaches(string $key): array
    {
        return $this->eventsSetting->getReaches();
    }

    /**
     * @inheritDoc
     */
    public function toFieldValues(string $key, mixed $value, string $scopeId, ScopedValuesInterface $values): array
    {
        if (!is_array($value) || !is_array($value['off'] ?? null) || !array_is_list($value['off'])
            || !is_array($value['channels'] ?? null)
        ) {
            throw new InvalidSetupRequestException(__(
                'The events setting takes the events switched off and a channel for each event.'
            ));
        }
        $off = $this->off($value['off']);
        $routing = $this->routing($value['channels']);

        $stored = $this->eventsSetting->readAt($values, $scopeId);
        $storedOff = $this->storedEvents->disabledNames($stored[EventsSettingStateInterface::DISABLED_PATH] ?? null);
        foreach ($storedOff as $name) {
            if (!$this->knownEvents->isKnown($name) && !in_array($name, $off, true)) {
                $off[] = $name;
            }
        }
        $storedRows = $this->storedEvents->routingRows($stored[EventsSettingStateInterface::ROUTING_PATH] ?? null);
        foreach ($storedRows as $row) {
            if (!$this->knownEvents->isKnown($row['event'])) {
                $routing[] = $row;
            }
        }

        $rows = ['__empty' => ''];
        foreach ($routing as $index => $row) {
            $rows['_' . $index] = $row;
        }

        return [
            EventsSettingStateInterface::DISABLED_PATH => implode(',', $off),
            EventsSettingStateInterface::ROUTING_PATH => $rows,
        ];
    }

    /**
     * @inheritDoc
     */
    public function toPreviewDraft(string $key, mixed $value): array
    {
        $off = is_array($value) ? ($value['off'] ?? null) : null;
        if (!is_array($off) || !array_is_list($off)) {
            throw new InvalidSetupRequestException(
                __('The events setting needs the events it switches off as a list of names.')
            );
        }

        return [EventsSettingStateInterface::DISABLED_PATH => implode(',', $this->off($off))];
    }

    /**
     * Read the events switched off
     *
     * @param list<mixed> $names
     * @return list<string> Each named once, in the order sent
     * @throws InvalidSetupRequestException When an entry is not a known event
     */
    private function off(array $names): array
    {
        $off = [];
        foreach ($names as $name) {
            $event = $this->known($name);
            if (!in_array($event, $off, true)) {
                $off[] = $event;
            }
        }

        return $off;
    }

    /**
     * Read the channels as routing rows: one per event that does not go to the browser and whose channel is not fixed
     *
     * @param array<mixed> $channels Channel names keyed by event name
     * @return list<array{event: string, channel: string}>
     * @throws InvalidSetupRequestException When an event is not known or a channel does not exist
     */
    private function routing(array $channels): array
    {
        $fixed = $this->fixedChannels->get();
        $rows = [];
        foreach ($channels as $name => $channelName) {
            $event = $this->known($name);
            $channel = is_string($channelName) ? EventChannel::tryFrom($channelName) : null;
            if ($channel === null) {
                throw new InvalidSetupRequestException(__(
                    '"%1" is not a channel. The event %2 can go to the browser, the server or both.',
                    $this->quoted($channelName),
                    $event
                ));
            }
            if (isset($fixed[$event]) || $channel === EventChannel::Browser) {
                continue;
            }
            $rows[] = ['event' => $event, 'channel' => $channel->value];
        }

        return $rows;
    }

    /**
     * Read the name of a known event
     *
     * @param mixed $name
     * @return string
     * @throws InvalidSetupRequestException When the name is not a known event
     */
    private function known(mixed $name): string
    {
        if (!is_string($name) || !$this->knownEvents->isKnown($name)) {
            throw new InvalidSetupRequestException(__(
                '"%1" is not an event this store sends.',
                $this->quoted($name)
            ));
        }

        return $name;
    }

    /**
     * Show a value the browser sent in a message
     *
     * @param mixed $value
     * @return string
     */
    private function quoted(mixed $value): string
    {
        return is_scalar($value) ? (string) $value : (string) json_encode($value);
    }
}
