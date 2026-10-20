<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\ScopedValuesInterface;

/**
 * The events setting as the setup wizard reads it: one setting over two stored paths, the disabled-events list and
 * the routing rows
 *
 * It is set at a scope when either path is, and its value there is both paths as the store reads them at that scope,
 * the one not set there inherited from the nearest ancestor that sets it, else shipped. It is fixed at a scope when
 * either path is.
 *
 * @phpstan-import-type ScopeType from ScopeTreeInterface
 * @phpstan-import-type EventsState from SetupStateProviderInterface
 * @api
 */
interface EventsSettingStateInterface
{
    /**
     * The path of the events a scope does not send
     */
    public const DISABLED_PATH = 'hryvinskyi_datalayer/events/disabled';

    /**
     * The path of the routing rows
     */
    public const ROUTING_PATH = 'hryvinskyi_datalayer/channels/routing';

    /**
     * Get the reach of both paths
     *
     * @return array<string, ScopeType> Keyed by path, the disabled-events path first
     * @throws \InvalidArgumentException When either path has no field on the configuration page
     */
    public function getReaches(): array;

    /**
     * Describe the setting with its values for the wizard's state
     *
     * @param ScopedValuesInterface $values Values read for both paths
     * @return EventsState
     * @throws \InvalidArgumentException When either path has no field on the configuration page
     */
    public function describe(ScopedValuesInterface $values): array;

    /**
     * Get both raw values the store reads at a scope, each its own there, else inherited, else shipped
     *
     * @param ScopedValuesInterface $values Values read for both paths
     * @param string $scopeId
     * @return array<string, string|null> Keyed by path, the disabled-events path first
     * @throws \InvalidArgumentException When either path has no field on the configuration page
     */
    public function readAt(ScopedValuesInterface $values, string $scopeId): array;
}
