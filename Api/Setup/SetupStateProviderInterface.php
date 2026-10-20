<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

/**
 * What the setup wizard is given to work with: the scopes, every wizard setting and the events setting, each with
 * its shipped value and the values stored scope by scope
 *
 * The browser works out which value applies at a scope from these facts: the scope's own value, else the nearest
 * ancestor's (store view, then website, then default), else the shipped one. Only scopes of the scope tree within the
 * setting's reach appear under `values` and `locks`, so a row left behind by a deleted website or store view, or a
 * store-view row of a setting that cannot be set per store view, is never reported. A scope fixed by the deployment
 * configuration reports the value the store reads there, under `values`, and why it cannot be changed, under
 * `locks`. A secret is reported only as whether it is set. A setting the signed-in user may not change, because its
 * field sits in a section of the configuration page the user may not open, is not reported at all.
 *
 * Every map that may be empty (`values`, `locks`, `channels`) is an empty object when it is empty, so the state
 * encodes to JSON objects throughout.
 *
 * @phpstan-import-type Scope from ScopeTreeInterface
 * @phpstan-import-type ScopeType from ScopeTreeInterface
 * @phpstan-import-type Option from SettingPresentationInterface
 * @phpstan-import-type CatalogueEvent from EventsProjectionInterface
 * @phpstan-import-type Preset from EventsProjectionInterface
 * @phpstan-type WireValue bool|string|array{set: bool}
 * @phpstan-type Setting array{
 *     key: string,
 *     path: string,
 *     kind: string,
 *     step: string,
 *     label: string,
 *     options: list<Option>,
 *     reach: ScopeType,
 *     pattern?: array{source: string, flags: string},
 *     min?: int,
 *     max?: int,
 *     caseInsensitive?: true,
 *     builtIn: WireValue,
 *     values: array<string, WireValue>|\stdClass,
 *     locks: array<string, string>|\stdClass
 * }
 * @phpstan-type WireSelection array{off: list<string>, channels: array<string, string>|\stdClass}
 * @phpstan-type EventsState array{
 *     catalogue: list<CatalogueEvent>,
 *     presets: list<Preset>,
 *     builtIn: WireSelection,
 *     values: array<string, WireSelection>|\stdClass,
 *     locks: array<string, string>|\stdClass
 * }
 * @phpstan-type State array{scopes: list<Scope>, settings: list<Setting>, events: EventsState}
 * @api
 */
interface SetupStateProviderInterface
{
    /**
     * The key the events setting is known by; no other setting may use it
     */
    public const EVENTS_KEY = 'events';

    /**
     * Read the current state
     *
     * @return State
     * @throws \InvalidArgumentException When a registered setting has no field with a label on the configuration
     *     page, or a pattern the browser cannot use
     */
    public function getState(): array;
}
