<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

/**
 * The scope the setup wizard opens at, from the `website` and `store` parameters the configuration page passes
 *
 * @phpstan-import-type Scope from ScopeTreeInterface
 * @api
 */
interface InitialScopeInterface
{
    /**
     * Resolve the scope to open at
     *
     * A store view given and present among the scopes wins; else a website given and present; else the default scope.
     * A parameter that is not a positive whole number, or names a scope that is not there, is passed over rather than
     * refused, so a stale link still opens the wizard.
     *
     * @param mixed $website The `website` parameter as the request carried it
     * @param mixed $store The `store` parameter as the request carried it
     * @param list<Scope> $scopes
     * @return string A scope id among the scopes, or the default scope's
     */
    public function resolve(mixed $website, mixed $store, array $scopes): string;
}
