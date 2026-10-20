<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

/**
 * Finds the settings the deployment configuration fixes, and the value it fixes them to
 *
 * A setting fixed by the deployment configuration (its files or the environment) cannot be changed in the admin at
 * that scope; a setting fixed at the default scope is fixed at every scope, as the configuration page shows it.
 *
 * @phpstan-import-type Scope from ScopeTreeInterface
 * @phpstan-type Lock array{message: string, value: string|null}
 * @api
 */
interface SettingLocksInterface
{
    /**
     * Read which paths are fixed at which scopes
     *
     * @param list<string> $paths
     * @param list<Scope> $scopes
     * @return array<string, array<string, Lock>> Keyed by path, then by scope id; the message says why the setting
     *     cannot be changed, the value is the one the store reads at that scope. Paths and scopes that are not fixed
     *     are absent
     */
    public function read(array $paths, array $scopes): array;
}
