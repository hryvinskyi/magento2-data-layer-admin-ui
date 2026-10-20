<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\ScopedValuesInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\EventsProjectionInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\EventsSettingStateInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\ScopeTreeInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingPresentationInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupStateProviderInterface;

/**
 * Reads the events setting from the values of its two paths, each path reaching the scopes its configuration page
 * field shows at
 *
 * @phpstan-import-type ScopeType from ScopeTreeInterface
 * @phpstan-import-type Selection from EventsProjectionInterface
 * @phpstan-import-type WireSelection from SetupStateProviderInterface
 */
class EventsSettingState implements EventsSettingStateInterface
{
    /**
     * @param SettingPresentationInterface $presentation
     * @param EventsProjectionInterface $eventsProjection
     */
    public function __construct(
        private readonly SettingPresentationInterface $presentation,
        private readonly EventsProjectionInterface $eventsProjection
    ) {
    }

    /**
     * @inheritDoc
     */
    public function getReaches(): array
    {
        $reaches = [];
        foreach ([self::DISABLED_PATH, self::ROUTING_PATH] as $path) {
            $reaches[$path] = $this->presentation->present(SetupStateProviderInterface::EVENTS_KEY, $path)['reach'];
        }

        return $reaches;
    }

    /**
     * @inheritDoc
     */
    public function describe(ScopedValuesInterface $values): array
    {
        $reaches = $this->getReaches();
        $own = [];
        foreach ($reaches as $path => $reach) {
            $own[$path] = $values->getOwn($path, $reach);
        }

        $selections = [];
        foreach ($values->getScopes() as $scope) {
            $scopeId = $scope['id'];
            if (!array_key_exists($scopeId, $own[self::DISABLED_PATH])
                && !array_key_exists($scopeId, $own[self::ROUTING_PATH])
            ) {
                continue;
            }
            $raw = $this->effectiveAt($values, $reaches, $scopeId);
            $selections[$scopeId] = $this->wireSelection($this->eventsProjection->selection(
                $raw[self::DISABLED_PATH],
                $raw[self::ROUTING_PATH]
            ));
        }

        return [
            'catalogue' => $this->eventsProjection->catalogue(),
            'presets' => $this->eventsProjection->presets(),
            'builtIn' => $this->wireSelection($this->eventsProjection->selection(
                $values->getBuiltIn(self::DISABLED_PATH),
                $values->getBuiltIn(self::ROUTING_PATH)
            )),
            'values' => $this->map($selections),
            'locks' => $this->map($values->getLocks($reaches)),
        ];
    }

    /**
     * @inheritDoc
     */
    public function readAt(ScopedValuesInterface $values, string $scopeId): array
    {
        return $this->effectiveAt($values, $this->getReaches(), $scopeId);
    }

    /**
     * Get the raw value the store reads at a scope for each path
     *
     * @param ScopedValuesInterface $values
     * @param array<string,ScopeType> $reaches The reach of each path, keyed by path
     * @param string $scopeId
     * @return array<string, string|null> Keyed by path
     */
    private function effectiveAt(ScopedValuesInterface $values, array $reaches, string $scopeId): array
    {
        $raw = [];
        foreach ($reaches as $path => $reach) {
            $raw[$path] = $values->getEffective($path, $reach, $scopeId);
        }

        return $raw;
    }

    /**
     * Shape a selection for the wire
     *
     * @param Selection $selection
     * @return WireSelection
     */
    private function wireSelection(array $selection): array
    {
        return ['off' => $selection['off'], 'channels' => $this->map($selection['channels'])];
    }

    /**
     * Keep a map an object when it is empty, so it encodes as a JSON object rather than an empty list
     *
     * @template T
     * @param array<string,T> $map
     * @return array<string, T>|\stdClass
     */
    private function map(array $map): array|\stdClass
    {
        return $map === [] ? (object) [] : $map;
    }
}
