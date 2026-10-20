<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

/**
 * The events setting as the setup wizard shows it: the events modules register, the presets that select them, and
 * a stored pair of event settings read as a selection
 *
 * @phpstan-type CatalogueEvent array{
 *     name: string,
 *     label: string,
 *     group: string,
 *     groupCode?: string,
 *     trigger: string,
 *     source: string,
 *     sourceCode?: string,
 *     browserOriginated: bool,
 *     fixedChannel: string|null
 * }
 * @phpstan-type Preset array{key: string, label: string, description: string, icon?: string, events: list<string>}
 * @phpstan-type Selection array{off: list<string>, channels: array<string, string>}
 * @api
 */
interface EventsProjectionInterface
{
    /**
     * Get every known event in registration order
     *
     * The group and source codes are present only when the registering module named them; the fixed channel is the
     * channel the event always goes through, or null when the admin chooses it.
     *
     * @return list<CatalogueEvent>
     */
    public function catalogue(): array;

    /**
     * Get every event preset, in preset order
     *
     * @return list<Preset>
     */
    public function presets(): array;

    /**
     * Read a stored disabled-events value and routing value as a selection of known events
     *
     * `off` names the known events switched off; `channels` maps each known event whose channel the admin chooses to
     * the channel of its last routing row whose channel exists. Entries for events no module registers are left out:
     * they stay stored and untouched.
     *
     * @param string|null $disabled The raw disabled-events value
     * @param string|null $routing The raw routing value
     * @return Selection
     */
    public function selection(?string $disabled, ?string $routing): array;
}
