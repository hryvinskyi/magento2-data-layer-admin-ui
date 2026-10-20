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
 * How a wizard setting is saved: the config paths it is stored under, and the value each path's configuration page
 * field is posted with; and how it is drafted for an event preview
 *
 * @phpstan-import-type ScopeType from ScopeTreeInterface
 * @api
 */
interface SettingFieldsInterface
{
    /**
     * Get the config paths a setting is stored under, with the reach of each
     *
     * @param string $key The setting's key
     * @return array<string, ScopeType> Keyed by config path
     * @throws InvalidSetupRequestException When no setting is registered under the key
     * @throws \InvalidArgumentException When a path has no field on the configuration page
     */
    public function getReaches(string $key): array;

    /**
     * Turn a value the browser sent for a scope into what each path's field is posted with
     *
     * @param string $key The setting's key
     * @param mixed $value The value as the browser sent it
     * @param string $scopeId The scope the value is saved at
     * @param ScopedValuesInterface $values What is stored, shipped and fixed for the setting's paths
     * @return array<string, mixed> Keyed by config path, one entry per path of the setting
     * @throws InvalidSetupRequestException When no setting is registered under the key, or the value is not one the
     *     setting takes
     */
    public function toFieldValues(string $key, mixed $value, string $scopeId, ScopedValuesInterface $values): array;

    /**
     * Turn a value the browser sent into the raw values an event preview drafts, in the form they are stored in
     *
     * Only what can change an event is drafted; a setting that cannot (a secret) drafts nothing.
     *
     * @param string $key The setting's key
     * @param mixed $value The value as the browser sent it
     * @return array<string, string> Keyed by config path
     * @throws InvalidSetupRequestException When no setting is registered under the key, or the value is not one the
     *     setting takes
     */
    public function toPreviewDraft(string $key, mixed $value): array;
}
