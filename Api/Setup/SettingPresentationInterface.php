<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

/**
 * How the configuration page presents a setting: its label, its options and the narrowest scope it can be set at
 *
 * The configuration page's field for the path stays the one place these are declared; the setup wizard shows the
 * same.
 *
 * @phpstan-import-type ScopeType from ScopeTreeInterface
 * @phpstan-type Option array{value: string, label: string}
 * @phpstan-type Presentation array{label: string, options: list<Option>, reach: ScopeType}
 * @api
 */
interface SettingPresentationInterface
{
    /**
     * Read the presentation of the field stored under a config path
     *
     * The reach is `store` when the field shows at store views, else `website` when it shows at websites, else
     * `default`.
     *
     * @param string $key The setting's key, named when the path has no field
     * @param string $path The config path the setting is stored under
     * @return Presentation
     * @throws \InvalidArgumentException When no field with a label is stored under the path
     */
    public function present(string $key, string $path): array;
}
